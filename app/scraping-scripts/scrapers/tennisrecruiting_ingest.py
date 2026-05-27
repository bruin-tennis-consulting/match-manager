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

Requirements
------------
    pip install curl-cffi beautifulsoup4
"""

import re
import random
import asyncio
from datetime import datetime, timezone, timedelta

from curl_cffi.requests import AsyncSession
from bs4 import BeautifulSoup

from tennis_recruiting_profile import parse_profile, parse_activity
from tennis_recruiting_top10 import parse_rankings
from db.client import supabase

_FETCH_DELAY    = 1.5   # base seconds between requests per worker
_MAX_CONCURRENT = 1      # concurrent profile fetches
_RESCRAPE_DAYS  = 30     # skip profiles scraped within this many days
_SOURCE         = "tennisrecruiting.net"
_BASE_URL       = "https://www.tennisrecruiting.net"

# Schema-scoped table accessors
_raw = lambda table: supabase.schema("raw").table(table)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Staleness check
# ---------------------------------------------------------------------------

def _get_stale_ids(source_ids: list[int]) -> list[int]:
    """
    Return the subset of source_ids that are either:
      - not yet in raw.players, or
      - scraped more than _RESCRAPE_DAYS days ago.

    Fetches existing scraped_at timestamps in one DB call.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=_RESCRAPE_DAYS)).isoformat()

    existing = (
        _raw("players")
        .select("source_id,scraped_at")
        .eq("source", _SOURCE)
        .in_("source_id", [str(sid) for sid in source_ids])
        .execute()
    )

    scraped_map: dict[str, str] = {
        row["source_id"]: row["scraped_at"]
        for row in (existing.data or [])
    }

    stale = []
    for sid in source_ids:
        scraped_at = scraped_map.get(str(sid))
        if scraped_at is None or scraped_at < cutoff:
            stale.append(sid)

    fresh_count = len(source_ids) - len(stale)
    if fresh_count:
        print(f"  Skipping {fresh_count} profiles scraped within the last {_RESCRAPE_DAYS} days.")

    return stale


# ---------------------------------------------------------------------------
# Async HTTP fetch (curl_cffi — impersonates Chrome TLS fingerprint)
# ---------------------------------------------------------------------------

async def _fetch_html(client: AsyncSession, url: str, semaphore: asyncio.Semaphore) -> str:
    """
    Fetch a single URL respecting the semaphore and per-request delay.
    Uses curl_cffi's Chrome impersonation to bypass TLS fingerprint detection.
    403s are raised immediately without retry — they indicate a private/deleted
    profile, not a transient error.
    """
    async with semaphore:
        resp = await client.get(url, timeout=15)
        if resp.status_code == 403:
            raise Exception(f"403 Forbidden (private/deleted profile): {url}")
        resp.raise_for_status()
        await asyncio.sleep(_FETCH_DELAY + random.uniform(0, 0.5))
        return resp.text


async def _fetch_profile_pages(
    source_id: int,
    client: AsyncSession,
    semaphore: asyncio.Semaphore,
) -> tuple[str, str]:
    """Fetch profile + activity pages concurrently for one player."""
    profile_url  = f"{_BASE_URL}/player.asp?id={source_id}"
    activity_url = f"{_BASE_URL}/player/activity.asp?id={source_id}"
    profile_html, activity_html = await asyncio.gather(
        _fetch_html(client, profile_url,  semaphore),
        _fetch_html(client, activity_url, semaphore),
    )
    return profile_html, activity_html


# ---------------------------------------------------------------------------
# raw.players
# ---------------------------------------------------------------------------

def _upsert_raw_player(source_id: int, raw_json: dict, source_url: str) -> str:
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

