"""
tennisrecruiting.net — Player Profile Parser
=============================================
Parses a player profile page (e.g. /player.asp?id=928355) and returns
structured dicts that map cleanly onto the DB schema:

    player          -> players table
    aliases         -> player_aliases table
    rankings        -> player_rankings table (one row per source per snapshot)
    match_results   -> match_results table

Usage
-----
    from parse_player_profile import parse_profile
    from bs4 import BeautifulSoup
    import requests

    html  = requests.get("https://www.tennisrecruiting.net/player.asp?id=928355").text
    soup  = BeautifulSoup(html, "html.parser")
    data  = parse_profile(soup)

    # data["player"]         -> dict  (one row for `players`)
    # data["aliases"]        -> list  (one row per external ID in `player_aliases`)
    # data["rankings"]       -> list  (rows for `player_rankings`)
    # data["match_results"]  -> list  (rows for `match_results`)

Notes on `_source_id` / `_opponent_source_id`
----------------------------------------------
These are the integer site-native IDs (e.g. 928355).  At insert time you
should look them up in player_aliases (source='tennisrecruiting.net') to
resolve your UUID primary keys before writing to the DB.

Requirements
------------
    pip install beautifulsoup4
"""

import re
import json
import html as html_lib
from datetime import datetime, timezone
from typing import Any


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clean(s) -> str | None:
    """Strip whitespace and HTML entities; return None for empty strings."""
    if s is None:
        return None
    s = html_lib.unescape(str(s)).strip()
    return s or None


def _parse_iso(s) -> str | None:
    """Return YYYY-MM-DD string, or None.  Rejects 1899-* placeholder dates."""
    if not s:
        return None
    s = str(s)
    if s.startswith("1899"):
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt.date().isoformat()
    except ValueError:
        return None


def _parse_date_mmddyy(s) -> str | None:
    """Parse '12/8/25' -> '2025-12-08'."""
    if not s:
        return None
    try:
        return datetime.strptime(s, "%m/%d/%y").date().isoformat()
    except ValueError:
        return None


def _parse_rating(v) -> tuple[float | None, bool]:
    """
    Parse a rating value that may be exact or masked by the site.

    The site masks ratings for non-members using patterns like:
        "13.xx"   -> integer part is known, decimals hidden
        "~13"     -> approximate integer
        "xx"      -> fully hidden

    Returns
    -------
    (rating, approximate)
        rating       : float if any numeric part could be extracted, else None
        approximate  : True if the value was masked / estimated
    """
    if v is None:
        return None, False

    s = str(v).strip()

    # Already a clean number
    try:
        f = float(s)
        return (f if f != 0.0 else None), False
    except ValueError:
        pass

    # Strip a leading "~" approximation marker
    approximate = False
    if s.startswith("~"):
        s = s[1:].strip()
        approximate = True

    # Pattern: "13.xx" or "13.XX" — integer part known, decimals masked
    m = re.match(r"^(\d+)\.(?:xx|XX|x|X|\?\?)$", s)
    if m:
        return float(m.group(1)), True   # use integer part, flag as approximate

    # Pattern: "xx" or "XX" — fully hidden
    if re.match(r"^(?:xx|XX|x|X|\?\?)$", s):
        return None, True

    # Last attempt: extract any leading digits
    m = re.match(r"^(\d+(?:\.\d+)?)", s)
    if m:
        return float(m.group(1)), True

    return None, False


def _gender_full(code: str) -> str:
    return {"M": "male", "F": "female"}.get(code, code.lower())


# ---------------------------------------------------------------------------
# Extract the embedded page JSON
# ---------------------------------------------------------------------------

def _extract_page_json(soup) -> dict:
    """
    The profile page embeds all structured data in one JS assignment:
        var page = { ... };  writePlayerHeader(page.header);
    """
    for script in soup.find_all("script"):
        text = script.string or ""
        m = re.search(
            r"var\s+page\s*=\s*(\{.*?\});\s*writePlayerHeader",
            text,
            re.DOTALL,
        )
        if m:
            try:
                return json.loads(m.group(1))
            except json.JSONDecodeError:
                pass
    return {}


# ---------------------------------------------------------------------------
# players row
# ---------------------------------------------------------------------------

