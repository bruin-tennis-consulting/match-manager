"""
tennisrecruiting.net — Player Profile Parser
=============================================
Parses a player profile page (e.g. /player.asp?id=928355) and returns
structured dicts that map cleanly onto the DB schema:

    player          -> players table
    aliases         -> player_aliases table
    rankings        -> player_rankings table (one row per source per snapshot)
    match_results   -> match_results table   (populated from activity page)

Usage
-----
    from tennis_recruiting_profile import parse_profile, parse_activity
    from bs4 import BeautifulSoup
    import requests

    BASE = "https://www.tennisrecruiting.net"
    pid  = 928355

    profile_soup  = BeautifulSoup(requests.get(f"{BASE}/player.asp?id={pid}").text, "html.parser")
    activity_soup = BeautifulSoup(requests.get(f"{BASE}/player/activity.asp?id={pid}").text, "html.parser")

    data = parse_profile(profile_soup)
    data["match_results"] = parse_activity(activity_soup, pid)

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


def _parse_date_range(s) -> tuple[str | None, str | None]:
    """
    Parse a tournament date-range string into (start_date, end_date).

    Handles formats like:
        "December 8-14, 2025"
        "August 31 - September 6, 2025"
        "August 1-11, 2025"
        "October 22-28, 2025"
    Returns ISO date strings (YYYY-MM-DD) or (None, None) on failure.
    """
    if not s:
        return None, None
    s = s.strip()

    # "Month D1-D2, YYYY"  e.g. "December 8-14, 2025"
    m = re.match(
        r"^(\w+ \d{1,2})-(\d{1,2}),\s*(\d{4})$", s
    )
    if m:
        try:
            start = datetime.strptime(f"{m.group(1)}, {m.group(3)}", "%B %d, %Y").date().isoformat()
            end   = datetime.strptime(f"{m.group(1).split()[0]} {m.group(2)}, {m.group(3)}", "%B %d, %Y").date().isoformat()
            return start, end
        except ValueError:
            pass

    # "Month1 D1 - Month2 D2, YYYY"  e.g. "August 31 - September 6, 2025"
    m = re.match(
        r"^(\w+ \d{1,2})\s*-\s*(\w+ \d{1,2}),\s*(\d{4})$", s
    )
    if m:
        try:
            start = datetime.strptime(f"{m.group(1)}, {m.group(3)}", "%B %d, %Y").date().isoformat()
            end   = datetime.strptime(f"{m.group(2)}, {m.group(3)}", "%B %d, %Y").date().isoformat()
            return start, end
        except ValueError:
            pass

    return None, None


def _parse_rating(v) -> tuple[float | None, bool]:
    """
    Parse a rating value that may be exact or masked by the site.

    Returns (rating, approximate) where approximate=True means the value
    was masked/estimated (e.g. "13.xx", "~13").
    """
    if v is None:
        return None, False

    s = str(v).strip()

    try:
        f = float(s)
        return (f if f != 0.0 else None), False
    except ValueError:
        pass

    approximate = False
    if s.startswith("~"):
        s = s[1:].strip()
        approximate = True

    # "13.xx" — integer part known, decimals masked
    m = re.match(r"^(\d+)\.(?:xx|XX|x|X|\?\?)$", s)
    if m:
        return float(m.group(1)), True

    # fully hidden
    if re.match(r"^(?:xx|XX|x|X|\?\?)$", s):
        return None, True

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
    """
    Returns a dict with two top-level keys:

    "player"
        Fields that map directly onto public.players columns.
        Keys prefixed with "_" are internal pipeline hints (not written to DB).

    "player_extra"
        Everything else extracted from the page JSON that has no dedicated
        column in public.players.  Store in a raw_data / jsonb column or a
        separate player_profiles table as you see fit.
    """
    h  = page.get("header", {})
    wr = page.get("weekly_rankings", {})

    # ------------------------------------------------------------------
    # Commitment / school-interest details
    # ------------------------------------------------------------------
    schools     = page.get("schools", {})
    commitment  = schools.get("commitment", {})
    interests   = schools.get("interests", [])

    # Build a clean list of school interest records, dropping 1899 placeholder dates
    school_interests = []
    for s in interests:
        school_interests.append({
            "name":           _clean(s.get("name")),
            "team_id":        s.get("teamid"),
            "offer":          s.get("offer") == "1",
            "nli_signed":     s.get("nli") == "1",
            "interest_level": s.get("interest"),
            "visit_date":     _parse_iso(s.get("visit")),   # None when 1899 placeholder
        })

    # ------------------------------------------------------------------
    # public.players — only schema columns
    #
    # FIX (issue 2): grad_year, region, country_code, and gender are all
    # present in the page JSON and are now reliably populated.
    # dob, height, dominant_hand, and play_style are not exposed on the
    # profile page; they are left None here and should be populated from
    # a separate data source (e.g. ITF profile, USTA player page) if needed.
    # ------------------------------------------------------------------
    player = {
        # Internal hint — not written to DB
        "_source_id":    h.get("pid"),

        # Schema columns — populated from page JSON
        "full_name":     _clean(h.get("fullname")),
        "first_name":    _clean(h.get("first")),
        "last_name":     _clean(h.get("last")),
        "grad_year":     h.get("classof"),                 # e.g. 2026
        "region":        _clean(h.get("state")),           # e.g. "New York"
        "country_code":  _clean(h.get("country")),         # e.g. "USA"
        "gender":        _gender_full(h.get("gender", "")),# "male" / "female"

        # Not exposed on this page — leave None; populate from ITF/USTA if available
        "date_of_birth": None,
        "height":        None,
        "dominant_hand": None,
        "play_style":    None,
    }

    # ------------------------------------------------------------------
    # player_extra — useful fields with no dedicated column yet
    # ------------------------------------------------------------------
    player_extra = {
        # Identity / location
        "source_id":       h.get("pid"),
        "city":            _clean(h.get("city")),
        "state_code":      _clean(h.get("st")),           # e.g. "NY"
        "hometown":        _clean(h.get("hometown")),      # e.g. "Huntington, New York"

        # School
        "highschool":      _clean(h.get("highschool")),
        "academy":         _clean(h.get("academy")) or None,
        "grade":           _clean(h.get("grade")),         # e.g. "Senior"

        # Recruiting
        "stars":           wr.get("stars"),                # 1–6
        "provisional":     h.get("provisional", False),
        "international":   bool(_clean(h.get("international"))),
        "committed_to":    _clean(commitment.get("name")),
        "committed_team_id": commitment.get("teamid"),
        "school_interests": school_interests,

        # Status flags
        # national_player date = date from which player is considered national-level;
        # treat as a boolean flag (present & not null → True)
        "national_player":      _parse_iso(h.get("national_player")) is not None,
        "national_player_date": _parse_iso(h.get("national_player")),

        # Current-season record (snapshot at scrape time)
        "wins":   wr.get("wins"),
        "losses": wr.get("losses"),

        # Media
        "photo_path":       _clean(h.get("photo")),
        "photo_thumbnails": page.get("photos", {}).get("thumbnails", []),
        "gallery_id":       page.get("photos", {}).get("gallery_id"),
        "video_urls":       [v.get("url") for v in page.get("videos", []) if v.get("url")],

        # External IDs (convenience copy — canonical versions live in player_aliases)
        "adiplayer_id": h.get("adiplayer_id") or None,
        "itf_ipin":     wr.get("itf", {}).get("ipin"),
        "utr_id":       wr.get("utr", {}).get("id"),
        "usta_uaid":    wr.get("usta", {}).get("uaid"),
        "wtn_uaid":     wr.get("wtn", {}).get("uaid"),

        # Timestamps
        "profile_updated": _parse_iso(h.get("ts")),

        # Recent news headlines (title + url, no body text)
        "news_articles": [
            {
                "title": _clean(a.get("title")),
                "url":   _clean(a.get("url")),
                "date":  _parse_iso(a.get("date")),
            }
            for a in page.get("news", {}).get("articles", [])
        ],
    }

    return {"player": player, "player_extra": player_extra}


# ---------------------------------------------------------------------------
# player_aliases rows
# ---------------------------------------------------------------------------

def _parse_aliases(page: dict) -> list[dict]:
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

_RANKING_SOURCE = {
    "crl":  "tennisrecruiting_crl",
    "rpi":  "tennisrecruiting_rpi",
    "usta": "USTA",
    "itf":  "ITF",
    "wtn":  "WTN",
    "utr":  "UTR",
}

_RATING_SOURCES = {"wtn", "utr"}


def _parse_rankings(page: dict) -> list[dict]:
    wr    = page.get("weekly_rankings", {})
    hr    = page.get("highest_rankings", [])
    today = datetime.now(timezone.utc).date().isoformat()
    rows  = []

    for key, source in _RANKING_SOURCE.items():
        block = wr.get(key)
        if not block:
            continue

        rank          = None
        rating        = None
        rating_approx = False

        if key in _RATING_SOURCES:
            rating, rating_approx = _parse_rating(block.get("rating"))
            if rating is None and key == "utr":
                dbl_rating, dbl_approx = _parse_rating(
                    block.get("doubles", {}).get("rating")
                )
                if dbl_rating is not None:
                    block["_doubles_rating_approx"] = dbl_approx
        else:
            raw_rank = block.get("rank")
            rank = int(raw_rank) if raw_rank is not None else None

        rdate = _parse_iso(block.get("date")) or today

        rows.append({
            "source":             source,
            "ranking":            rank,
            "rating":             rating,
            "rating_approximate": rating_approx,
            "ranking_date":       rdate,
            "raw_data":           block,
        })

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
# Activity page parser  (/player/activity.asp?id=<pid>)
# ---------------------------------------------------------------------------

# Known round codes and their canonical labels
_ROUND_LABELS = {
    "128":  "R128",
    "64":   "R64",
    "32":   "R32",
    "16":   "R16",
    "Q":    "QF",
    "S":    "SF",
    "F":    "F",
    "RR":   "RR",    # round-robin group stage
    "PL-F": "PL-F",  # placement final (e.g. Kalamazoo)
}


def _normalise_round(raw: str) -> str:
    """Map the site's round code to a clean label; fall back to the raw value."""
    if not raw:
        return raw
    key = raw.strip()
    return _ROUND_LABELS.get(key, key)