def _upsert_raw_rankings(rankings: list[dict], source_id: int, player_extra: dict | None = None) -> None:
    # Snapshot the player-level profile fields so canonical.py can read them
    # from raw.rankings without a separate raw.players join.
    extra_snapshot: dict = {}
    if player_extra:
        extra_snapshot = {k: v for k, v in {
            "city":         player_extra.get("city"),
            "state_code":   player_extra.get("state_code"),
            "highschool":   player_extra.get("highschool"),
            "committed_to": player_extra.get("committed_to"),
            "stars":        player_extra.get("stars"),
        }.items() if v is not None}

    rows = [
        {
            "source":           _SOURCE,
            "source_player_id": str(source_id),
            "ranking_type":     r["source"],
            "rank_value":       r.get("ranking") or r.get("rating"),
            "ranking_date":     r["ranking_date"],
            "raw_json":         {**(r.get("raw_data") or {}), **extra_snapshot},
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
# Core: parse + write one player (sync, called from async worker)
# ---------------------------------------------------------------------------

def _process_player(source_id: int, profile_html: str, activity_html: str) -> str:
    """Parse HTML and write to DB. Returns raw.players UUID."""
    profile_soup  = BeautifulSoup(profile_html,  "html.parser")
    activity_soup = BeautifulSoup(activity_html, "html.parser")

    data = parse_profile(profile_soup)
    data["match_results"] = parse_activity(activity_soup, source_id)

    raw_player_id = _upsert_raw_player(
        source_id,
        raw_json={
            "player":       data["player"],
            "player_extra": data["player_extra"],
            "aliases":      data["aliases"],
        },
        source_url=f"{_BASE_URL}/player.asp?id={source_id}",
    )

    _upsert_raw_rankings(data["rankings"], source_id, data.get("player_extra"))

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
# Async batch ingestion
# ---------------------------------------------------------------------------

async def _ingest_batch(source_ids: list[int]) -> tuple[int, list[int]]:
    """
    Concurrently fetch + ingest all source_ids.
    Returns (success_count, failed_ids).
    """
    semaphore = asyncio.Semaphore(_MAX_CONCURRENT)
    success   = 0
    failed    = []

    async with AsyncSession(impersonate="chrome124") as client:
        # Seed session cookies with a homepage visit before scraping profiles
        await client.get(f"{_BASE_URL}/")
        await asyncio.sleep(_FETCH_DELAY + random.uniform(0, 0.5))

        async def _worker(source_id: int):
            nonlocal success
            try:
                profile_html, activity_html = await _fetch_profile_pages(
                    source_id, client, semaphore
                )
                loop = asyncio.get_running_loop()
                await loop.run_in_executor(
                    None, _process_player, source_id, profile_html, activity_html
                )
                success += 1
            except Exception as e:
                print(f"    [!] Player {source_id} failed: {e}")
                failed.append(source_id)

        await asyncio.gather(*[_worker(sid) for sid in source_ids])

    return success, failed


# ---------------------------------------------------------------------------
# Public: profile ingestion (single player, sync wrapper)
# ---------------------------------------------------------------------------

def ingest_player_profile(source_id: int) -> str:
    """
    Fetch + parse one player profile and activity page.
    Writes to: raw.players, raw.rankings, raw.tournaments, raw.matches
    Returns the raw.players UUID.
    """
    async def _run():
        async with AsyncSession(impersonate="chrome124") as client:
            await client.get(f"{_BASE_URL}/")
            await asyncio.sleep(_FETCH_DELAY)
            semaphore = asyncio.Semaphore(1)
            return await _fetch_profile_pages(source_id, client, semaphore)

    profile_html, activity_html = asyncio.run(_run())
    return _process_player(source_id, profile_html, activity_html)


# ---------------------------------------------------------------------------
# Public: batch ingestion with staleness filtering
# ---------------------------------------------------------------------------

def ingest_player_profiles(source_ids: list[int]) -> tuple[int, list[int]]:
    """
    Batch-ingest a list of player IDs, skipping any scraped within _RESCRAPE_DAYS.
    Returns (success_count, failed_ids).
    """
    stale_ids = _get_stale_ids(source_ids)
    if not stale_ids:
        print("  All profiles are fresh — nothing to scrape.")
        return 0, []

    print(f"  Scraping {len(stale_ids)} profiles (concurrent, max {_MAX_CONCURRENT}) ...")
    return asyncio.run(_ingest_batch(stale_ids))


# ---------------------------------------------------------------------------
# Public: homepage top-10 rankings ingestion
# ---------------------------------------------------------------------------

def ingest_homepage_rankings(soup=None) -> int:
    """
    Scrape the homepage top-10 rankings and write to raw.rankings.
    Accepts an optional pre-fetched BeautifulSoup to avoid a redundant fetch.
    """
    if soup is None:
        from tennis_recruiting_top10 import fetch_from_web
        soup = fetch_from_web(f"{_BASE_URL}/")

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