"""
USTA Junior National Standings Scraper
=======================================
Scrapes the USTA national junior standings list across genders and age
divisions using Playwright (required because the page is JavaScript-rendered).

The UTR scraper hits a clean JSON API with `requests`. USTA has no public API,
so we drive a headless Chromium browser instead. The public output format is
identical — a list of parsed player dicts consumable by the ingest pipeline.

Usage
-----
    # Run directly to dump results to usta_raw.json for inspection:
    python usta_scraper.py

    # Import and call from the ingest pipeline:
    from usta_scraper import scrape_all

Standings page:
    https://www.usta.com/en/home/play/junior-tennis/programs/national/junior-rankings.html

Requirements
------------
    pip install playwright
    playwright install chromium
"""

import json
import re
import time
from datetime import datetime, timezone
from typing import Any

from playwright.sync_api import Page, TimeoutError as PlaywrightTimeoutError, sync_playwright


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

GENDERS       = ["Boys", "Girls"]
AGE_DIVISIONS = ["18", "16", "14", "12"]   # USTA 18s, 16s, 14s, 12s

STANDINGS_URL = (
    "https://www.usta.com/en/home/play/junior-tennis/"
    "programs/national/junior-rankings.html"
)
OUTPUT_FILE = "usta_raw.json"

_PAGE_TIMEOUT        = 30_000   # ms — initial page load
_FILTER_TIMEOUT      = 10_000   # ms — wait for table after setting a filter
_FETCH_DELAY_SECONDS = 2.0      # polite delay between filter combinations


# ---------------------------------------------------------------------------
# Selectors
# ---------------------------------------------------------------------------
# NOTE: These are based on the known USTA page structure and verified against
# the live site.  Update these constants if the page markup changes rather
# than hunting for them throughout the code.

_SEL_GENDER_DROPDOWN = "select[name*='gender'], select[id*='gender']"
_SEL_AGE_DROPDOWN    = "select[name*='age'], select[id*='division'], select[id*='age']"
_SEL_TABLE_ROWS      = "table tbody tr"
_SEL_TABLE_LOADED    = "table tbody tr td"   # sentinel — wait for at least one cell


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _gender_full(label: str) -> str:
    return {"Boys": "male", "Girls": "female"}.get(label, label.lower())


def _parse_uaid_from_href(href: str | None) -> str | None:
    """
    Extract the USTA UAID from a profile link, e.g.:
        /player-profile?uaid=ABC-123
        /player?id=XYZ
    Returns None when no recognisable ID param is found.
    """
    if not href:
        return None
    m = re.search(r"[?&](?:uaid|id|playerId)=([A-Za-z0-9_-]+)", href)
    return m.group(1) if m else None


def _parse_points(raw: str | None) -> float | None:
    if not raw:
        return None
    try:
        return float(raw.replace(",", "").strip())
    except ValueError:
        return None


def _split_name(full_name: str) -> tuple[str | None, str | None]:
    parts = full_name.strip().split(None, 1)
    return (parts[0], parts[1]) if len(parts) == 2 else (parts[0], None)


# ---------------------------------------------------------------------------
# Fetch
# ---------------------------------------------------------------------------

def fetch_standings(page: Page, gender: str, age_division: str) -> list[dict]:
    """
    Select the gender and age-division filters on the USTA standings page and
    return the rendered table rows as raw dicts.  Returns an empty list on any
    timeout or parsing failure.
    """
    try:
        page.select_option(_SEL_GENDER_DROPDOWN, label=gender, timeout=_FILTER_TIMEOUT)
        time.sleep(0.5)
        page.select_option(_SEL_AGE_DROPDOWN, label=f"{age_division}s", timeout=_FILTER_TIMEOUT)
        page.wait_for_selector(_SEL_TABLE_LOADED, timeout=_FILTER_TIMEOUT)
    except PlaywrightTimeoutError as e:
        print(f"  [!] Timeout waiting for table ({gender} | {age_division}s): {e}")
        return []

    rows = []
    for tr in page.query_selector_all(_SEL_TABLE_ROWS):
        cells = tr.query_selector_all("td")
        if len(cells) < 3:
            continue

        texts = [c.inner_text().strip() for c in cells]

        # Look for a player-profile link anywhere in the row
        href = None
        for cell in cells:
            a = cell.query_selector("a[href*='player']")
            if a:
                href = a.get_attribute("href")
                break

        rows.append({
            "rank":          texts[0].rstrip("."),
            "full_name":     texts[1] if len(texts) > 1 else None,
            "section":       texts[2] if len(texts) > 2 else None,
            "district":      texts[3] if len(texts) > 3 else None,
            "points":        texts[4] if len(texts) > 4 else None,
            "_href":         href,
            "_gender":       gender,
            "_age_division": age_division,
        })

    return rows


