"""
canonical.py
============
Reads from raw.* + resolution maps and upserts clean records into
canonical.player_rankings and canonical.matches.

canonical.players and canonical.tournaments are created as a side effect
of resolution.py, so this module only handles the dependent tables.

Public API
----------
    promote_rankings(player_map)               -> int
    promote_matches(player_map, tournament_map) -> int
    promote_all(player_map, tournament_map)    -> dict

Maps use (source, source_id) tuples as keys, matching resolution.py output.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

from db.client import supabase

_RATING_SOURCES = {"UTR", "WTN"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_sets(score: str | None) -> list[dict] | None:
    """
    Parse "6-4;3-6;7-5" or "6-4 3-6 7-5" into
    [{"p": 6, "o": 4}, {"p": 3, "o": 6}, {"p": 7, "o": 5}].
    Tiebreak notation "7-6(5)" -> {"p": 7, "o": 6, "tb": 5}.
    Returns None on any parse failure.
    """
    if not score:
        return None
    score = re.sub(r"[;,\s]+", " ", score.strip())
    sets  = []
    for s in score.split():
        tb_match = re.search(r"\((\d+)\)", s)
        tb = int(tb_match.group(1)) if tb_match else None
        s  = re.sub(r"\(\d+\)", "", s)
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
    raw_result = supabase.table("raw.rankings").select("*").execute()
    raw_rows   = raw_result.data or []

    rows    = []
    skipped = 0

    for r in raw_rows:
        key          = (r["source"], str(r["source_player_id"]))
        canonical_id = player_map.get(key)
        if not canonical_id:
            skipped += 1
            continue

        rank_value    = r.get("rank_value")
        ranking_type  = r["ranking_type"]
        is_rating_src = any(s in ranking_type for s in _RATING_SOURCES)

        rows.append({
            "player_id":    canonical_id,
            "ranking_type": ranking_type,
            # Integer rank position for ranking sources; None for pure rating sources
            "ranking":      None if is_rating_src else (int(rank_value) if rank_value is not None else None),
            "rank_value":   rank_value,
            "ranking_date": r["ranking_date"],
            "source":       r["source"],
            "ingested_at":  _now(),
        })

    if rows:
        supabase.table("canonical.player_rankings").upsert(
            rows,
            on_conflict="player_id,ranking_type,ranking_date",
        ).execute()

    print(f"  [canonical] Rankings: {len(rows)} upserted, {skipped} skipped (unmapped player)")
    return len(rows)


# ---------------------------------------------------------------------------
# Matches  (only TennisRecruiting has match data for now)
# ---------------------------------------------------------------------------

def promote_matches(
    player_map:     dict[tuple[str, str], str],
    tournament_map: dict[tuple[str, str], str],
) -> int:
    """
    Upsert raw.matches rows into canonical.matches.
    player_map:     {(source, source_player_id)    -> canonical_uuid}
    tournament_map: {(source, source_tournament_id) -> canonical_uuid}
    """
    raw_result = supabase.table("raw.matches").select("*").execute()
    raw_rows   = raw_result.data or []

    rows    = []
    skipped = 0

    for r in raw_rows:
        source = r["source"]
        rj     = r.get("raw_json", {})

        player_key  = (source, str(rj.get("player_source_id", "")))
        opp_raw_id  = rj.get("opponent_source_id")
        opp_key     = (source, str(opp_raw_id)) if opp_raw_id else None

        player_id   = player_map.get(player_key)
        opponent_id = player_map.get(opp_key) if opp_key else None

        if not player_id:
            skipped += 1
            continue

        outcome   = rj.get("outcome")
        winner_id = player_id if outcome == "win" else (opponent_id if opponent_id else None)

        t_name  = (rj.get("tournament_name") or "").strip().upper()
        t_start = rj.get("tournament_start") or ""
        t_key   = (source, f"{t_name}|{t_start}")
        tournament_id = tournament_map.get(t_key)

        rows.append({
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
        })

    if rows:
        supabase.table("canonical.matches").upsert(
            rows,
            on_conflict="player_id,opponent_id,played_at,score",
        ).execute()

    print(f"  [canonical] Matches: {len(rows)} upserted, {skipped} skipped (unmapped player)")
    return len(rows)


# ---------------------------------------------------------------------------
# Convenience
# ---------------------------------------------------------------------------

def promote_all(
    player_map:     dict[tuple[str, str], str],
    tournament_map: dict[tuple[str, str], str],
) -> dict:
    n_rankings = promote_rankings(player_map)
    n_matches  = promote_matches(player_map, tournament_map)
    return {"rankings": n_rankings, "matches": n_matches}