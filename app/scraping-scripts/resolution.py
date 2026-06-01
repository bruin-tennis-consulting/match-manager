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

_BATCH_SIZE = 500  # Max rows per upsert batch (Supabase/PostgREST safe limit)

# Schema-scoped table accessors
_raw        = lambda t: supabase.schema("raw").table(t)
_resolution = lambda t: supabase.schema("resolution").table(t)
_canonical  = lambda t: supabase.schema("canonical").table(t)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


def _batch_upsert(table_fn, rows: list[dict], on_conflict: str) -> list[dict]:
    """Upsert rows in chunks; return all inserted/updated records."""
    results = []
    for i in range(0, len(rows), _BATCH_SIZE):
        chunk = rows[i : i + _BATCH_SIZE]
        res = table_fn().upsert(chunk, on_conflict=on_conflict).execute()
        results.extend(res.data or [])
    return results


def _batch_insert(table_fn, rows: list[dict]) -> list[dict]:
    """Insert rows in chunks; return all inserted records (with server-assigned IDs)."""
    results = []
    for i in range(0, len(rows), _BATCH_SIZE):
        chunk = rows[i : i + _BATCH_SIZE]
        res = table_fn().insert(chunk).execute()
        results.extend(res.data or [])
    return results


# ---------------------------------------------------------------------------
# External ID extraction — per-source mapping
# ---------------------------------------------------------------------------

_TR_BASE_URL = "https://www.tennisrecruiting.net"
_TR_NO_PHOTO = "/img/nophoto.gif"


def _extract_image_url(source: str, raw_json: dict) -> str | None:
    if source != "tennisrecruiting.net":
        return None
    photo = (raw_json.get("player_extra") or {}).get("photo_path")
    if photo and photo != _TR_NO_PHOTO:
        return f"{_TR_BASE_URL}{photo}"
    return None


def _extract_external_ids(source: str, raw_json: dict) -> dict[str, str | None]:
    extra  = raw_json.get("player_extra", {})
    player = raw_json.get("player", {})

    if source == "tennisrecruiting.net":
        return {
            "utr_id":  str(extra["utr_id"])    if extra.get("utr_id")    else None,
            "usta_id": str(extra["usta_uaid"]) if extra.get("usta_uaid") else None,
        }
    if source == "UTR":
        return {
            "utr_id":  str(player["_source_id"]) if player.get("_source_id") else None,
            "usta_id": None,
        }
    if source == "USTA":
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


def _match_player(
    source: str, raw_json: dict, canonical_players: list[dict],
    utr_index: dict[str, dict],
    usta_index: dict[str, dict],
    name_gender_index: dict[tuple[str, str], dict],
    name_gender_year_index: dict[tuple[str, str, str | None], dict],
) -> tuple[str | None, float, str]:
    """
    Try to find an existing canonical player for a raw record.
    Uses pre-built indexes for O(1) lookups instead of O(n) scans.
    Returns (canonical_id | None, confidence, method).
    """
    p         = raw_json.get("player", {})
    name      = (p.get("full_name") or "").strip()
    grad_year = p.get("grad_year")
    gender    = p.get("gender")
    ids       = _extract_external_ids(source, raw_json)
    utr_id    = ids.get("utr_id")
    usta_id   = ids.get("usta_id")

    # 1. External ID — O(1)
    if utr_id and utr_id in utr_index:
        return utr_index[utr_id]["id"], 1.0, "exact_external_id"
    if usta_id and usta_id in usta_index:
        return usta_index[usta_id]["id"], 1.0, "exact_external_id"

    if not name:
        return None, 0.0, "no_name"

    name_lower = name.lower()

    # 2. Exact name + grad_year + gender — O(1)
    if grad_year:
        canon = name_gender_year_index.get((name_lower, gender, str(grad_year)))
        if canon:
            return canon["id"], 0.95, "exact_name_grad_year"

    # 3. Exact name + gender — O(1)
    canon = name_gender_index.get((name_lower, gender))
    if canon:
        return canon["id"], 0.85, "exact_name_gender"

    # 4. Fuzzy name — still O(n) within same gender/year bucket, unavoidable
    best_score, best_id = 0.0, None
    for canon in canonical_players:
        if canon.get("gender") != gender:
            continue
        if grad_year and canon.get("grad_year") and str(canon.get("grad_year")) != str(grad_year):
            continue
        sim = _similarity(name, canon.get("full_name") or "")
        if sim > best_score:
            best_score, best_id = sim, canon["id"]

    if best_id and best_score >= 0.85:
        return best_id, round(best_score * 0.9, 4), "fuzzy_name"

    return None, 0.0, "no_match"


