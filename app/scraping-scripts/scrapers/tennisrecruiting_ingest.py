"""
scrapers/tennisrecruiting_ingest.py
====================================
Writes raw scrape payloads into the raw.* layer only.
No canonical resolution happens here — that's handled by resolution.py.

Public API
----------
    ingest_player_profile(source_id: int) -> str   # returns raw.players UUID
    ingest_homepage_rankings()             -> int   # returns row count
"""

import time
from datetime import datetime, timezone

from tennis_recruiting_profile import parse_profile, parse_activity
from tennis_recruiting_top10 import fetch_from_web, parse_rankings
from db.client import supabase

_FETCH_DELAY = 2.0
_SOURCE = "tennisrecruiting.net"
_BASE_URL = "https://www.tennisrecruiting.net"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _upsert_raw_player(source_id: int, raw_json: dict, source_url: str) -> str:
    """
    Insert or update a row in raw.players.
    Returns the raw.players UUID.
    Uniqueness: (source, source_id) — one canonical raw row per player per source.
    Each re-scrape overwrites raw_json and bumps scraped_at.
    """
    row = {
        "source":     _SOURCE,
        "source_id":  str(source_id),
        "source_url": source_url,
        "raw_json":   raw_json,
        "scraped_at": _now(),
    }
    result = (
        supabase.schema("raw").table("players")
        .upsert(row, on_conflict="source,source_id")
        .execute()
    )
    return result.data[0]["id"]


def _upsert_raw_tournament(match: dict) -> None:
    """
    Write one raw tournament row from a match dict produced by parse_activity.
    Uniqueness: (source, source_tournament_id) where we use name|start_date as
    the source_tournament_id since tennisrecruiting has no numeric tournament ID.
    """
    name  = match.get("tournament_name")
    start = match.get("tournament_start")
    if not name:
        return

    source_tournament_id = f"{(name or '').strip().upper()}|{start or ''}"

    row = {
        "source":               _SOURCE,
        "source_tournament_id": source_tournament_id,
        "raw_json": {
            "name":      name,
            "start":     start,
            "end":       match.get("tournament_end"),
            "location":  match.get("tournament_location"),
            "draw_type": match.get("draw_type"),
        },
        "scraped_at": _now(),
    }
    supabase.schema("raw").table("tournaments").upsert(
        row, on_conflict="source,source_tournament_id"
    ).execute()


def _insert_raw_match(match: dict, raw_player_id: str) -> None:
    """
    Write one raw match row. We use player_source_id + opponent_source_id +
    tournament key + score as a natural dedup key via the unique constraint on
    (source, source_match_id).

    source_match_id is a composite we build here since the site has no match ID.
    """
    player_sid  = match["_player_source_id"]
    opp_sid     = match.get("_opponent_source_id", "unknown")
    t_name      = (match.get("tournament_name") or "").strip().upper()
    t_start     = match.get("tournament_start") or ""
    score       = (match.get("score") or "").replace(" ", "")

    source_match_id = f"{player_sid}|{opp_sid}|{t_name}|{t_start}|{score}"

    row = {
        "source":          _SOURCE,
        "source_match_id": source_match_id,
        "raw_json": {
            # player references
            "player_source_id":   player_sid,
            "opponent_source_id": opp_sid,
            "opponent_name":      match.get("opponent_name"),
            # match details
            "outcome":     match["outcome"],
            "score":       match["score"],
            "round":       match.get("round"),
            "best_of":     match.get("best_of"),
            "status":      match["status"],
            "played_at":   match.get("played_at"),
            # tournament context
            "tournament_name":     match.get("tournament_name"),
            "tournament_start":    match.get("tournament_start"),
            "tournament_end":      match.get("tournament_end"),
            "tournament_location": match.get("tournament_location"),
            "draw_type":           match.get("draw_type"),
            "results_url":         match.get("results_url"),
        },
        "scraped_at": _now(),
    }
    supabase.schema("raw").table("matches").upsert(
        row, on_conflict="source,source_match_id"
    ).execute()


