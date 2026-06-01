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
    https://www.usta.com/en/home/play/rankings.html

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

from playwright.sync_api import Page, sync_playwright


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

GENDERS       = ["M", "F"]
AGE_DIVISIONS = ["Y18", "Y16", "Y14", "Y12"]

STANDINGS_URL = "https://www.usta.com/en/home/play/rankings.html"
OUTPUT_FILE   = "usta_raw.json"

_PAGE_TIMEOUT        = 60_000   # ms — initial page load
_FILTER_WAIT_SECONDS = 3.0      # wait for grid to update after changing filters
_FETCH_DELAY_SECONDS = 1.0      # polite delay between filter combinations


# ---------------------------------------------------------------------------
# Selectors
# ---------------------------------------------------------------------------
# NOTE: The USTA page renders multiple ranking sections (Junior, Adult, NTRP,
# etc.), each with its own set of filters.  We always use .first to target the
# Junior section, which appears first in the DOM.

_SEL_RANKING_LIST = 'select[aria-label="Ranking List"]'
_SEL_GENDER       = 'select[aria-label="Gender"]'
_SEL_AGE          = 'select[aria-label="Age"]'
_SEL_PER_PAGE     = 'select[aria-label="Numbers of results per page"]'
_SEL_DATA_ROWS    = ".v-grid__row:not(.v-grid__row--header-row)"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _gender_full(code: str) -> str:
    return {"M": "male", "F": "female"}.get(code, code.lower())


def _age_label(code: str) -> str:
    """Convert USTA age code to a short numeric label, e.g. 'Y18' → '18'."""
    return code.lstrip("Y")


def _parse_uaid_from_href(href: str | None) -> str | None:
    """
    Extract the USTA UAID from a profile link, e.g.:
        /en/home/play/player-search/profile.html#uaid=2010688342
    Returns None when no recognisable ID param is found.
    """
    if not href:
        return None
    m = re.search(r"[?&#](?:uaid|id|playerId)=([A-Za-z0-9_-]+)", href)
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
    return the rendered grid rows as raw dicts.  Returns an empty list on any
    failure.
    """
    try:
        page.locator(_SEL_GENDER).first.select_option(gender)
        time.sleep(0.5)
        page.locator(_SEL_AGE).first.select_option(age_division)
        time.sleep(_FILTER_WAIT_SECONDS)
    except Exception as e:
        print(f"  [!] Error setting filters ({gender} | {age_division}): {e}")
        return []

    rows = []
    for row in page.query_selector_all(_SEL_DATA_ROWS):
        # Each cell's text is separated by double newlines within the row
        parts = [p.strip() for p in row.inner_text().strip().split("\n\n") if p.strip()]

        # Need at least: national rank, section rank, district rank, name
        if len(parts) < 4:
            continue

        # Look for a player-profile link containing the UAID
        href = None
        a = row.query_selector("a[href*='uaid']")
        if a:
            href = a.get_attribute("href")

        rows.append({
            "rank":           parts[0].rstrip("."),
            "section_rank":   parts[1] if len(parts) > 1 else None,
            "district_rank":  parts[2] if len(parts) > 2 else None,
            "full_name":      parts[3] if len(parts) > 3 else None,
            "total_points":   parts[4] if len(parts) > 4 else None,
            "singles_points": parts[5] if len(parts) > 5 else None,
            "doubles_points": parts[6] if len(parts) > 6 else None,
            "bonus_points":   parts[7] if len(parts) > 7 else None,
            "city":           parts[8] if len(parts) > 8 else None,
            "state":          parts[9] if len(parts) > 9 else None,
            "section":        parts[10] if len(parts) > 10 else None,
            "district":       parts[11] if len(parts) > 11 else None,
            "_href":          href,
            "_gender":        gender,
            "_age_division":  age_division,
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
        "uaid":           uaid,
        "usta_ranking":   rank,
        "usta_points":    _parse_points(row.get("total_points")),
        "singles_points": _parse_points(row.get("singles_points")),
        "doubles_points": _parse_points(row.get("doubles_points")),
        "bonus_points":   _parse_points(row.get("bonus_points")),
        "city":           row.get("city"),
        "state":          row.get("state"),
        "section":        row.get("section"),
        "district":       row.get("district"),
        "age_division":   f"{_age_label(scraped_age)}s",
        "scraped_at":     datetime.now(timezone.utc).isoformat(),
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

    Only the top 100 players per combination are fetched (one page).
    """
    results  = []
    seen_ids = set()

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page    = browser.new_page()

        print(f"Navigating to {STANDINGS_URL} ...")
        page.goto(STANDINGS_URL, wait_until="domcontentloaded", timeout=_PAGE_TIMEOUT)
        page.wait_for_timeout(6000)

        # Dismiss cookie consent if present
        try:
            page.click("button:has-text('Accept All Cookies')", timeout=3000)
            page.wait_for_timeout(1000)
        except Exception:
            pass

        # One-time setup: combined standings list, 100 results per page
        page.locator(_SEL_RANKING_LIST).first.select_option("combined")
        time.sleep(0.5)
        page.locator(_SEL_PER_PAGE).first.select_option("100")
        time.sleep(_FILTER_WAIT_SECONDS)

        for gender in GENDERS:
            for age in AGE_DIVISIONS:
                print(f"Fetching {gender} | {age} ...")
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