def _build_player_indexes(
    canonical_players: list[dict],
) -> tuple[dict, dict, dict, dict]:
    """Build O(1) lookup indexes over canonical players."""
    utr_index:             dict[str, dict] = {}
    usta_index:            dict[str, dict] = {}
    name_gender_index:     dict[tuple[str, str], dict] = {}
    name_gender_year_index: dict[tuple[str, str, str | None], dict] = {}

    for c in canonical_players:
        if c.get("utr_id"):
            utr_index[str(c["utr_id"])] = c
        if c.get("usta_id"):
            usta_index[str(c["usta_id"])] = c
        name_lower = (c.get("full_name") or "").strip().lower()
        gender     = c.get("gender")
        if name_lower:
            name_gender_index[(name_lower, gender)] = c
            grad_year = str(c["grad_year"]) if c.get("grad_year") else None
            name_gender_year_index[(name_lower, gender, grad_year)] = c

    return utr_index, usta_index, name_gender_index, name_gender_year_index


def resolve_players(sources: list[str] | None = None) -> dict[tuple[str, str], str]:
    """
    Resolve all unresolved raw.players rows for the given sources.
    Returns {(source, source_id): canonical_uuid}.
    """
    sources  = sources or ALL_SOURCES
    existing = _load_existing_player_mappings(sources)

    raw_rows   = fetch_all("raw", "players", "source,source_id,raw_json", ("source", sources))
    unresolved = [r for r in raw_rows if (r["source"], r["source_id"]) not in existing]

    if not unresolved:
        print(f"  [resolution] Players: nothing new  ({len(existing)} already mapped)")
        return existing

    canonical_players = _load_canonical_players()
    indexes           = _build_player_indexes(canonical_players)
    resolved          = dict(existing)
    counts            = {"matched": 0, "new": 0}

    # --- Phase 1: match all rows against existing canonical players ---
    to_create:   list[dict] = []   # rows that need a new canonical player
    to_create_meta: list[dict] = []  # parallel metadata for mapping construction
    mapping_rows: list[dict] = []  # rows ready to upsert into resolution.player_mappings

    for row in unresolved:
        source, source_id, raw_json = row["source"], row["source_id"], row["raw_json"]
        alias = raw_json.get("player", {}).get("full_name")

        canonical_id, confidence, method = _match_player(source, raw_json, canonical_players, *indexes)

        if canonical_id is not None:
            # Collect external ID backfills (one update per matched canonical)
            ids = _extract_external_ids(source, raw_json)
            updates = {k: v for k, v in ids.items() if v is not None}
            if updates:
                updates["updated_at"] = _now()
                _canonical("players").update(updates).eq("id", canonical_id).execute()
            counts["matched"] += 1
            mapping_rows.append({
                "canonical_id": canonical_id,
                "source":       source,
                "source_id":    str(source_id),
                "alias_name":   alias,
                "confidence":   confidence,
                "match_method": method,
                "created_at":   _now(),
            })
            resolved[(source, source_id)] = canonical_id
        else:
            to_create.append(raw_json)
            to_create_meta.append({"source": source, "source_id": source_id, "alias": alias})

    # --- Phase 2: batch-insert new canonical players ---
    if to_create:
        insert_payloads = []
        for raw_json, meta in zip(to_create, to_create_meta):
            source = meta["source"]
            p      = raw_json.get("player", {})
            extra  = raw_json.get("player_extra", {})
            ids    = _extract_external_ids(source, raw_json)
            insert_payloads.append({
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
                "city":          extra.get("city"),
                "state":         extra.get("state_code"),
                "high_school":   extra.get("highschool"),
                "committed_to":  extra.get("committed_to"),
                "stars":         extra.get("stars"),
                "academy":       extra.get("academy"),
                "international": extra.get("international"),
                "video_urls":    extra.get("video_urls") or None,
                "image_url":     _extract_image_url(source, raw_json),
                "created_at":    _now(),
                "updated_at":    _now(),
            })

        inserted = _batch_insert(lambda: _canonical("players"), insert_payloads)
        counts["new"] = len(inserted)

        # Re-index with newly inserted rows
        canonical_players.extend(inserted)
        indexes = _build_player_indexes(canonical_players)

        for new_row, meta in zip(inserted, to_create_meta):
            canonical_id = new_row["id"]
            mapping_rows.append({
                "canonical_id": canonical_id,
                "source":       meta["source"],
                "source_id":    str(meta["source_id"]),
                "alias_name":   meta["alias"],
                "confidence":   1.0,
                "match_method": "new",
                "created_at":   _now(),
            })
            resolved[(meta["source"], meta["source_id"])] = canonical_id

    # --- Phase 3: batch-upsert all mappings in one go ---
    if mapping_rows:
        _batch_upsert(lambda: _resolution("player_mappings"), mapping_rows, "source,source_id")

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


