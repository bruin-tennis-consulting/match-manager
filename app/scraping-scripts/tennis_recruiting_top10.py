"""
Tennis Recruiting Rankings Scraper
Scrapes the top 10 boys/girls for each class year from tennisrecruiting.net
Outputs results to console and saves to a CSV file.

Usage:
    # Scrape live from the web (default):
    python tennis_recruiting_scraper.py

    # Parse a locally saved HTML file instead:
    python tennis_recruiting_scraper.py --file homepage.html

    # Custom output filename:
    python tennis_recruiting_scraper.py --output my_rankings.csv

Requirements:
    pip install requests beautifulsoup4
"""

import csv
import sys
import argparse
import requests
from bs4 import BeautifulSoup

URL = "https://www.tennisrecruiting.net/"

CLASS_YEARS = {
    "2026": "Seniors",
    "2027": "Juniors",
    "2028": "Sophomores",
    "2029": "Freshmen",
    "2030": "8th Graders",
    "2031": "7th Graders",
    "2032": "6th Graders",
}

RANK_TYPES = ["CRL", "RPI"]


# ---------------------------------------------------------------------------
# Fetching
# ---------------------------------------------------------------------------

def fetch_from_web(url: str) -> BeautifulSoup:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }
    session = requests.Session()
    resp = session.get(url, headers=headers, timeout=15)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "html.parser")


def fetch_from_file(path: str) -> BeautifulSoup:
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        html = f.read()
    return BeautifulSoup(html, "html.parser")


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def parse_one_div(div) -> dict:
    """
    Parse a single ranking div (e.g. divCRL2026).

    The table interleaves boys and girls in the same row:
        <tr>
          <td class="right">1.&nbsp;</td>  <td><a>Boy Name</a></td>   <- boy
          <td class="right">1.&nbsp;</td>  <td><a>Girl Name</a></td>  <- girl
        </tr>

    Returns {"boys": [(rank, name, url), ...], "girls": [...]}
    """
    boys, girls = [], []

    for row in div.find_all("tr"):
        cells = row.find_all("td")
        # We expect at least 4 cells: rank_boy | name_boy | rank_girl | name_girl
        # (there's also a spacer <td rowspan=14> but it has no class="right")
        rank_cells = [c for c in cells if "right" in (c.get("class") or [])]

        if len(rank_cells) < 1:
            continue  # header or spacer row

        # First rank cell -> boy
        boy_rank_text = rank_cells[0].get_text(strip=True).rstrip(".")
        if boy_rank_text.isdigit():
            boy_rank = int(boy_rank_text)
            boy_name_cell = rank_cells[0].find_next_sibling("td")
            if boy_name_cell:
                link = boy_name_cell.find("a")
                if link:
                    name = link.get_text(strip=True)
                    href = link.get("href", "")
                    url  = f"https://www.tennisrecruiting.net{href}" if href else ""
                    boys.append((boy_rank, name, url))

        # Second rank cell -> girl
        if len(rank_cells) >= 2:
            girl_rank_text = rank_cells[1].get_text(strip=True).rstrip(".")
            if girl_rank_text.isdigit():
                girl_rank = int(girl_rank_text)
                girl_name_cell = rank_cells[1].find_next_sibling("td")
                if girl_name_cell:
                    link = girl_name_cell.find("a")
                    if link:
                        name = link.get_text(strip=True)
                        href = link.get("href", "")
                        url  = f"https://www.tennisrecruiting.net{href}" if href else ""
                        girls.append((girl_rank, name, url))

    return {"boys": boys[:10], "girls": girls[:10]}


def parse_rankings(soup: BeautifulSoup) -> dict:
    """
    Returns a nested dict:
        results[rank_type][year] = {
            "boys":  [(rank, name, profile_url), ...],   # up to 10
            "girls": [(rank, name, profile_url), ...],   # up to 10
        }
    """
    results = {}
    for rank_type in RANK_TYPES:
        results[rank_type] = {}
        for year in CLASS_YEARS:
            div_id = f"div{rank_type}{year}"
            div = soup.find("div", id=div_id)
            if not div:
                print(f"  [!] Could not find #{div_id} — skipping")
                continue
            results[rank_type][year] = parse_one_div(div)
    return results


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def print_results(results: dict) -> None:
    for rank_type in RANK_TYPES:
        print(f"\n{'='*64}")
        print(f"  {rank_type} RANKINGS")
        print(f"{'='*64}")
        for year, label in CLASS_YEARS.items():
            data = results[rank_type].get(year)
            if not data:
                continue
            print(f"\n  Class of {year} — {label}")
            print(f"  {'#':<4} {'BOYS':<28} GIRLS")
            print(f"  {'-'*58}")
            for i in range(10):
                b_name = data["boys"][i][1]  if i < len(data["boys"])  else "-"
                g_name = data["girls"][i][1] if i < len(data["girls"]) else "-"
                print(f"  {i+1:<4} {b_name:<28} {g_name}")


def save_csv(results: dict, filename: str = "tennis_rankings.csv") -> None:
    rows = []
    for rank_type in RANK_TYPES:
        for year, label in CLASS_YEARS.items():
            data = results[rank_type].get(year)
            if not data:
                continue
            for i in range(10):
                rank = i + 1
                if i < len(data["boys"]):
                    _, b_name, b_url = data["boys"][i]
                    rows.append({
                        "rank_type":   rank_type,
                        "class_year":  year,
                        "class_label": label,
                        "gender":      "Boys",
                        "rank":        rank,
                        "player":      b_name,
                        "profile_url": b_url,
                    })
                if i < len(data["girls"]):
                    _, g_name, g_url = data["girls"][i]
                    rows.append({
                        "rank_type":   rank_type,
                        "class_year":  year,
                        "class_label": label,
                        "gender":      "Girls",
                        "rank":        rank,
                        "player":      g_name,
                        "profile_url": g_url,
                    })

    fieldnames = [
        "rank_type", "class_year", "class_label",
        "gender", "rank", "player", "profile_url",
    ]
    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\n  Saved {len(rows)} rows -> '{filename}'")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Scrape top-10 tennis recruiting rankings from tennisrecruiting.net"
    )
    parser.add_argument(
        "--file", "-f",
        metavar="PATH",
        help="Parse a locally saved HTML file instead of fetching from the web",
    )
    parser.add_argument(
        "--output", "-o",
        metavar="CSV",
        default="tennis_rankings.csv",
        help="Output CSV filename (default: tennis_rankings.csv)",
    )
    args = parser.parse_args()

    if args.file:
        print(f"Reading local file: {args.file}")
        soup = fetch_from_file(args.file)
    else:
        print(f"Fetching {URL} ...")
        try:
            soup = fetch_from_web(URL)
        except requests.HTTPError as e:
            print(f"  [!] HTTP error: {e}")
            sys.exit(1)
        except requests.ConnectionError as e:
            print(f"  [!] Connection error: {e}")
            sys.exit(1)

    print("Parsing rankings...")
    results = parse_rankings(soup)
    print_results(results)
    save_csv(results, args.output)


if __name__ == "__main__":
    main()