def _best_of_from_score(score: str | None) -> int | None:
    """
    Infer best-of from the score string by counting sets.
    Junior draws are always best-of-3.
    """
    if not score:
        return None
    sets = [s for s in re.split(r"[;, ]+", score) if s]
    return 3 if sets else None


def _parse_tournament_header(bio_table) -> dict:
    """
    Extract metadata from a <table class=bio> tournament block.

    Structure:
        <tr><th colspan=2>TOURNAMENT NAME</th></tr>
        <tr>
          <td class=description>Date range\\nLocation, COUNTRY</td>
          <td class=description>Draw type\\n<a>Complete Results</a></td>
        </tr>
    """
    info = {
        "tournament_name": None,
        "start_date":      None,
        "end_date":        None,
        "location":        None,
        "draw_type":       None,
        "results_url":     None,
    }

    # Tournament name from <th>
    th = bio_table.find("th")
    if th:
        info["tournament_name"] = _clean(th.get_text())

    # Description cells
    desc_cells = bio_table.find_all("td", class_="description")
    if len(desc_cells) >= 1:
        lines = [_clean(l) for l in desc_cells[0].get_text("\n").split("\n") if _clean(l)]
        if lines:
            info["start_date"], info["end_date"] = _parse_date_range(lines[0])
        if len(lines) >= 2:
            info["location"] = lines[1]

    if len(desc_cells) >= 2:
        lines = [_clean(l) for l in desc_cells[1].get_text("\n").split("\n") if _clean(l)]
        if lines:
            draw_line = next((l for l in lines if "complete results" not in l.lower()), None)
            info["draw_type"] = draw_line

        link = desc_cells[1].find("a")
        if link:
            info["results_url"] = _clean(link.get("href"))

    return info