def _parse_player(page: dict) -> dict:
    h  = page.get("header", {})
    wr = page.get("weekly_rankings", {})

    return {
        # Internal site ID — use to resolve UUID via player_aliases at insert time
        "_source_id": h.get("pid"),

        # --- players table columns ---
        "full_name":       _clean(h.get("fullname")),
        "first_name":      _clean(h.get("first")),
        "last_name":       _clean(h.get("last")),
        "date_of_birth":   None,                        # not exposed on this page
        "grad_year":       h.get("classof"),
        "region":          _clean(h.get("state")),      # e.g. "New York"
        "country_code":    _clean(h.get("country")),    # e.g. "USA"
        "height":          None,                        # not on overview page
        "dominant_hand":   None,                        # not on overview page
        "play_style":      None,                        # not on overview page
        "gender":          _gender_full(h.get("gender", "")),

        # --- useful extras (store in raw_data or extra columns as you see fit) ---
        "city":            _clean(h.get("city")),
        "state_code":      _clean(h.get("st")),         # e.g. "NY"
        "hometown":        _clean(h.get("hometown")),
        "highschool":      _clean(h.get("highschool")),
        "stars":           wr.get("stars"),             # site's 1–6 star rating
        "wins":            wr.get("wins"),
        "losses":          wr.get("losses"),
        "photo_path":      _clean(h.get("photo")),
        "committed_to":    page.get("schools", {}).get("commitment", {}).get("name"),
        "profile_updated": _parse_iso(h.get("ts")),
    }


# ---------------------------------------------------------------------------
# player_aliases rows
# ---------------------------------------------------------------------------

def _parse_aliases(page: dict) -> list[dict]:
    """
    One row per external system that has an ID for this player.
    The `alias_name` should be stored as a string regardless of the source type.
    """
    h   = page.get("header", {})
    wr  = page.get("weekly_rankings", {})
    aliases = []

    def _add(alias_name, source, confidence=1.0):
        if alias_name is not None and str(alias_name).strip():
            aliases.append({
                "alias_name": str(alias_name),
                "source":     source,
                "confidence": confidence,
            })

    _add(h.get("pid"),                               "tennisrecruiting.net")
    _add(wr.get("usta", {}).get("uaid"),             "USTA")
    _add(wr.get("itf",  {}).get("ipin"),             "ITF")
    _add(wr.get("utr",  {}).get("id"),               "UTR")
    _add(wr.get("wtn",  {}).get("uaid"),             "WTN")

    return aliases


# ---------------------------------------------------------------------------
# player_rankings rows
# ---------------------------------------------------------------------------

# Map embedded JSON keys -> clean source labels for the DB
_RANKING_SOURCE = {
    "crl":  "tennisrecruiting_crl",
    "rpi":  "tennisrecruiting_rpi",
    "usta": "USTA",
    "itf":  "ITF",
    "wtn":  "WTN",
    "utr":  "UTR",
}

# Sources that store a continuous rating rather than an ordinal rank
_RATING_SOURCES = {"wtn", "utr"}


def _parse_rankings(page: dict) -> list[dict]:
    wr   = page.get("weekly_rankings", {})
    hr   = page.get("highest_rankings", [])
    today = datetime.now(timezone.utc).date().isoformat()
    rows  = []

    # --- Current snapshot (weekly_rankings block) ---
    for key, source in _RANKING_SOURCE.items():
        block = wr.get(key)
        if not block:
            continue

        rank             = None
        rating           = None
        rating_approx    = False

        if key in _RATING_SOURCES:
            rating, rating_approx = _parse_rating(block.get("rating"))
            # Also try doubles rating if singles is fully masked
            if rating is None and key == "utr":
                dbl_rating, dbl_approx = _parse_rating(
                    block.get("doubles", {}).get("rating")
                )
                # Don't conflate singles and doubles — just flag it
                if dbl_rating is not None:
                    block["_doubles_rating_approx"] = dbl_approx
        else:
            raw_rank = block.get("rank")
            rank = int(raw_rank) if raw_rank is not None else None

        rdate = _parse_iso(block.get("date")) or today

        rows.append({
            "source":            source,
            "ranking":           rank,
            "rating":            rating,
            "rating_approximate": rating_approx,  # True = masked / estimated value
            "ranking_date":      rdate,
            "raw_data":          block,
        })

    # --- Historical peak rankings ---
    type_to_source = {
        "Recruiting": "tennisrecruiting_crl",
        "TennisRPI":  "tennisrecruiting_rpi",
    }
    for entry in hr:
        source = type_to_source.get(entry.get("type"), entry.get("type", "unknown"))
        rows.append({
            "source":             source + "_peak",
            "ranking":            int(entry["rank"]) if entry.get("rank") else None,
            "rating":             None,
            "rating_approximate": False,
            "ranking_date":       _parse_iso(entry.get("date")),
            "raw_data":           entry,
        })

    return rows


