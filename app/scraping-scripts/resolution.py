"""
resolution.py
=============
Reads from raw.* and populates resolution.player_mappings and
resolution.tournament_mappings for ALL sources.

Matching strategy (players)
---------------------------
1. Exact match on a known external ID already in canonical.players
   (utr_id, usta_id).  Confidence = 1.0,  method = "exact_external_id".
2. Exact match on full_name + grad_year + gender.
   Confidence = 0.95, method = "exact_name_grad_year".
3. Exact match on full_name + gender alone (USTA has no grad_year).
   Confidence = 0.85, method = "exact_name_gender".
4. Fuzzy name match within same gender (+ grad_year when available).
   Confidence = 0.75, method = "fuzzy_name".
5. No match → create new canonical.players stub.
   Confidence = 1.0,  method = "new".

Each source exposes its external IDs differently; _extract_external_ids()
handles the per-source mapping.

Public API
----------
    resolve_players(sources)     -> dict[(source, source_id), canonical_uuid]
    resolve_tournaments(sources) -> dict[(source, source_id), canonical_uuid]
    resolve_all(sources)         -> tuple[dict, dict]

    All sources resolved when sources=None (default).
"""

from __future__ import annotations

from difflib import SequenceMatcher
from datetime import datetime, timezone

from db.client import supabase