def _extract_player_link(cell) -> tuple[str | None, int | None]:
    """
    Extract (player_name, source_id) from a result table cell.

    The cell may contain:
      - A plain <a> tag:
            <a href="/player/activity.asp?id=1019268">Thijs Boogaard</a>
      - A nested table (flagged international player):
            <table class=simple><tr>
              <td><a href="...?id=1029130">V. Gurenko</a></td>
              <td><img src=".../CAN.gif"></td>
            </tr></table>
      - &nbsp; / empty (the "other side" of the result)

    Returns (None, None) when the cell is empty.
    """
    link = cell.find("a")
    if not link:
        return None, None

    name = _clean(link.get_text())
    if not name:
        return None, None

    href = link.get("href", "")
    m    = re.search(r"[?&]id=(\d+)", href)
    source_id = int(m.group(1)) if m else None

    # Strip trailing seeding "(12)" and class-year "('27)" or "('25)"
    name = re.sub(r"\s*\(\d+\)\s*$", "", name).strip()      # seeding: (12)
    name = re.sub(r"\s*\('\d+\)\s*$", "", name).strip()     # class year: ('27)

    return name, source_id


def _is_empty_cell(cell) -> bool:
    """Return True if a result cell contains no meaningful content (no <a> tag)."""
    return cell.find("a") is None