# ---------------------------------------------------------------------------
# match_results rows
# ---------------------------------------------------------------------------

def _parse_match_results(soup, page: dict) -> list[dict]:
    """
    Parses the hidden #divall activity table.

    Table columns per row:
        [0] date  [1] opponent if win  [2] opponent if loss  [3] score

    The opponent's class year suffix " ('27)" is stripped from display names.
    `_player_source_id` and `_opponent_source_id` are the site's integer IDs;
    resolve to UUIDs via player_aliases before DB insert.
    """
    pid = page.get("header", {}).get("pid")

    div = soup.find("div", id="divall")
    if not div:
        return []

    results = []
    for row in div.find_all("tr"):
        # don't recurse because some player names have flags/icons inside nested tables
        cells = row.find_all("td", recursive=False)
        if len(cells) < 4:
            continue

        date_text  = _clean(cells[0].get_text())
        win_link   = cells[1].find("a")
        loss_link  = cells[2].find("a")
        score_text = _clean(cells[3].get_text())

        # Exactly one of win/loss should have a link
        if win_link and not loss_link:
            outcome  = "win"
            opp_link = win_link
        elif loss_link and not win_link:
            outcome  = "loss"
            opp_link = loss_link
        else:
            continue   # header row or malformed

        # Opponent site ID
        href = opp_link.get("href", "")
        m    = re.search(r"id=(\d+)", href)
        opp_source_id = int(m.group(1)) if m else None

        # Opponent display name — strip trailing class-year annotation
        opp_name = re.sub(r"\s*\('\d+'\)\s*$", "", opp_link.get_text(strip=True)).strip()

        results.append({
            "_player_source_id":   pid,
            "_opponent_source_id": opp_source_id,
            "opponent_name":       opp_name,
            "outcome":             outcome,
            "score":               score_text,
            "round":               None,        # not on overview page
            "best_of":             None,        # not on overview page
            "status":              "completed",
            "played_at":           _parse_date_mmddyy(date_text),
            "source":              "tennisrecruiting.net",
            "raw_data": {
                "date_raw":  date_text,
                "score_raw": score_text,
                "outcome":   outcome,
            },
        })

    return results


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def parse_profile(soup) -> dict[str, Any]:
    """
    Parse a BeautifulSoup of a tennisrecruiting.net player profile page.

    Parameters
    ----------
    soup : bs4.BeautifulSoup

    Returns
    -------
    {
        "player":        dict,        # one row for `players`
        "aliases":       list[dict],  # rows for `player_aliases`
        "rankings":      list[dict],  # rows for `player_rankings`
        "match_results": list[dict],  # rows for `match_results`
    }
    """
    page = _extract_page_json(soup)

    return {
        "player":        _parse_player(page),
        "aliases":       _parse_aliases(page),
        "rankings":      _parse_rankings(page),
        "match_results": _parse_match_results(soup, page),
    }


# ---------------------------------------------------------------------------
# CLI — quick smoke-test / pretty-print
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys
    import json as _json
    from bs4 import BeautifulSoup

    if len(sys.argv) < 2:
        print("Usage:")
        print("  python parse_player_profile.py <path_to_html>   # local file")
        print("  python parse_player_profile.py <player_id>      # fetch live")
        sys.exit(1)

    arg = sys.argv[1]

    if arg.isdigit():
        import requests
        url  = f"https://www.tennisrecruiting.net/player.asp?id={arg}"
        print(f"Fetching {url} ...", file=sys.stderr)
        resp = requests.get(url, headers={
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"
            )
        }, timeout=15)
        resp.raise_for_status()
        html_text = resp.text
    else:
        with open(arg, encoding="utf-8", errors="replace") as f:
            html_text = f.read()

    soup   = BeautifulSoup(html_text, "html.parser")
    result = parse_profile(soup)

    print(_json.dumps(result, indent=2, default=str))
