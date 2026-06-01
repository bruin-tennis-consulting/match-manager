"""
resolution.py
=============
Reads from raw schema and populates resolution schema mappings for all sources.
Creates canonical stubs as a side effect when no match is found.

Flow per entity type:
    raw.players      -> resolution.player_mappings     (+ canonical.players stubs)
    raw.tournaments  -> resolution.tournament_mappings (+ canonical.tournaments stubs)
    raw.matches      -> resolution.match_mappings      (+ canonical.matches stubs)

Matching strategy — players
---------------------------
1. exact_external_id   — utr_id or usta_id already in canonical.players.  conf=1.0
2. exact_name_grad_year — full_name + grad_year + gender match.           conf=0.95
3. exact_name_gender   — full_name + gender (USTA has no grad_year).      conf=0.85
4. fuzzy_name          — SequenceMatcher >= 0.85 within same gender bucket. conf=0.75
5. new                 — no match; create canonical stub.                  conf=1.0

Matching strategy — tournaments
--------------------------------
1. exact   — name + start_date match in canonical.tournaments.  conf=1.0
2. new     — no match; create canonical stub.                   conf=1.0

Matching strategy — matches
----------------------------
Must run AFTER players + tournaments so canonical IDs are available.
1. same_players_date_score — same canonical pair + played_at + normalised score. conf=1.0
2. same_players_date       — same canonical pair + played_at, score differs.     conf=0.9
3. new                     — no match; create canonical stub.                    conf=1.0

Public API
----------
    resolve_players(sources)                            -> player_map
    resolve_tournaments(sources)                        -> tournament_map
    resolve_matches(player_map, tournament_map, sources) -> match_map
    resolve_all(sources)                                -> (player_map, tournament_map, match_map)

All maps: {(source, source_id): canonical_uuid}
All sources resolved when sources=None (default).
"""

from __future__ import annotations

import re
from collections import defaultdict
from difflib import SequenceMatcher
from datetime import datetime, timezone

from db.client import supabase, fetch_all

ALL_SOURCES = ["tennisrecruiting.net", "USTA", "UTR"]

# Schema-scoped table accessors
_raw        = lambda t: supabase.schema("raw").table(t)
_resolution = lambda t: supabase.schema("resolution").table(t)
_canonical  = lambda t: supabase.schema("canonical").table(t)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


# ---------------------------------------------------------------------------
# External ID extraction — per-source mapping
# ---------------------------------------------------------------------------

_TR_BASE_URL    = "https://www.tennisrecruiting.net"
_TR_NO_PHOTO    = "/img/nophoto.gif"


def _extract_image_url(source: str, raw_json: dict) -> str | None:
    """Return a full image URL for a player, or None if no real photo is available."""
    if source != "tennisrecruiting.net":
        return None
    photo = (raw_json.get("player_extra") or {}).get("photo_path")
    if photo and photo != _TR_NO_PHOTO:
        return f"{_TR_BASE_URL}{photo}"
    return None


def _extract_external_ids(source: str, raw_json: dict) -> dict[str, str | None]:
    """
    Pull cross-source-matchable external IDs from a raw_json blob.
    Each source stores them in a different location.
    """
    extra  = raw_json.get("player_extra", {})
    player = raw_json.get("player", {})

    if source == "tennisrecruiting.net":
        return {
            "utr_id":  str(extra["utr_id"])    if extra.get("utr_id")    else None,
            "usta_id": str(extra["usta_uaid"]) if extra.get("usta_uaid") else None,
        }
    if source == "UTR":
        # The UTR source_id IS the utr_id
        return {
            "utr_id":  str(player["_source_id"]) if player.get("_source_id") else None,
            "usta_id": None,
        }
    if source == "USTA":
        # The USTA source_id IS the usta uaid
        return {
            "utr_id":  None,
            "usta_id": str(player["_source_id"]) if player.get("_source_id") else None,
        }
    return {"utr_id": None, "usta_id": None}


# ===========================================================================
# PLAYERS
# ===========================================================================