def resolve_tournaments(sources: list[str] | None = None) -> dict[tuple[str, str], str]:
    """
    Resolve all unresolved raw.tournaments rows for the given sources.
    Returns {(source, source_tournament_id): canonical_uuid}.
    """
    sources  = sources or ALL_SOURCES
    existing = _load_existing_tournament_mappings(sources)

    raw_rows   = fetch_all("raw", "tournaments", "source,source_tournament_id,raw_json", ("source", sources))
    unresolved = [
        r for r in raw_rows
        if (r["source"], r["source_tournament_id"]) not in existing
    ]

    if not unresolved:
        print(f"  [resolution] Tournaments: nothing new  ({len(existing)} already mapped)")
        return existing

    canonical_tournaments = fetch_all("canonical", "tournaments")
    # Build O(1) index: (name_lower, start_date) -> canonical row
    canon_t_index: dict[tuple[str, str], dict] = {
        ((c.get("name") or "").strip().lower(), c.get("start_date") or ""): c
        for c in canonical_tournaments
    }

    resolved     = dict(existing)
    counts       = {"matched": 0, "new": 0}
    to_create:   list[dict] = []
    to_create_meta: list[dict] = []
    mapping_rows: list[dict] = []

    for row in unresolved:
        source    = row["source"]
        source_id = row["source_tournament_id"]
        raw_json  = row["raw_json"]
        name      = (raw_json.get("name") or "").strip()
        start     = raw_json.get("start") or ""

        canon = canon_t_index.get((name.lower(), start))
        if canon:
            canonical_id = canon["id"]
            counts["matched"] += 1
            mapping_rows.append({
                "canonical_id": canonical_id,
                "source":       source,
                "source_id":    source_id,
                "confidence":   1.0,
                "match_method": "exact",
                "created_at":   _now(),
            })
            resolved[(source, source_id)] = canonical_id
        else:
            to_create.append(raw_json)
            to_create_meta.append({"source": source, "source_id": source_id})

    if to_create:
        insert_payloads = [
            {
                "name":       rj.get("name"),
                "start_date": rj.get("start"),
                "end_date":   rj.get("end"),
                "location":   rj.get("location"),
                "level":      _infer_tournament_level(rj.get("name")),
                "source":     meta["source"],
                "created_at": _now(),
            }
            for rj, meta in zip(to_create, to_create_meta)
        ]
        inserted = _batch_insert(lambda: _canonical("tournaments"), insert_payloads)
        counts["new"] = len(inserted)

        for new_t, meta in zip(inserted, to_create_meta):
            canonical_id = new_t["id"]
            mapping_rows.append({
                "canonical_id": canonical_id,
                "source":       meta["source"],
                "source_id":    meta["source_id"],
                "confidence":   1.0,
                "match_method": "new",
                "created_at":   _now(),
            })
            resolved[(meta["source"], meta["source_id"])] = canonical_id
            # Keep index fresh for any duplicate names within the same batch
            canon_t_index[((new_t.get("name") or "").strip().lower(), new_t.get("start_date") or "")] = new_t

    if mapping_rows:
        _batch_upsert(lambda: _resolution("tournament_mappings"), mapping_rows, "source,source_id")

    print(
        f"  [resolution] Tournaments: {counts['matched']} matched, "
        f"{counts['new']} created  ({len(resolved)} total mapped)"
    )
    return resolved


# ===========================================================================
# MATCHES
# ===========================================================================

def _scores_compatible(a: str | None, b: str | None) -> bool:
    if not a or not b:
        return False
    def _strip(s: str) -> str:
        s = re.sub(r"\(\d+\)", "", s)
        s = re.sub(r"[\s;,]+", " ", s.strip())
        return s.lower()
    return _strip(a) == _strip(b)


def _parse_sets(score: str | None) -> list[dict] | None:
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
    return (min(pid, oid), max(pid, oid), (date or "")[:10])


def _load_existing_match_mappings(sources: list[str]) -> dict[tuple[str, str], str]:
    result = (
        _resolution("match_mappings")
        .select("source,source_match_id,canonical_id")
        .in_("source", sources)
        .execute()
    )
    return {(r["source"], r["source_match_id"]): r["canonical_id"] for r in (result.data or [])}


