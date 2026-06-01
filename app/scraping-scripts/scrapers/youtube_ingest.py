"""
scrapers/youtube_ingest.py
==========================
Searches YouTube for highlight videos of the top 100 USTA-ranked canonical
players and appends the URLs to canonical.players.video_urls.

Behaviour
---------
- Targets canonical players ranked in the top 100 by USTA ranking.
- Skips any player who already has video_urls populated (non-destructive).
- Queries YouTube Data API v3: search.list, type=video, maxResults=3.
- Query format: "{full_name} tennis"
- Appends up to 3 URLs (https://www.youtube.com/watch?v=<id>) per player.
- Writes directly to canonical.players — no raw/resolution tables involved.

Requirements
------------
    pip install google-api-python-client

    Environment variable:
        YOUTUBE_API_KEY  — Google Cloud Console → YouTube Data API v3

Usage
-----
    Called from ingest_pipeline.py via _run_youtube(), or directly:

        python -m scrapers.youtube_ingest
"""

from __future__ import annotations

import os
import time

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from db.client import fetch_all, supabase

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

_USTA_SOURCE       = "USTA"
_TOP_N             = 500       # only process the top N USTA-ranked players
_MAX_RESULTS       = 3         # YouTube results per player
_QUOTA_DELAY_S     = 0.25      # polite pause between API calls (seconds)
_YT_WATCH_BASE     = "https://www.youtube.com/watch?v="

_canonical = lambda t: supabase.schema("canonical").table(t)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_youtube_client():
    api_key = os.environ.get("YOUTUBE_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "YOUTUBE_API_KEY environment variable is not set. "
            "Create a key at https://console.cloud.google.com/ with "
            "YouTube Data API v3 enabled."
        )
    return build("youtube", "v3", developerKey=api_key)


def _search_videos(youtube, query: str) -> list[str]:
    """
    Call YouTube search.list and return up to _MAX_RESULTS watch URLs.
    Returns an empty list on quota/API errors (logged, not raised).
    """
    try:
        response = youtube.search().list(
            q=query,
            part="id",
            type="video",
            maxResults=_MAX_RESULTS,
            relevanceLanguage="en",
            safeSearch="none",
        ).execute()
    except HttpError as exc:
        print(f"    [!] YouTube API error for query '{query}': {exc}")
        return []

    return [
        f"{_YT_WATCH_BASE}{item['id']['videoId']}"
        for item in response.get("items", [])
        if item.get("id", {}).get("videoId")
    ]


def _fetch_top_usta_player_ids(top_n: int) -> list[str]:
    """
    Return canonical player UUIDs for the top N USTA-ranked players,
    ordered by ranking ascending (best rank first).
    """
    res = (
        _canonical("player_rankings")
        .select("player_id, ranking")
        .eq("source", _USTA_SOURCE)
        .not_.is_("ranking", "null")
        .order("ranking", desc=False)
        .limit(top_n)
        .execute()
    )
    return [r["player_id"] for r in (res.data or [])]


def _fetch_players_by_ids(player_ids: list[str]) -> list[dict]:
    return fetch_all(
        "canonical", "players",
        "id, full_name, video_urls, committed_to",
        ("id", player_ids),
    )


# ---------------------------------------------------------------------------
# Main ingest function
# ---------------------------------------------------------------------------

def ingest_youtube_videos() -> int:
    """
    Search YouTube for the top 100 USTA players and append video URLs to
    canonical.players.video_urls. Skips players who already have videos.

    Returns the number of players successfully updated.
    """
    print("  Fetching top 100 USTA-ranked player IDs ...")
    player_ids = _fetch_top_usta_player_ids(_TOP_N)
    if not player_ids:
        print("  [youtube] No USTA-ranked players found — nothing to do.")
        return 0

    players = _fetch_players_by_ids(player_ids)

    # Preserve the ranking order returned by the DB
    order_index = {pid: i for i, pid in enumerate(player_ids)}
    players.sort(key=lambda p: order_index.get(p["id"], 9999))

    # Filter out players who already have video_urls
    # Filter out commited players
    to_enrich = [
        p for p in players
        if not p.get("video_urls")
        and p.get("committed_to") is None
    ]

    skipped = len(players) - len(to_enrich)

    print(
        f"  [youtube] {len(players)} players fetched, "
        f"{skipped} already have videos, "
        f"{len(to_enrich)} to search."
    )

    if not to_enrich:
        return 0

    youtube = _build_youtube_client()
    updated = 0
    failed  = 0

    for player in to_enrich:
        name  = (player.get("full_name") or "").strip()
        pid   = player["id"]

        if not name:
            print(f"    [skip] Player {pid} has no full_name — skipping")
            failed += 1
            continue

        query = f"{name} tennis"
        urls  = _search_videos(youtube, query)

        if not urls:
            print(f"    [no results] '{query}'")
            failed += 1
        else:
            existing  = list(player.get("video_urls") or [])
            new_urls  = [u for u in urls if u not in existing]
            merged    = existing + new_urls

            _canonical("players").update({
                "video_urls": merged,
                "updated_at": _now(),
            }).eq("id", pid).execute()

            print(f"    [ok] {name!r:<30} → {len(new_urls)} URL(s) added")
            updated += 1

        time.sleep(_QUOTA_DELAY_S)

    print(
        f"\n  [youtube] Done — {updated} updated, "
        f"{skipped} skipped (had videos), {failed} failed/empty."
    )
    return updated


# ---------------------------------------------------------------------------
# Timestamp helper (mirrors convention in resolution.py / canonical.py)
# ---------------------------------------------------------------------------

def _now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Direct execution
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    ingest_youtube_videos()