def _looks_like_score(text: str | None) -> bool:
    """
    Basic sanity check: a score string contains digits and set separators.
    e.g. "6-4;6-1", "2-6;7-6(5);6-1", "Walkover*"
    Rejects strings that look like player names (no digits at all, or no dash).
    """
    if not text:
        return False
    return bool(re.search(r"\d", text)) and ("-" in text or text.lower() == "walkover")


def _parse_match_row(row, player_source_id: int, tournament: dict) -> dict | None:
    """
    Parse a single result <tr> inside the inner results table.

    Columns (activity page):  Round | Wins | Losses | Score
    Columns (overview page):  Date  | Wins | Losses | Score

    FIX (issue 1): Previously used cell index [3] for score unconditionally,
    which broke when a cell contained a nested table (flag icon) causing
    BeautifulSoup to count inner <td>s and misalign the column indices.

    The fix: locate the Round, Win-player, Loss-player, and Score cells
    explicitly by their content rather than relying on positional indices.
    Score is identified as the last <td> whose text looks like a score;
    Win/Loss are identified by which one contains an <a> tag vs. is empty.

    A footnote asterisk (*) in the score marks a walkover — excluded per
    the site's own note that these are not counted in ranking calculations.
    """
    # Collect only the *direct* <td> children of this row, not nested ones.
    # This is the key fix: find_all("td") without recursive=False descends
    # into nested tables and picks up flag-cell <td>s as extra columns.
    cells = row.find_all("td", recursive=False)

    if len(cells) < 3:
        return None

    # ----------------------------------------------------------------
    # Identify the score cell: last direct <td> whose text looks like
    # a score, or unconditionally the last cell if it contains digits.
    # ----------------------------------------------------------------
    score_text = _clean(cells[-1].get_text())

    # Skip header rows
    if score_text in (None, "Score") or score_text == "Round":
        return None

    # Skip walkovers (asterisk = not counted in ranking calc)
    if score_text and "*" in score_text:
        return None

    # Reject rows where the last cell is clearly a player name, not a score
    if not _looks_like_score(score_text):
        return None

    # ----------------------------------------------------------------
    # Identify round cell (first direct <td>) and the two player cells.
    # The activity page has 4 direct cells: Round, Win, Loss, Score.
    # The overview page may have a Date cell prepended — we detect this
    # by checking whether cells[0] contains a date-like string.
    # ----------------------------------------------------------------
    if len(cells) >= 4:
        # Check if cells[0] looks like a date (e.g. "12/8/25", "10/22/25")
        first_text = _clean(cells[0].get_text()) or ""
        if re.match(r"^\d{1,2}/\d{1,2}/\d{2,4}$", first_text):
            # Overview page row: Date | Win | Loss | Score
            round_raw  = None
            win_cell   = cells[1]
            loss_cell  = cells[2]
        else:
            # Activity page row: Round | Win | Loss | Score
            round_raw = _clean(cells[0].get_text())
            win_cell  = cells[1]
            loss_cell = cells[2]
    elif len(cells) == 3:
        # Minimal row: Round | Win-or-Loss | Score  — shouldn't normally occur
        return None
    else:
        return None

    # Skip column-header rows
    if round_raw and round_raw.lower() in ("round", "r"):
        return None

    # ----------------------------------------------------------------
    # Determine outcome from which player cell has content
    # ----------------------------------------------------------------
    win_name,  win_id  = _extract_player_link(win_cell)
    loss_name, loss_id = _extract_player_link(loss_cell)

    if win_name and not loss_name:
        outcome      = "win"
        opp_name     = win_name
        opp_source_id = win_id
    elif loss_name and not win_name:
        outcome       = "loss"
        opp_name      = loss_name
        opp_source_id = loss_id
    else:
        # Both populated or both empty — malformed row, skip
        return None

    round_label = _normalise_round(round_raw) if round_raw else None

    return {
        "_player_source_id":   player_source_id,
        "_opponent_source_id": opp_source_id,
        "opponent_name":       opp_name,
        "outcome":             outcome,
        "score":               score_text,
        "round":               round_label,
        "best_of":             _best_of_from_score(score_text),
        "status":              "completed",
        # Use tournament start date as the match date (most specific we have)
        "played_at":           tournament.get("start_date"),
        "tournament_name":     tournament.get("tournament_name"),
        "tournament_start":    tournament.get("start_date"),
        "tournament_end":      tournament.get("end_date"),
        "tournament_location": tournament.get("location"),
        "draw_type":           tournament.get("draw_type"),
        "results_url":         tournament.get("results_url"),
        "source":              "tennisrecruiting.net",
        "raw_data": {
            "round_raw":  round_raw,
            "score_raw":  score_text,
            "outcome":    outcome,
        },
    }


