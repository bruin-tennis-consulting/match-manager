"""
scrapers/tennisrecruiting_ingest.py
====================================
Writes raw scrape payloads into the raw schema only.
No canonical resolution happens here — that is handled by resolution.py.

Flow: fetch -> parse -> raw.players / raw.rankings / raw.tournaments / raw.matches

Public API
----------
    ingest_player_profile(source_id: int) -> str   # returns raw.players UUID
    ingest_homepage_rankings()             -> int   # returns row count
"""

import re
import time
from datetime import datetime, timezone

from tennis_recruiting_profile import parse_profile, parse_activity
from tennis_recruiting_top10 import fetch_from_web, parse_rankings
from db.client import supabase

_FETCH_DELAY = 2.0
_SOURCE      = "tennisrecruiting.net"
_BASE_URL    = "https://www.tennisrecruiting.net"

# Schema-scoped table accessors
_raw = lambda table: supabase.schema("raw").table(table)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# raw.players
# ---------------------------------------------------------------------------

def _upsert_raw_player(source_id: int, raw_json: dict, source_url: str) -> str:
    """
    Upsert one row into raw.players.
    Uniqueness: (source, source_id) — one row per player per source.
    Re-scrapes overwrite raw_json and bump scraped_at.
    Returns the raw.players UUID.
    """
    result = _raw("players").upsert(
        {
            "source":     _SOURCE,
            "source_id":  str(source_id),
            "source_url": source_url,
            "raw_json":   raw_json,
            "scraped_at": _now(),
        },
        on_conflict="source,source_id",
    ).execute()
    return result.data[0]["id"]


# ---------------------------------------------------------------------------
# raw.rankings
# ---------------------------------------------------------------------------

def _upsert_raw_rankings(rankings: list[dict], source_id: int) -> None:
    """
    Write ranking snapshots for one player into raw.rankings.
    Uniqueness: (source, source_player_id, ranking_type, ranking_date).
    """
    rows = [
        {
            "source":           _SOURCE,
            "source_player_id": str(source_id),
            "ranking_type":     r["source"],        # e.g. "tennisrecruiting_crl", "UTR"
            "rank_value":       r.get("ranking") or r.get("rating"),
            "ranking_date":     r["ranking_date"],
            "raw_json":         r.get("raw_data") or {},
            "scraped_at":       _now(),
        }
        for r in rankings
    ]
    if rows:
        _raw("rankings").upsert(
            rows,
            on_conflict="source,source_player_id,ranking_type,ranking_date",
        ).execute()


# ---------------------------------------------------------------------------
# raw.tournaments
# ---------------------------------------------------------------------------

def _upsert_raw_tournament(match: dict) -> None:
    """
    Write one raw tournament row derived from a match dict.
    source_tournament_id = "NAME|start_date" (site has no numeric tournament ID).
    Uniqueness: (source, source_tournament_id).
    """
    name  = match.get("tournament_name")
    start = match.get("tournament_start")
    if not name:
        return

    _raw("tournaments").upsert(
        {
            "source":               _SOURCE,
            "source_tournament_id": f"{name.strip().upper()}|{start or ''}",
            "raw_json": {
                "name":      name,
                "start":     start,
                "end":       match.get("tournament_end"),
                "location":  match.get("tournament_location"),
                "draw_type": match.get("draw_type"),
            },
            "scraped_at": _now(),
        },
        on_conflict="source,source_tournament_id",
    ).execute()


# ---------------------------------------------------------------------------
# raw.matches
# ---------------------------------------------------------------------------

def _upsert_raw_match(match: dict) -> None:
    """
    Write one raw match row.
    source_match_id is a composite key — the site has no native match ID.
    Uniqueness: (source, source_match_id).
    """
    player_sid = match["_player_source_id"]
    opp_sid    = match.get("_opponent_source_id", "unknown")
    t_name     = (match.get("tournament_name") or "").strip().upper()
    t_start    = match.get("tournament_start") or ""
    score      = (match.get("score") or "").replace(" ", "")

    _raw("matches").upsert(
        {
            "source":          _SOURCE,
            "source_match_id": f"{player_sid}|{opp_sid}|{t_name}|{t_start}|{score}",
            "raw_json": {
                "player_source_id":    player_sid,
                "opponent_source_id":  opp_sid,
                "opponent_name":       match.get("opponent_name"),
                "outcome":             match["outcome"],
                "score":               match["score"],
                "round":               match.get("round"),
                "best_of":             match.get("best_of"),
                "status":              match["status"],
                "played_at":           match.get("played_at"),
                "tournament_name":     match.get("tournament_name"),
                "tournament_start":    match.get("tournament_start"),
                "tournament_end":      match.get("tournament_end"),
                "tournament_location": match.get("tournament_location"),
                "draw_type":           match.get("draw_type"),
                "results_url":         match.get("results_url"),
            },
            "scraped_at": _now(),
        },
        on_conflict="source,source_match_id",
    ).execute()


# ---------------------------------------------------------------------------
# Public: profile ingestion
# ---------------------------------------------------------------------------

def ingest_player_profile(source_id: int) -> str:
    """
    Fetch + parse one player profile and activity page.
    Writes to: raw.players, raw.rankings, raw.tournaments, raw.matches
    Returns the raw.players UUID.
    """
    profile_url  = f"{_BASE_URL}/player.asp?id={source_id}"
    activity_url = f"{_BASE_URL}/player/activity.asp?id={source_id}"

    profile_soup  = fetch_from_web(profile_url)
    time.sleep(_FETCH_DELAY)
    activity_soup = fetch_from_web(activity_url)

    data = parse_profile(profile_soup)
    data["match_results"] = parse_activity(activity_soup, source_id)

    # raw.players
    raw_player_id = _upsert_raw_player(
        source_id,
        raw_json={
            "player":       data["player"],
            "player_extra": data["player_extra"],
            "aliases":      data["aliases"],
        },
        source_url=profile_url,
    )

    # raw.rankings
    _upsert_raw_rankings(data["rankings"], source_id)

    # raw.tournaments + raw.matches
    for match in data["match_results"]:
        _upsert_raw_tournament(match)
        _upsert_raw_match(match)

    print(
        f"  [{source_id}] {data['player'].get('full_name', '?'):30s}"
        f" | {len(data['match_results']):2d} matches"
        f" | {len(data['rankings']):2d} rankings  -> raw"
    )
    return raw_player_id


# ---------------------------------------------------------------------------
# Public: homepage top-10 rankings ingestion
# ---------------------------------------------------------------------------

def ingest_homepage_rankings() -> int:
    """
    Scrape the homepage top-10 rankings and write to raw.rankings.
    Uses the same source_player_id (tennisrecruiting integer ID) as
    ingest_player_profile so rows join correctly in the resolution layer.
    """
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
                    rows.append({
                        "source":           _SOURCE,
                        "source_player_id": m.group(1),
                        "ranking_type":     f"tennisrecruiting_{rank_type.lower()}_{year}_{gender}",
                        "rank_value":       float(rank),
                        "ranking_date":     today,
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
        _raw("rankings").upsert(
            rows,
            on_conflict="source,source_player_id,ranking_type,ranking_date",
        ).execute()

    return len(rows)