def _resolve_stubs_batch(
    stub_requests: list[dict],
    player_map: dict[tuple[str, str], str],
) -> None:
    """
    Batch-create canonical player stubs for unknown opponents and update player_map in-place.
    stub_requests: list of {"source", "source_id", "name"} dicts (source_id may be None).
    """
    # De-duplicate by (source, source_id) — multiple matches may reference the same unknown opponent
    seen:    dict[tuple, dict] = {}
    no_sid:  list[dict] = []

    for req in stub_requests:
        source, sid, name = req["source"], req["source_id"], req["name"]
        sid_str = str(sid) if sid else None
        if sid_str:
            key = (source, sid_str)
            if key not in player_map and key not in seen:
                seen[key] = req
        elif name:
            no_sid.append(req)

    # DB lookup for those with a source_id — one query per source
    by_source: dict[str, list[str]] = defaultdict(list)
    for (source, sid_str) in seen:
        by_source[source].append(sid_str)

    # This query needs both .eq("source") AND .in_("source_id"), which fetch_all
    # can't express. Do it directly, chunking source_id to stay under PostgREST's
    # URL length limit (same _IN_CHUNK logic that lives in fetch_all).
    _IN_CHUNK = 50
    already_in_db: dict[tuple[str, str], str] = {}
    for source, sid_list in by_source.items():
        for i in range(0, len(sid_list), _IN_CHUNK):
            chunk = sid_list[i : i + _IN_CHUNK]
            res = (
                _resolution("player_mappings")
                .select("source_id,canonical_id")
                .eq("source", source)
                .in_("source_id", chunk)
                .execute()
            )
            for r in res.data or []:
                already_in_db[(source, r["source_id"])] = r["canonical_id"]

    to_insert_stubs: list[dict] = []
    to_insert_meta:  list[dict] = []

    for (source, sid_str), req in seen.items():
        if (source, sid_str) in already_in_db:
            player_map[(source, sid_str)] = already_in_db[(source, sid_str)]
        else:
            parts = (req["name"] or "").strip().split(None, 1)
            to_insert_stubs.append({
                "full_name":  req["name"],
                "first_name": parts[0] if parts else None,
                "last_name":  parts[1] if len(parts) > 1 else None,
                "created_at": _now(),
                "updated_at": _now(),
            })
            to_insert_meta.append({"source": source, "source_id": sid_str, "name": req["name"]})

    # Name-only stubs (no source_id) — always insert
    for req in no_sid:
        parts = (req["name"] or "").strip().split(None, 1)
        to_insert_stubs.append({
            "full_name":  req["name"],
            "first_name": parts[0] if parts else None,
            "last_name":  parts[1] if len(parts) > 1 else None,
            "created_at": _now(),
            "updated_at": _now(),
        })
        to_insert_meta.append({"source": req["source"], "source_id": None, "name": req["name"]})

    if not to_insert_stubs:
        return

    inserted = _batch_insert(lambda: _canonical("players"), to_insert_stubs)

    mapping_rows: list[dict] = []
    for new_p, meta in zip(inserted, to_insert_meta):
        canonical_id = new_p["id"]
        if meta["source_id"]:
            player_map[(meta["source"], meta["source_id"])] = canonical_id
            mapping_rows.append({
                "canonical_id": canonical_id,
                "source":       meta["source"],
                "source_id":    meta["source_id"],
                "alias_name":   meta["name"],
                "confidence":   0.7,
                "match_method": "stub",
                "created_at":   _now(),
            })

    if mapping_rows:
        _batch_upsert(lambda: _resolution("player_mappings"), mapping_rows, "source,source_id")


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

    raw_rows   = fetch_all("raw", "matches", "source,source_match_id,raw_json", ("source", sources))
    unresolved = [
        r for r in raw_rows
        if (r["source"], r["source_match_id"]) not in existing
    ]

    if not unresolved:
        print(f"  [resolution] Matches: nothing new  ({len(existing)} already mapped)")
        return existing

    # Build canonical match index
    canon_rows = fetch_all("canonical", "matches")
    canon_index: dict[tuple, list[dict]] = defaultdict(list)
    for c in canon_rows:
        pid, oid, date = c.get("player_id"), c.get("opponent_id"), c.get("played_at")
        if pid and oid and date:
            canon_index[_make_match_key(pid, oid, date)].append(c)

    resolved = dict(existing)
    counts   = {"exact": 0, "date_only": 0, "new": 0, "skipped": 0, "stubs": 0}

    # --- Pass 1: collect all rows needing opponent stubs ---
    stub_requests: list[dict] = []
    for row in unresolved:
        rj       = row["raw_json"]
        source   = row["source"]
        opp_raw  = rj.get("opponent_source_id")
        opp_name = rj.get("opponent_name")
        player_id = player_map.get((source, str(rj.get("player_source_id", ""))))

        if not player_id:
            continue  # will be skipped in pass 2
        if opp_raw and not player_map.get((source, str(opp_raw))):
            stub_requests.append({"source": source, "source_id": opp_raw, "name": opp_name})
        elif not opp_raw and opp_name:
            stub_requests.append({"source": source, "source_id": None, "name": opp_name})

    # Batch-create all missing opponent stubs in one round-trip cluster
    if stub_requests:
        _resolve_stubs_batch(stub_requests, player_map)
        counts["stubs"] = len(stub_requests)

    # --- Pass 2: classify each row as matched / new ---
    to_insert_matches: list[dict] = []
    to_insert_meta:    list[dict] = []
    mapping_rows:      list[dict] = []

    for row in unresolved:
        source          = row["source"]
        source_match_id = row["source_match_id"]
        rj              = row["raw_json"]

        player_id   = player_map.get((source, str(rj.get("player_source_id", ""))))
        opp_raw     = rj.get("opponent_source_id")
        opponent_id = player_map.get((source, str(opp_raw))) if opp_raw else None

        if not player_id:
            counts["skipped"] += 1
            continue

        played_at  = rj.get("played_at")
        raw_score  = rj.get("score")
        lookup_key = _make_match_key(player_id, opponent_id, played_at) if opponent_id else None
        canonical_id = None
        confidence   = 1.0
        method       = "new"

        if lookup_key:
            candidates = canon_index.get(lookup_key, [])
            for candidate in candidates:
                if _scores_compatible(raw_score, candidate.get("score")):
                    canonical_id = candidate["id"]
                    confidence   = 1.0
                    method       = "same_players_date_score"
                    counts["exact"] += 1
                    break
            if canonical_id is None and candidates:
                canonical_id = candidates[0]["id"]
                confidence   = 0.9
                method       = "same_players_date"
                counts["date_only"] += 1

        if canonical_id is not None:
            mapping_rows.append({
                "canonical_id":    canonical_id,
                "source":          source,
                "source_match_id": source_match_id,
                "confidence":      confidence,
                "match_method":    method,
                "created_at":      _now(),
            })
            resolved[(source, source_match_id)] = canonical_id
        else:
            # Needs a new canonical match — collect for batch insert
            outcome   = rj.get("outcome")
            winner_id = player_id if outcome == "win" else (opponent_id or None)
            t_name    = (rj.get("tournament_name") or "").strip().upper()
            t_start   = rj.get("tournament_start") or ""
            tournament_id = tournament_map.get((source, f"{t_name}|{t_start}"))

            to_insert_matches.append({
                "player_id":     player_id,
                "opponent_id":   opponent_id,
                "winner_id":     winner_id,
                "tournament_id": tournament_id,
                "outcome":       outcome,
                "score":         raw_score,
                "sets":          _parse_sets(raw_score),
                "round":         rj.get("round"),
                "best_of":       rj.get("best_of"),
                "status":        rj.get("status", "completed"),
                "source":        source,
                "played_at":     played_at,
                "ingested_at":   _now(),
            })
            to_insert_meta.append({
                "source":          source,
                "source_match_id": source_match_id,
                "player_id":       player_id,
                "opponent_id":     opponent_id,
                "played_at":       played_at,
            })

    # --- Pass 3: batch-insert new canonical matches ---
    if to_insert_matches:
        inserted = _batch_insert(lambda: _canonical("matches"), to_insert_matches)
        counts["new"] = len(inserted)

        for new_m, meta in zip(inserted, to_insert_meta):
            canonical_id = new_m["id"]
            mapping_rows.append({
                "canonical_id":    canonical_id,
                "source":          meta["source"],
                "source_match_id": meta["source_match_id"],
                "confidence":      1.0,
                "match_method":    "new",
                "created_at":      _now(),
            })
            resolved[(meta["source"], meta["source_match_id"])] = canonical_id
            # Keep canon_index up-to-date for intra-batch deduplication
            pid  = meta["player_id"]
            oid  = meta["opponent_id"]
            date = meta["played_at"]
            if pid and oid and date:
                canon_index[_make_match_key(pid, oid, date)].append(new_m)

    # --- Pass 4: batch-upsert all mappings ---
    if mapping_rows:
        _batch_upsert(lambda: _resolution("match_mappings"), mapping_rows, "source,source_match_id")

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