ALL_SOURCES = ["tennisrecruiting.net", "USTA", "UTR"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


def _extract_external_ids(source: str, raw_json: dict) -> dict[str, str | None]:
    """
    Pull the external IDs we can use for cross-source matching out of a
    raw_json blob.  Each source stores them in a different place.
    """
    extra = raw_json.get("player_extra", {})

    if source == "tennisrecruiting.net":
        return {
            "utr_id":  str(extra["utr_id"])    if extra.get("utr_id")    else None,
            "usta_id": str(extra["usta_uaid"]) if extra.get("usta_uaid") else None,
        }
    if source == "UTR":
        # The UTR source_id IS the utr_id
        player = raw_json.get("player", {})
        return {
            "utr_id":  str(player["_source_id"]) if player.get("_source_id") else None,
            "usta_id": None,
        }
    if source == "USTA":
        # The USTA source_id IS the usta_id (uaid)
        player = raw_json.get("player", {})
        src_id = player.get("_source_id")
        return {
            "utr_id":  None,
            "usta_id": str(src_id) if src_id else None,
        }
    return {"utr_id": None, "usta_id": None}


# ---------------------------------------------------------------------------
# Player resolution — shared internals
# ---------------------------------------------------------------------------

def _load_canonical_players() -> list[dict]:
    result = supabase.table("canonical.players").select("*").execute()
    return result.data or []


def _load_existing_player_mappings(sources: list[str]) -> dict[tuple[str, str], str]:
    """Returns {(source, source_id): canonical_uuid} for already-resolved rows."""
    result = (
        supabase.table("resolution.player_mappings")
        .select("source,source_id,canonical_id")
        .in_("source", sources)
        .execute()
    )
    return {(r["source"], r["source_id"]): r["canonical_id"] for r in (result.data or [])}


def _upsert_player_mapping(
    source: str,
    source_id: str,
    canonical_id: str,
    alias_name: str | None,
    confidence: float,
    method: str,
) -> None:
    supabase.table("resolution.player_mappings").upsert(
        {
            "canonical_id": canonical_id,
            "source":       source,
            "source_id":    str(source_id),
            "alias_name":   alias_name,
            "confidence":   confidence,
            "match_method": method,
            "created_at":   _now(),
        },
        on_conflict="source,source_id",
    ).execute()


def _create_canonical_player(source: str, raw_json: dict) -> str:
    """Insert a new canonical.players row and return its UUID."""
    p     = raw_json.get("player", {})
    extra = raw_json.get("player_extra", {})
    ids   = _extract_external_ids(source, raw_json)

    row = {
        "full_name":     p.get("full_name"),
        "first_name":    p.get("first_name"),
        "last_name":     p.get("last_name"),
        "date_of_birth": p.get("date_of_birth"),
        "grad_year":     p.get("grad_year"),
        "gender":        p.get("gender"),
        "region":        p.get("region"),
        "country_code":  p.get("country_code"),
        "height":        p.get("height"),
        "dominant_hand": p.get("dominant_hand"),
        "play_style":    p.get("play_style"),
        "utr_id":        ids.get("utr_id"),
        "usta_id":       ids.get("usta_id"),
        "created_at":    _now(),
        "updated_at":    _now(),
    }
    result = supabase.table("canonical.players").insert(row).execute()
    return result.data[0]["id"]


def _update_canonical_player_ids(canonical_id: str, ids: dict[str, str | None]) -> None:
    """
    When we match an existing canonical player via name, write back any
    external IDs we now know from the new source (e.g. USTA match fills
    in usta_id on a row that only had utr_id before).
    """
    updates = {k: v for k, v in ids.items() if v is not None}
    if updates:
        updates["updated_at"] = _now()
        supabase.table("canonical.players").update(updates).eq("id", canonical_id).execute()


def _match_player(
    source: str,
    raw_json: dict,
    canonical_players: list[dict],
) -> tuple[str | None, float, str]:
    """
    Try to find an existing canonical player for a raw record.
    Returns (canonical_id | None, confidence, method).
    """
    p         = raw_json.get("player", {})
    name      = (p.get("full_name") or "").strip()
    grad_year = p.get("grad_year")
    gender    = p.get("gender")
    ids       = _extract_external_ids(source, raw_json)
    utr_id    = ids.get("utr_id")
    usta_id   = ids.get("usta_id")

    # 1. External ID — strongest signal, cross-source safe
    for canon in canonical_players:
        if utr_id and canon.get("utr_id") == utr_id:
            return canon["id"], 1.0, "exact_external_id"
        if usta_id and canon.get("usta_id") == usta_id:
            return canon["id"], 1.0, "exact_external_id"

    if not name:
        return None, 0.0, "no_name"

    # 2. Exact name + grad_year + gender  (TennisRecruiting, UTR have grad_year)
    if grad_year:
        for canon in canonical_players:
            if (
                canon.get("full_name", "").strip().lower() == name.lower()
                and canon.get("grad_year") == grad_year
                and canon.get("gender") == gender
            ):
                return canon["id"], 0.95, "exact_name_grad_year"

    # 3. Exact name + gender  (USTA doesn't expose grad_year)
    for canon in canonical_players:
        if (
            canon.get("full_name", "").strip().lower() == name.lower()
            and canon.get("gender") == gender
        ):
            return canon["id"], 0.85, "exact_name_gender"

    # 4. Fuzzy name — restrict bucket to same gender + grad_year when available
    best_score = 0.0
    best_id    = None
    for canon in canonical_players:
        if canon.get("gender") != gender:
            continue
        if grad_year and canon.get("grad_year") and canon.get("grad_year") != grad_year:
            continue
        sim = _similarity(name, canon.get("full_name") or "")
        if sim > best_score:
            best_score = sim
            best_id    = canon["id"]

    if best_id and best_score >= 0.85:
        return best_id, round(best_score * 0.9, 4), "fuzzy_name"

    return None, 0.0, "no_match"


# ---------------------------------------------------------------------------
# Player resolution — public
# ---------------------------------------------------------------------------

def resolve_players(sources: list[str] | None = None) -> dict[tuple[str, str], str]:
    """
    Resolve all unresolved raw.players rows for the given sources.
    Returns {(source, source_id): canonical_uuid}.
    """
    sources = sources or ALL_SOURCES
    existing = _load_existing_player_mappings(sources)

    raw_result = (
        supabase.table("raw.players")
        .select("source,source_id,raw_json")
        .in_("source", sources)
        .execute()
    )
    raw_rows = raw_result.data or []

    unresolved = [r for r in raw_rows if (r["source"], r["source_id"]) not in existing]
    if not unresolved:
        print(f"  [resolution] Players: nothing new to resolve ({len(existing)} already mapped)")
        return existing

    canonical_players = _load_canonical_players()
    resolved = dict(existing)

    counts = {"matched": 0, "new": 0}

    for row in unresolved:
        source    = row["source"]
        source_id = row["source_id"]
        raw_json  = row["raw_json"]
        alias     = raw_json.get("player", {}).get("full_name")

        canonical_id, confidence, method = _match_player(source, raw_json, canonical_players)

        if canonical_id is None:
            canonical_id = _create_canonical_player(source, raw_json)
            confidence   = 1.0
            method       = "new"
            new_row = supabase.table("canonical.players").select("*").eq("id", canonical_id).execute()
            if new_row.data:
                canonical_players.append(new_row.data[0])
            counts["new"] += 1
        else:
            # Back-fill any external IDs we learned from this source
            ids = _extract_external_ids(source, raw_json)
            _update_canonical_player_ids(canonical_id, ids)
            counts["matched"] += 1

        _upsert_player_mapping(source, source_id, canonical_id, alias, confidence, method)
        resolved[(source, source_id)] = canonical_id

    print(
        f"  [resolution] Players: {counts['matched']} matched, "
        f"{counts['new']} created  ({len(resolved)} total mapped)"
    )
    return resolved


# ---------------------------------------------------------------------------
# Tournament resolution — only TennisRecruiting has tournament data for now
# ---------------------------------------------------------------------------

def _load_existing_tournament_mappings(sources: list[str]) -> dict[tuple[str, str], str]:
    result = (
        supabase.table("resolution.tournament_mappings")
        .select("source,source_id,canonical_id")
        .in_("source", sources)
        .execute()
    )
    return {(r["source"], r["source_id"]): r["canonical_id"] for r in (result.data or [])}


def _infer_tournament_level(name: str | None) -> str | None:
    if not name:
        return None
    level_map = {
        "JGS": "ITF_Grade_A", "JM": "ITF_Junior_Masters",
        "J500": "ITF_Grade_1", "J300": "ITF_Grade_2",
        "J200": "ITF_Grade_3", "J100": "ITF_Grade_4",
        "J060": "ITF_Grade_5", "L1": "USTA_Level_1",
        "L2": "USTA_Level_2", "L3": "USTA_Level_3",
    }
    prefix = name.strip().split()[0].upper()
    return level_map.get(prefix)


def _create_canonical_tournament(source: str, raw_json: dict) -> str:
    row = {
        "name":       raw_json.get("name"),
        "start_date": raw_json.get("start"),
        "end_date":   raw_json.get("end"),
        "location":   raw_json.get("location"),
        "level":      _infer_tournament_level(raw_json.get("name")),
        "source":     source,
        "created_at": _now(),
    }
    result = supabase.table("canonical.tournaments").insert(row).execute()
    return result.data[0]["id"]


def _upsert_tournament_mapping(
    source: str,
    source_id: str,
    canonical_id: str,
    confidence: float,
    method: str,
) -> None:
    supabase.table("resolution.tournament_mappings").upsert(
        {
            "canonical_id": canonical_id,
            "source":       source,
            "source_id":    source_id,
            "confidence":   confidence,
            "match_method": method,
            "created_at":   _now(),
        },
        on_conflict="source,source_id",
    ).execute()


def resolve_tournaments(sources: list[str] | None = None) -> dict[tuple[str, str], str]:
    """
    Resolve all unresolved raw.tournaments rows for the given sources.
    Returns {(source, source_tournament_id): canonical_uuid}.
    """
    sources  = sources or ALL_SOURCES
    existing = _load_existing_tournament_mappings(sources)

    raw_result = (
        supabase.table("raw.tournaments")
        .select("source,source_tournament_id,raw_json")
        .in_("source", sources)
        .execute()
    )
    raw_rows   = raw_result.data or []
    unresolved = [
        r for r in raw_rows
        if (r["source"], r["source_tournament_id"]) not in existing
    ]

    if not unresolved:
        print(f"  [resolution] Tournaments: nothing new to resolve ({len(existing)} already mapped)")
        return existing

    canonical_tournaments = (
        supabase.table("canonical.tournaments").select("*").execute().data or []
    )
    resolved = dict(existing)
    counts   = {"matched": 0, "new": 0}

    for row in unresolved:
        source    = row["source"]
        source_id = row["source_tournament_id"]
        raw_json  = row["raw_json"]
        name      = (raw_json.get("name") or "").strip()
        start     = raw_json.get("start")

        canonical_id = None
        for canon in canonical_tournaments:
            if (
                (canon.get("name") or "").strip().lower() == name.lower()
                and canon.get("start_date") == start
            ):
                canonical_id = canon["id"]
                break

        if canonical_id is None:
            canonical_id = _create_canonical_tournament(source, raw_json)
            new_t = supabase.table("canonical.tournaments").select("*").eq("id", canonical_id).execute()
            if new_t.data:
                canonical_tournaments.append(new_t.data[0])
            counts["new"]     += 1
            method = "new"
        else:
            counts["matched"] += 1
            method = "exact"

        _upsert_tournament_mapping(source, source_id, canonical_id, 1.0, method)
        resolved[(source, source_id)] = canonical_id

    print(
        f"  [resolution] Tournaments: {counts['matched']} matched, "
        f"{counts['new']} created  ({len(resolved)} total mapped)"
    )
    return resolved


# ---------------------------------------------------------------------------
# Convenience
# ---------------------------------------------------------------------------

def resolve_all(sources: list[str] | None = None) -> tuple[dict, dict]:
    """Run full resolution pass for all sources. Returns (player_map, tournament_map)."""
    player_map     = resolve_players(sources)
    tournament_map = resolve_tournaments(sources)
    return player_map, tournament_map