def parse_activity(soup, player_source_id: int) -> list[dict]:
    """
    Parse a BeautifulSoup of a tennisrecruiting.net activity page
    (/player/activity.asp?id=<pid>).

    Returns a list of match-result dicts suitable for the match_results table.

    Parameters
    ----------
    soup              : bs4.BeautifulSoup of the activity page
    player_source_id  : int  — the site's integer player ID
    """
    results = []

    # Each tournament is a <table class=bio> block
    for bio_table in soup.find_all("table", class_="bio"):
        tournament = _parse_tournament_header(bio_table)

        # The inner results table has border=1 and lives inside a <td>
        inner = bio_table.find("table", border="1")
        if not inner:
            continue

        for row in inner.find_all("tr"):
            match = _parse_match_row(row, player_source_id, tournament)
            if match:
                results.append(match)

    return results


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def parse_profile(soup) -> dict[str, Any]:
    """
    Parse a BeautifulSoup of a tennisrecruiting.net player profile page.

    match_results is intentionally empty here -- populate it separately
    by calling parse_activity() with the activity page soup.

    Parameters
    ----------
    soup : bs4.BeautifulSoup of /player.asp?id=<pid>  (the overview page)

    Returns
    -------
    {
        "player":        dict,        # columns for public.players
        "player_extra":  dict,        # extra fields (no dedicated column);
                                      # store in raw_data jsonb or a side table
        "aliases":       list[dict],  # rows for player_aliases
        "rankings":      list[dict],  # rows for player_rankings
        "match_results": list[dict],  # empty; fill with parse_activity()
    }
    """
    page   = _extract_page_json(soup)
    parsed = _parse_player(page)   # {"player": {...}, "player_extra": {...}}

    return {
        "player":        parsed["player"],
        "player_extra":  parsed["player_extra"],
        "aliases":       _parse_aliases(page),
        "rankings":      _parse_rankings(page),
        "match_results": [],   # populate via parse_activity()
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
        print("  python tennis_recruiting_profile.py <path_to_html>    # local profile HTML")
        print("  python tennis_recruiting_profile.py <player_id>       # fetch both pages live")
        print()
        print("To test activity parsing from a local HTML file:")
        print("  python tennis_recruiting_profile.py --activity <path_to_activity_html> <player_id>")
        sys.exit(1)

    # --activity <file> <pid>  — parse a local activity page
    if sys.argv[1] == "--activity" and len(sys.argv) >= 4:
        with open(sys.argv[2], encoding="utf-8", errors="replace") as f:
            html_text = f.read()
        pid  = int(sys.argv[3])
        soup = BeautifulSoup(html_text, "html.parser")
        matches = parse_activity(soup, pid)
        print(_json.dumps(matches, indent=2, default=str))
        sys.exit(0)

    arg = sys.argv[1]

    if arg.isdigit():
        import requests
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"
            )
        }
        base = "https://www.tennisrecruiting.net"
        pid  = int(arg)

        print(f"Fetching profile for player {pid} ...", file=sys.stderr)
        profile_resp  = requests.get(f"{base}/player.asp?id={pid}",          headers=headers, timeout=15)
        activity_resp = requests.get(f"{base}/player/activity.asp?id={pid}", headers=headers, timeout=15)
        profile_resp.raise_for_status()
        activity_resp.raise_for_status()

        profile_soup  = BeautifulSoup(profile_resp.text,  "html.parser")
        activity_soup = BeautifulSoup(activity_resp.text, "html.parser")

        data = parse_profile(profile_soup)
        data["match_results"] = parse_activity(activity_soup, pid)

    else:
        with open(arg, encoding="utf-8", errors="replace") as f:
            html_text = f.read()
        profile_soup = BeautifulSoup(html_text, "html.parser")
        data = parse_profile(profile_soup)
        # No activity page supplied — match_results will be empty

    print(_json.dumps(data, indent=2, default=str))