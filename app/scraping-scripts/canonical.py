"""
canonical.py
============
Reads from raw schema and enriches canonical schema records.

canonical.players, canonical.tournaments, and canonical.matches stubs are
created by resolution.py as a side effect of entity matching. This module:

  promote_rankings — reads raw.rankings, resolves to canonical player UUIDs
                     via player_map, upserts into canonical.player_rankings.

  promote_matches  — reads raw.matches, resolves to canonical match UUIDs
                     via match_map, then fills any null fields on the stub
                     that the first source left empty (sets, round, best_of).
                     Never overwrites fields that are already populated.

Flow:
    raw.rankings  + player_map -> canonical.player_rankings  (upsert)
    raw.matches   + match_map  -> canonical.matches          (enrich nulls only)

Public API
----------
    promote_rankings(player_map)                        -> int
    promote_matches(match_map)                          -> int
    promote_all(player_map, tournament_map, match_map)  -> dict
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

from db.client import supabase

_RATING_SOURCES = {"UTR", "WTN"}

_raw       = lambda t: supabase.schema("raw").table(t)
_canonical = lambda t: supabase.schema("canonical").table(t)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


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


# ---------------------------------------------------------------------------
# Rankings
# ---------------------------------------------------------------------------

def promote_rankings(player_map: dict[tuple[str, str], str]) -> int:
    """
    Upsert raw.rankings rows into canonical.player_rankings.
    player_map: {(source, source_player_id) -> canonical_uuid}
    """
    raw_rows = _raw("rankings").select("*").execute().data or []

    rows    = []
    skipped = 0

    for r in raw_rows:
        canonical_id = player_map.get((r["source"], str(r["source_player_id"])))
        if not canonical_id:
            skipped += 1
            continue

        rank_value   = r.get("rank_value")
        ranking_type = r["ranking_type"]
        is_rating    = any(s in ranking_type for s in _RATING_SOURCES)

        rows.append({
            "player_id":    canonical_id,
            "ranking_type": ranking_type,
            "ranking":      None if is_rating else (int(rank_value) if rank_value is not None else None),
            "rank_value":   rank_value,
            "ranking_date": r["ranking_date"],
            "source":       r["source"],
            "ingested_at":  _now(),
        })

    if rows:
        # Deduplicate by the conflict key before sending — multiple raw rows
        # (e.g. homepage scrape + profile scrape) can target the same
        # (player_id, ranking_type, ranking_date). Last one wins.
        deduped = {
            (r["player_id"], r["ranking_type"], r["ranking_date"]): r
            for r in rows
        }.values()
        _canonical("player_rankings").upsert(
            list(deduped),
            on_conflict="player_id,ranking_type,ranking_date",
        ).execute()

    print(f"  [canonical] Rankings: {len(rows)} upserted, {skipped} skipped (unmapped player)")
    return len(rows)


# ---------------------------------------------------------------------------
# Matches
# ---------------------------------------------------------------------------

def promote_matches(match_map: dict[tuple[str, str], str]) -> int:
    """
    Enrich canonical.matches stubs that were created by resolve_matches().

    For each raw match row, look up its canonical stub via match_map and fill
    in any fields that are currently null (sets, round, best_of). We never
    overwrite fields that are already populated — the first source to report
    a match wins on data fields.

    Fetches all relevant canonical rows in one query to avoid N+1 lookups.
    match_map: {(source, source_match_id) -> canonical_uuid}
    """
    if not match_map:
        print("  [canonical] Matches: no match_map — skipping")
        return 0

    raw_rows = _raw("matches").select("*").execute().data or []

    # Collect the set of canonical UUIDs we actually need to fetch
    canonical_ids_needed = {
        match_map[(r["source"], r["source_match_id"])]
        for r in raw_rows
        if (r["source"], r["source_match_id"]) in match_map
    }

    if not canonical_ids_needed:
        print("  [canonical] Matches: no mapped rows to enrich")
        return 0

    # Fetch all relevant canonical rows in one query
    existing_rows = (
        _canonical("matches")
        .select("id,sets,round,best_of")
        .in_("id", list(canonical_ids_needed))
        .execute()
        .data or []
    )
    current_by_id = {r["id"]: r for r in existing_rows}

    enriched = 0
    skipped  = 0

    for r in raw_rows:
        canonical_id = match_map.get((r["source"], r["source_match_id"]))
        if not canonical_id:
            skipped += 1
            continue

        current = current_by_id.get(canonical_id)
        if not current:
            skipped += 1
            continue

        rj      = r.get("raw_json", {})
        score   = rj.get("score")
        updates = {}

        if current.get("sets") is None and score:
            parsed = _parse_sets(score)
            if parsed:
                updates["sets"] = parsed

        if current.get("round") is None and rj.get("round"):
            updates["round"] = rj["round"]

        if current.get("best_of") is None and rj.get("best_of"):
            updates["best_of"] = rj["best_of"]

        if updates:
            _canonical("matches").update(updates).eq("id", canonical_id).execute()
            # Keep our in-memory view consistent so duplicate raw rows
            # don't re-enrich fields we just wrote
            current_by_id[canonical_id].update(updates)
            enriched += 1

    print(f"  [canonical] Matches: {enriched} enriched, {skipped} skipped")
    return enriched


# ---------------------------------------------------------------------------
# Convenience
# ---------------------------------------------------------------------------

def promote_all(
    player_map:     dict[tuple[str, str], str],
    tournament_map: dict[tuple[str, str], str],
    match_map:      dict[tuple[str, str], str],
) -> dict:
    n_rankings = promote_rankings(player_map)
    n_matches  = promote_matches(match_map)
    return {"rankings": n_rankings, "matches": n_matches}