# ---------------------------------------------------------------------------
# Parse
# ---------------------------------------------------------------------------

def parse_player(row: dict, scraped_gender: str, scraped_age: str) -> dict[str, Any]:
    """
    Normalise a raw standings row into the standard pipeline dict format.

    Returns a dict with three top-level keys:

    "player"
        Fields that map directly onto public.players columns.
        Keys prefixed with "_" are internal pipeline hints (not written to DB).

    "player_extra"
        Everything else from the standings row that has no dedicated column
        in public.players.  Written into raw_data on the player_rankings row.

    "raw"
        The full original row dict, stored for debugging.
    """
    full_name = (row.get("full_name") or "").strip() or None
    first, last = _split_name(full_name) if full_name else (None, None)

    uaid = _parse_uaid_from_href(row.get("_href"))

    try:
        rank = int(row["rank"])
    except (ValueError, TypeError, KeyError):
        rank = None

    player_out = {
        # Internal hint — not written to DB
        "_source_id":    uaid,

        # Schema columns
        "first_name":    first,
        "last_name":     last,
        "full_name":     full_name,
        "country_code":  "USA",                         # USTA national list is domestic
        "gender":        _gender_full(scraped_gender),
        "region":        row.get("section"),            # best available geo field

        # Not available from USTA standings — leave for other sources to populate
        "date_of_birth": None,
        "grad_year":     None,
        "height":        None,
        "dominant_hand": None,
        "play_style":    None,
    }

    player_extra = {
        "uaid":          uaid,
        "usta_ranking":  rank,
        "usta_points":   _parse_points(row.get("points")),
        "section":       row.get("section"),
        "district":      row.get("district"),
        "age_division":  f"{scraped_age}s",
        "scraped_at":    datetime.now(timezone.utc).isoformat(),
    }

    return {"player": player_out, "player_extra": player_extra, "raw": row}


# ---------------------------------------------------------------------------
# Scrape all
# ---------------------------------------------------------------------------

def scrape_all() -> list[dict]:
    """
    Scrape all gender × age-division combinations and return a deduplicated
    list of parsed player dicts.

    Deduplication is by uaid.  Players without a resolved uaid fall back to
    full_name as the dedup key to avoid duplicates caused by cross-division
    appearances.  If a player appears in multiple divisions (e.g. 18s and 16s),
    only the first occurrence is kept — same strategy as utr_scraper.
    """
    results  = []
    seen_ids = set()

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page    = browser.new_page()

        print(f"Navigating to {STANDINGS_URL} ...")
        page.goto(STANDINGS_URL, wait_until="networkidle", timeout=_PAGE_TIMEOUT)

        for gender in GENDERS:
            for age in AGE_DIVISIONS:
                print(f"Fetching {gender} | {age}s ...")
                raw_rows = fetch_standings(page, gender, age)

                new = 0
                for row in raw_rows:
                    entry     = parse_player(row, gender, age)
                    uaid      = entry["player"]["_source_id"]
                    dedup_key = uaid or entry["player"].get("full_name")

                    if not dedup_key:
                        continue
                    if dedup_key in seen_ids:
                        continue

                    seen_ids.add(dedup_key)
                    results.append(entry)
                    new += 1

                print(f"  → {new} new players ({len(raw_rows)} returned)")
                time.sleep(_FETCH_DELAY_SECONDS)

        browser.close()

    return results


# ---------------------------------------------------------------------------
# CLI — dumps raw output to usta_raw.json for inspection
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    players = scrape_all()

    with open(OUTPUT_FILE, "w") as f:
        json.dump(players, f, indent=2, default=str)

    print(f"\nDone. {len(players)} unique players saved to {OUTPUT_FILE}")