def _load_canonical_players() -> list[dict]:
    return fetch_all("canonical", "players")


def _load_existing_player_mappings(sources: list[str]) -> dict[tuple[str, str], str]:
    result = (
        _resolution("player_mappings")
        .select("source,source_id,canonical_id")
        .in_("source", sources)
        .execute()
    )
    return {(r["source"], r["source_id"]): r["canonical_id"] for r in (result.data or [])}


def _upsert_player_mapping(
    source: str, source_id: str, canonical_id: str,
    alias_name: str | None, confidence: float, method: str,
) -> None:
    _resolution("player_mappings").upsert(
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
    """Insert a new canonical.players row. Returns UUID."""
    p   = raw_json.get("player", {})
    extra = raw_json.get("player_extra", {})
    ids = _extract_external_ids(source, raw_json)
    result = _canonical("players").insert(
        {
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
            # enriched fields from player_extra
            "city":              extra.get("city"),
            "state":             extra.get("state_code"),
            "high_school":       extra.get("highschool"),
            "committed_to":      extra.get("committed_to"),
            "stars":             extra.get("stars"),
            "academy":       extra.get("academy"),
            "international": extra.get("international"),
            "video_urls":    extra.get("video_urls") or None,
            "image_url":     _extract_image_url(source, raw_json),
            "created_at":    _now(),
            "updated_at":    _now(),
        }
    ).execute()
    return result.data[0]["id"]


def _backfill_canonical_player_ids(canonical_id: str, ids: dict[str, str | None]) -> None:
    """Write back any external IDs we learned from a new source without overwriting existing ones."""
    updates = {k: v for k, v in ids.items() if v is not None}
    if updates:
        updates["updated_at"] = _now()
        _canonical("players").update(updates).eq("id", canonical_id).execute()


def _match_player(
    source: str, raw_json: dict, canonical_players: list[dict],
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

    # 1. External ID — strongest cross-source signal
    for canon in canonical_players:
        if utr_id  and canon.get("utr_id")  == utr_id:
            return canon["id"], 1.0, "exact_external_id"
        if usta_id and canon.get("usta_id") == usta_id:
            return canon["id"], 1.0, "exact_external_id"

    if not name:
        return None, 0.0, "no_name"

    # 2. Exact name + grad_year + gender  (TR and UTR always have grad_year)
    if grad_year:
        for canon in canonical_players:
            if (
                canon.get("full_name", "").strip().lower() == name.lower()
                and canon.get("grad_year") == grad_year
                and canon.get("gender")    == gender
            ):
                return canon["id"], 0.95, "exact_name_grad_year"

    # 3. Exact name + gender  (USTA doesn't expose grad_year)
    for canon in canonical_players:
        if (
            canon.get("full_name", "").strip().lower() == name.lower()
            and canon.get("gender") == gender
        ):
            return canon["id"], 0.85, "exact_name_gender"

    # 4. Fuzzy name — same gender bucket, same grad_year bucket when available
    best_score, best_id = 0.0, None
    for canon in canonical_players:
        if canon.get("gender") != gender:
            continue
        if grad_year and canon.get("grad_year") and canon.get("grad_year") != grad_year:
            continue
        sim = _similarity(name, canon.get("full_name") or "")
        if sim > best_score:
            best_score, best_id = sim, canon["id"]

    if best_id and best_score >= 0.85:
        return best_id, round(best_score * 0.9, 4), "fuzzy_name"

    return None, 0.0, "no_match"


def resolve_players(sources: list[str] | None = None) -> dict[tuple[str, str], str]:
    """
    Resolve all unresolved raw.players rows for the given sources.
    Returns {(source, source_id): canonical_uuid}.
    """
    sources  = sources or ALL_SOURCES
    existing = _load_existing_player_mappings(sources)

    raw_rows = fetch_all("raw", "players", "source,source_id,raw_json", ("source", sources))
    unresolved = [r for r in raw_rows if (r["source"], r["source_id"]) not in existing]

    if not unresolved:
        print(f"  [resolution] Players: nothing new  ({len(existing)} already mapped)")
        return existing

    canonical_players = _load_canonical_players()
    resolved = dict(existing)
    counts   = {"matched": 0, "new": 0}

    for row in unresolved:
        source, source_id, raw_json = row["source"], row["source_id"], row["raw_json"]
        alias = raw_json.get("player", {}).get("full_name")

        canonical_id, confidence, method = _match_player(source, raw_json, canonical_players)

        if canonical_id is None:
            canonical_id = _create_canonical_player(source, raw_json)
            confidence, method = 1.0, "new"
            new_row = _canonical("players").select("*").eq("id", canonical_id).execute()
            if new_row.data:
                canonical_players.append(new_row.data[0])
            counts["new"] += 1
        else:
            _backfill_canonical_player_ids(canonical_id, _extract_external_ids(source, raw_json))
            counts["matched"] += 1

        _upsert_player_mapping(source, source_id, canonical_id, alias, confidence, method)
        resolved[(source, source_id)] = canonical_id

    print(
        f"  [resolution] Players: {counts['matched']} matched, "
        f"{counts['new']} created  ({len(resolved)} total mapped)"
    )
    return resolved


# ===========================================================================
# TOURNAMENTS
# ===========================================================================

_TOURNAMENT_LEVEL_MAP = {
    "JGS": "ITF_Grade_A",  "JM":  "ITF_Junior_Masters",
    "J500": "ITF_Grade_1", "J300": "ITF_Grade_2",
    "J200": "ITF_Grade_3", "J100": "ITF_Grade_4",
    "J060": "ITF_Grade_5", "L1":  "USTA_Level_1",
    "L2":  "USTA_Level_2", "L3":  "USTA_Level_3",
}


def _infer_tournament_level(name: str | None) -> str | None:
    if not name:
        return None
    return _TOURNAMENT_LEVEL_MAP.get(name.strip().split()[0].upper())


def _load_existing_tournament_mappings(sources: list[str]) -> dict[tuple[str, str], str]:
    result = (
        _resolution("tournament_mappings")
        .select("source,source_id,canonical_id")
        .in_("source", sources)
        .execute()
    )
    return {(r["source"], r["source_id"]): r["canonical_id"] for r in (result.data or [])}


def _upsert_tournament_mapping(
    source: str, source_id: str, canonical_id: str, confidence: float, method: str,
) -> None:
    _resolution("tournament_mappings").upsert(
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


def _create_canonical_tournament(source: str, raw_json: dict) -> str:
    result = _canonical("tournaments").insert(
        {
            "name":       raw_json.get("name"),
            "start_date": raw_json.get("start"),
            "end_date":   raw_json.get("end"),
            "location":   raw_json.get("location"),
            "level":      _infer_tournament_level(raw_json.get("name")),
            "source":     source,
            "created_at": _now(),
        }
    ).execute()
    return result.data[0]["id"]


def resolve_tournaments(sources: list[str] | None = None) -> dict[tuple[str, str], str]:
    """
    Resolve all unresolved raw.tournaments rows for the given sources.
    Returns {(source, source_tournament_id): canonical_uuid}.
    """
    sources  = sources or ALL_SOURCES
    existing = _load_existing_tournament_mappings(sources)

    raw_rows = fetch_all("raw", "tournaments", "source,source_tournament_id,raw_json", ("source", sources))
    unresolved = [
        r for r in raw_rows
        if (r["source"], r["source_tournament_id"]) not in existing
    ]

    if not unresolved:
        print(f"  [resolution] Tournaments: nothing new  ({len(existing)} already mapped)")
        return existing

    canonical_tournaments = fetch_all("canonical", "tournaments")
    resolved = dict(existing)
    counts   = {"matched": 0, "new": 0}

    for row in unresolved:
        source    = row["source"]
        source_id = row["source_tournament_id"]
        raw_json  = row["raw_json"]
        name      = (raw_json.get("name") or "").strip()
        start     = raw_json.get("start")

        canonical_id = next(
            (
                c["id"] for c in canonical_tournaments
                if (c.get("name") or "").strip().lower() == name.lower()
                and c.get("start_date") == start
            ),
            None,
        )

        if canonical_id is None:
            canonical_id = _create_canonical_tournament(source, raw_json)
            new_t = _canonical("tournaments").select("*").eq("id", canonical_id).execute()
            if new_t.data:
                canonical_tournaments.append(new_t.data[0])
            counts["new"] += 1
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


# ===========================================================================
# MATCHES
# ===========================================================================

def _scores_compatible(a: str | None, b: str | None) -> bool:
    """
    Return True if two score strings are plausibly the same match.
    Normalises separators and strips tiebreak detail before comparing.
    e.g. "6-4 6-2" == "6-4;6-2" == "6-4, 6-2"
         "7-6(4) 6-2" == "7-6 6-2"
    """
    if not a or not b:
        return False
    def _strip(s: str) -> str:
        s = re.sub(r"\(\d+\)", "", s)
        s = re.sub(r"[\s;,]+", " ", s.strip())
        return s.lower()
    return _strip(a) == _strip(b)


def _parse_sets(score: str | None) -> list[dict] | None:
    """Parse "6-4;3-6;7-5(4)" -> [{"p":6,"o":4}, {"p":3,"o":6}, {"p":7,"o":5,"tb":4}]."""
    if not score:
        return None
    sets = []
    for s in re.sub(r"[;,\s]+", " ", score.strip()).split():
        tb_m = re.search(r"\((\d+)\)", s)
        tb   = int(tb_m.group(1)) if tb_m else None
        s    = re.sub(r"\(\d+\)", "", s)
        parts = s.split("-")
        if len(parts) != 2:
            return None
        try:
            entry: dict = {"p": int(parts[0]), "o": int(parts[1])}
        except ValueError:
            return None
        if tb is not None:
            entry["tb"] = tb
        sets.append(entry)
    return sets or None


def _make_match_key(pid: str, oid: str, date: str | None) -> tuple:
    """
    Build an order-independent match index key.

    TennisRecruiting reports each match from both players' perspectives,
    producing two raw rows with the player pair in opposite order.
    Sorting the pair and truncating the date to YYYY-MM-DD ensures both
    rows hash to the same key regardless of who is listed as player vs
    opponent and regardless of time-of-day / timezone differences in
    played_at values.
    """
    return (min(pid, oid), max(pid, oid), (date or "")[:10])


def _load_existing_match_mappings(sources: list[str]) -> dict[tuple[str, str], str]:
    result = (
        _resolution("match_mappings")
        .select("source,source_match_id,canonical_id")
        .in_("source", sources)
        .execute()
    )
    return {(r["source"], r["source_match_id"]): r["canonical_id"] for r in (result.data or [])}


def _upsert_match_mapping(
    source: str, source_match_id: str, canonical_id: str, confidence: float, method: str,
) -> None:
    _resolution("match_mappings").upsert(
        {
            "canonical_id":    canonical_id,
            "source":          source,
            "source_match_id": source_match_id,
            "confidence":      confidence,
            "match_method":    method,
            "created_at":      _now(),
        },
        on_conflict="source,source_match_id",
    ).execute()


def _get_or_create_stub_player(
    source: str,
    source_id: str | int | None,
    name: str | None,
    player_map: dict[tuple[str, str], str],
) -> str | None:
    """
    Return a canonical player UUID for an opponent we've seen in match data
    but haven't scraped a full profile for yet.

    Resolution order:
      1. Already in player_map from this run — return immediately.
      2. Already in resolution.player_mappings in the DB — load and return.
      3. Create a minimal canonical.players stub (name only) and add a
         player_mapping with method="stub" so a future profile scrape will
         find and enrich it via the normal exact_external_id / name matching
         path rather than creating a duplicate.

    Returns None only when we have neither a source_id nor a name to work with.
    """
    if not source_id and not name:
        return None

    sid_str = str(source_id) if source_id else None

    # 1. Already resolved in this run
    if sid_str:
        existing = player_map.get((source, sid_str))
        if existing:
            return existing

    # 2. Already in the DB mapping table
    if sid_str:
        db_result = (
            _resolution("player_mappings")
            .select("canonical_id")
            .eq("source", source)
            .eq("source_id", sid_str)
            .execute()
        )
        if db_result.data:
            canonical_id = db_result.data[0]["canonical_id"]
            if sid_str:
                player_map[(source, sid_str)] = canonical_id
            return canonical_id

    # 3. Create a minimal stub — name only, no profile data yet
    parts     = (name or "").strip().split(None, 1)
    stub_row  = {
        "full_name":  name,
        "first_name": parts[0] if parts else None,
        "last_name":  parts[1] if len(parts) > 1 else None,
        "created_at": _now(),
        "updated_at": _now(),
    }
    insert_result = _canonical("players").insert(stub_row).execute()
    canonical_id  = insert_result.data[0]["id"]

    # Register the mapping so future profile scrapes enrich this stub
    # instead of creating a duplicate
    if sid_str:
        _upsert_player_mapping(
            source      = source,
            source_id   = sid_str,
            canonical_id= canonical_id,
            alias_name  = name,
            confidence  = 0.7,          # lower confidence — name-only stub
            method      = "stub",
        )
        player_map[(source, sid_str)] = canonical_id

    return canonical_id


def _create_canonical_match(
    rj: dict,
    source: str,
    player_map: dict[tuple[str, str], str],
    tournament_map: dict[tuple[str, str], str],
) -> str | None:
    """
    Insert a new canonical.matches stub from a raw_json blob.
    If the opponent has no canonical player yet, creates a name-only stub
    so opponent_id is never null.
    Returns UUID or None if the primary player can't be resolved.
    """
    player_id = player_map.get((source, str(rj.get("player_source_id", ""))))
    if not player_id:
        return None

    opp_raw     = rj.get("opponent_source_id")
    opp_name    = rj.get("opponent_name")
    opponent_id = player_map.get((source, str(opp_raw))) if opp_raw else None

    # Create a stub if we know who the opponent is but haven't scraped them yet
    if opponent_id is None:
        opponent_id = _get_or_create_stub_player(
            source, opp_raw, opp_name, player_map
        )

    outcome   = rj.get("outcome")
    winner_id = player_id if outcome == "win" else (opponent_id or None)

    t_name        = (rj.get("tournament_name") or "").strip().upper()
    t_start       = rj.get("tournament_start") or ""
    tournament_id = tournament_map.get((source, f"{t_name}|{t_start}"))

    result = _canonical("matches").insert(
        {
            "player_id":     player_id,
            "opponent_id":   opponent_id,
            "winner_id":     winner_id,
            "tournament_id": tournament_id,
            "outcome":       outcome,
            "score":         rj.get("score"),
            "sets":          _parse_sets(rj.get("score")),
            "round":         rj.get("round"),
            "best_of":       rj.get("best_of"),
            "status":        rj.get("status", "completed"),
            "source":        source,
            "played_at":     rj.get("played_at"),
            "ingested_at":   _now(),
        }
    ).execute()
    return result.data[0]["id"]


def resolve_matches(
    player_map:     dict[tuple[str, str], str],
    tournament_map: dict[tuple[str, str], str],
    sources: list[str] | None = None,
) -> dict[tuple[str, str], str]:
    """
    Resolve all unresolved raw.matches rows for the given sources.
    Must run after resolve_players + resolve_tournaments.
    Returns {(source, source_match_id): canonical_uuid}.
    """
    sources  = sources or ALL_SOURCES
    existing = _load_existing_match_mappings(sources)

    raw_rows = fetch_all("raw", "matches", "source,source_match_id,raw_json", ("source", sources))
    unresolved = [
        r for r in raw_rows
        if (r["source"], r["source_match_id"]) not in existing
    ]

    if not unresolved:
        print(f"  [resolution] Matches: nothing new  ({len(existing)} already mapped)")
        return existing

    # Load all canonical matches and index by a normalised, order-independent key:
    #   (min(player_id, opponent_id), max(player_id, opponent_id), played_at[:10])
    #
    # TennisRecruiting reports each match from both players' perspectives, so the
    # same match arrives as two raw rows with the player pair in reverse order.
    # Using _make_match_key collapses both orderings to a single entry, preventing
    # the second perspective from being inserted as a new canonical match.
    canon_rows = fetch_all("canonical", "matches")
    canon_index: dict[tuple, list[dict]] = defaultdict(list)
    for c in canon_rows:
        pid, oid, date = c.get("player_id"), c.get("opponent_id"), c.get("played_at")
        if pid and oid and date:
            canon_index[_make_match_key(pid, oid, date)].append(c)

    resolved = dict(existing)
    counts   = {"exact": 0, "date_only": 0, "new": 0, "skipped": 0, "stubs": 0}

    for row in unresolved:
        source          = row["source"]
        source_match_id = row["source_match_id"]
        rj              = row["raw_json"]

        player_id   = player_map.get((source, str(rj.get("player_source_id", ""))))
        opp_raw     = rj.get("opponent_source_id")
        opp_name    = rj.get("opponent_name")
        opponent_id = player_map.get((source, str(opp_raw))) if opp_raw else None

        if not player_id:
            counts["skipped"] += 1
            continue

        # If the opponent isn't resolved yet, create a name-only stub now so
        # the canon_index lookup and the eventual match insert both have a
        # valid opponent UUID. A full profile scrape will enrich the stub later.
        if opponent_id is None and (opp_raw or opp_name):
            opponent_id = _get_or_create_stub_player(
                source, opp_raw, opp_name, player_map
            )
            if opponent_id:
                counts["stubs"] += 1

        played_at    = rj.get("played_at")
        raw_score    = rj.get("score")
        lookup_key   = _make_match_key(player_id, opponent_id, played_at) if opponent_id else None
        canonical_id = None
        confidence   = 1.0
        method       = "new"

        if lookup_key:
            candidates = canon_index.get(lookup_key, [])
            # Prefer score-matching candidate first
            for candidate in candidates:
                if _scores_compatible(raw_score, candidate.get("score")):
                    canonical_id = candidate["id"]
                    confidence   = 1.0
                    method       = "same_players_date_score"
                    counts["exact"] += 1
                    break
            # Fall back to date-only match
            if canonical_id is None and candidates:
                canonical_id = candidates[0]["id"]
                confidence   = 0.9
                method       = "same_players_date"
                counts["date_only"] += 1

        if canonical_id is None:
            canonical_id = _create_canonical_match(rj, source, player_map, tournament_map)
            if canonical_id is None:
                counts["skipped"] += 1
                continue
            # Add to in-memory index so later rows in this batch can match against it
            new_c = _canonical("matches").select("*").eq("id", canonical_id).execute()
            if new_c.data:
                c    = new_c.data[0]
                pid  = c.get("player_id")
                oid  = c.get("opponent_id")
                date = c.get("played_at")
                if pid and oid and date:
                    canon_index[_make_match_key(pid, oid, date)].append(c)
            counts["new"] += 1

        _upsert_match_mapping(source, source_match_id, canonical_id, confidence, method)
        resolved[(source, source_match_id)] = canonical_id

    print(
        f"  [resolution] Matches: {counts['exact']} exact, "
        f"{counts['date_only']} date-only, "
        f"{counts['new']} created, "
        f"{counts['stubs']} opponent stubs, "
        f"{counts['skipped']} skipped  "
        f"({len(resolved)} total mapped)"
    )
    return resolved


# ===========================================================================
# Convenience
# ===========================================================================

def resolve_all(sources: list[str] | None = None) -> tuple[dict, dict, dict]:
    """
    Full resolution pass for all sources.
    Returns (player_map, tournament_map, match_map).
    Order matters: matches depend on players + tournaments.
    """
    player_map     = resolve_players(sources)
    tournament_map = resolve_tournaments(sources)
    match_map      = resolve_matches(player_map, tournament_map, sources)
    return player_map, tournament_map, match_map