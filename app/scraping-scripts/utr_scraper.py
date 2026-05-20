"""
UTR Rankings Scraper
====================
Fetches top-ranked junior players from the UTR public API across
genders (m/f) and age divisions (HighSchool, U18, U16).

The UTR API returns clean JSON — no HTML parsing needed.

Usage
-----
    # Run directly to dump results to utr_raw.json:
    python utr_scraper.py

    # Import and call from the ingest pipeline:
    from utr_scraper import scrape_all

Base endpoint:
    https://api.universaltennis.com/v3/player/top?gender=m&tags=HighSchool&count=25

Requirements
------------
    pip install requests
"""

import json
import time
import requests
from datetime import datetime, timezone
from typing import Any


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

GENDERS = ["m", "f"]
TAGS    = ["HighSchool", "U18", "U16"]
COUNT   = 25

BASE_URL    = "https://api.universaltennis.com/v3/player/top"
OUTPUT_FILE = "utr_raw.json"

_FETCH_DELAY_SECONDS = 1.0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _gender_full(code: str) -> str:
    return {"M": "male", "F": "female", "m": "male", "f": "female"}.get(code, code.lower())


def _parse_grad_year(player: dict) -> int | None:
    details = player.get("playerCollegeDetails")
    if not details:
        return None
    raw = details.get("gradYear")
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw).year
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Fetch
# ---------------------------------------------------------------------------

def fetch_top_players(gender: str, tag: str, count: int = COUNT) -> list[dict]:
    """
    Hit the UTR API and return the raw list of player dicts.
    Returns an empty list on any HTTP error.
    """
    try:
        resp = requests.get(
            BASE_URL,
            params={"gender": gender, "tags": tag, "count": count},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException as e:
        print(f"  [!] Error fetching {gender} | {tag}: {e}")
        return []


# ---------------------------------------------------------------------------
# Parse
# ---------------------------------------------------------------------------

def parse_player(player: dict, scraped_tag: str) -> dict[str, Any]:
    """
    Extract and normalise fields from a raw UTR player dict.

    Returns a dict with three top-level keys:

    "player"
        Fields that map directly onto public.players columns.
        Keys prefixed with "_" are internal pipeline hints (not written to DB).

    "player_extra"
        Everything else from the API response that has no dedicated column
        in public.players. Written into raw_data on the player_rankings row.

    "raw"
        The full original API response, stored for debugging.
    """
    hs      = player.get("playerHighSchool") or {}
    college = player.get("playerCollegeDetails") or {}
    trend   = player.get("threeMonthRatingChangeDetails") or {}

    first = (player.get("firstName") or "").strip()
    last  = (player.get("lastName") or "").strip()

    player_out = {
        # Internal hint — not written to DB
        "_source_id":   player["id"],

        # Schema columns
        "first_name":   first or None,
        "last_name":    last or None,
        "full_name":    f"{first} {last}".strip() or None,
        "grad_year":    _parse_grad_year(player),
        "country_code": player.get("nationality") or None,
        "gender":       _gender_full(player.get("gender", "")),

        # Not available from UTR API — leave for other sources to populate
        "date_of_birth": None,
        "height":        None,
        "dominant_hand": None,
        "play_style":    None,
        "region":        None,
    }

    player_extra = {
        "utr_id":             player["id"],
        "display_name":       player.get("displayName"),
        "utr_rating":         player.get("utr"),
        "utr_ranking":        player.get("utrRanking"),
        "three_month_rating": player.get("threeMonthRating"),
        "trend_direction":    trend.get("changeDirection"),
        "location":           player.get("descriptionShort"),
        "high_school":        hs.get("name"),
        "high_school_state":  hs.get("stateAbbr"),
        "college_class":      college.get("gradClassName"),
        "scraped_tag":        scraped_tag,
        "scraped_at":         datetime.now(timezone.utc).isoformat(),
    }

    return {"player": player_out, "player_extra": player_extra, "raw": player}


# ---------------------------------------------------------------------------
# Scrape all
# ---------------------------------------------------------------------------

def scrape_all(count: int = COUNT) -> list[dict]:
    """
    Scrape all gender × tag combinations and return a deduplicated list
    of parsed player dicts.

    Deduplication is by utr_id — if a player appears in multiple tags
    (e.g. HighSchool and U18), only the first occurrence is kept.
    """
    results  = []
    seen_ids = set()

    for gender in GENDERS:
        for tag in TAGS:
            print(f"Fetching {gender} | {tag} ...")
            raw_players = fetch_top_players(gender, tag, count)

            new = 0
            for raw in raw_players:
                utr_id = raw.get("id")
                if utr_id in seen_ids:
                    continue
                seen_ids.add(utr_id)
                results.append(parse_player(raw, tag))
                new += 1

            print(f"  → {new} new players ({len(raw_players)} returned)")
            time.sleep(_FETCH_DELAY_SECONDS)

    return results


# ---------------------------------------------------------------------------
# CLI — dumps raw output to utr_raw.json for inspection
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    players = scrape_all()

    with open(OUTPUT_FILE, "w") as f:
        json.dump(players, f, indent=2, default=str)

    print(f"\nDone. {len(players)} unique players saved to {OUTPUT_FILE}")