def _insert_raw_rankings(rankings: list[dict], source_id: int) -> None:
    """
    Write ranking snapshots for one player into raw.rankings.
    Each row is uniquely identified by (source, source_player_id, ranking_type, ranking_date).
    """
    rows = []
    for r in rankings:
        rows.append({
            "source":            _SOURCE,
            "source_player_id":  str(source_id),
            "ranking_type":      r["source"],       # e.g. "tennisrecruiting_crl", "UTR"
            "rank_value":        r.get("ranking") or r.get("rating"),
            "ranking_date":      r["ranking_date"],
            "raw_json":          r.get("raw_data") or {},
            "scraped_at":        _now(),
        })
    if rows:
        supabase.schema("raw").table("rankings").upsert(
            rows,
            on_conflict="source,source_player_id,ranking_type,ranking_date",
        ).execute()


# ---------------------------------------------------------------------------
# Public: profile ingestion
# ---------------------------------------------------------------------------

def ingest_player_profile(source_id: int) -> str:
    """
    Fetch + parse one player profile and activity page.
    Writes to: raw.players, raw.matches, raw.rankings, raw.tournaments
    Returns the raw.players UUID for this player.
    """
    profile_url  = f"{_BASE_URL}/player.asp?id={source_id}"
    activity_url = f"{_BASE_URL}/player/activity.asp?id={source_id}"

    profile_soup = fetch_from_web(profile_url)
    time.sleep(_FETCH_DELAY)
    activity_soup = fetch_from_web(activity_url)

    data = parse_profile(profile_soup)
    data["match_results"] = parse_activity(activity_soup, source_id)

    # ------------------------------------------------------------------
    # raw.players — full parsed payload as raw_json
    # ------------------------------------------------------------------
    raw_json = {
        "player":       data["player"],
        "player_extra": data["player_extra"],
        "aliases":      data["aliases"],
    }
    raw_player_id = _upsert_raw_player(source_id, raw_json, profile_url)

    # ------------------------------------------------------------------
    # raw.rankings
    # ------------------------------------------------------------------
    _insert_raw_rankings(data["rankings"], source_id)

    # ------------------------------------------------------------------
    # raw.tournaments + raw.matches
    # ------------------------------------------------------------------
    for match in data["match_results"]:
        _upsert_raw_tournament(match)
        _insert_raw_match(match, raw_player_id)

    player_name = data["player"].get("full_name", "?")
    n_matches   = len(data["match_results"])
    n_rankings  = len(data["rankings"])
    print(
        f"  [{source_id}] {player_name:30s} "
        f"| {n_matches:2d} matches  "
        f"| {n_rankings:2d} rankings  -> raw layer"
    )

    return raw_player_id


# ---------------------------------------------------------------------------
# Public: homepage top-10 rankings ingestion
# ---------------------------------------------------------------------------

def ingest_homepage_rankings() -> int:
    """
    Scrape the homepage top-10 rankings and write to raw.rankings.
    source_player_id here is the tennisrecruiting integer ID embedded in the
    profile URL — same key used by ingest_player_profile.
    """
    import re

    soup    = fetch_from_web(f"{_BASE_URL}/")
    results = parse_rankings(soup)
    today   = datetime.now(timezone.utc).date().isoformat()

    rows = []
    for rank_type, years in results.items():
        for year, data in years.items():
            for gender in ("boys", "girls"):
                for rank, name, url in data.get(gender, []):
                    m = re.search(r"[?&]id=(\d+)", url)
                    if not m:
                        print(f"  [!] No source ID in URL for {name} — skipping")
                        continue
                    source_player_id = m.group(1)
                    ranking_type = f"tennisrecruiting_{rank_type.lower()}_{year}_{gender}"
                    rows.append({
                        "source":            _SOURCE,
                        "source_player_id":  source_player_id,
                        "ranking_type":      ranking_type,
                        "rank_value":        float(rank),
                        "ranking_date":      today,
                        "raw_json": {
                            "rank_type":   rank_type,
                            "class_year":  year,
                            "gender":      gender,
                            "player_name": name,
                            "profile_url": url,
                        },
                        "scraped_at": _now(),
                    })

    if rows:
        supabase.schema("raw").table("rankings").upsert(
            rows,
            on_conflict="source,source_player_id,ranking_type,ranking_date",
        ).execute()

    return len(rows)