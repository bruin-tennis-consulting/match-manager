"""
scrapers/utr_ingest.py
======================
Writes UTR rankings scrape payloads into the raw.* layer only.
No canonical resolution happens here.
"""

from datetime import datetime, timezone

from utr_scraper import scrape_all
from db.client import supabase

_SOURCE = "UTR"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def ingest_utr_rankings() -> int:
    """
    Scrape UTR junior rankings and write to raw.players + raw.rankings.
    Returns the number of players written.
    """
    players = scrape_all()
    today   = datetime.now(timezone.utc).date().isoformat()
    total   = 0

    for entry in players:
        player       = entry["player"]
        player_extra = entry["player_extra"]
        source_id    = player["_source_id"]  # UTR integer ID — always present

        if not source_id:
            print(f"  [!] No UTR ID for {player.get('full_name')} — skipping")
            continue

        # ------------------------------------------------------------------
        # raw.players
        # ------------------------------------------------------------------
        supabase.schema("raw").table("players").upsert(
            {
                "source":     _SOURCE,
                "source_id":  str(source_id),
                "raw_json": {
                    "player":       player,
                    "player_extra": player_extra,
                    "raw":          entry.get("raw"),
                },
                "scraped_at": _now(),
            },
            on_conflict="source,source_id",
        ).execute()

        # ------------------------------------------------------------------
        # raw.rankings — one row per scraped_tag + ranking_date snapshot.
        # UTR can return a player under multiple tags (HighSchool, U18, U16);
        # each tag gets its own ranking_type so they don't clobber each other.
        # ------------------------------------------------------------------
        scraped_tag  = player_extra.get("scraped_tag", "unknown")
        gender       = player.get("gender", "unknown")
        ranking_type = f"utr_{scraped_tag.lower()}_{gender}"

        supabase.schema("raw").table("rankings").upsert(
            {
                "source":            _SOURCE,
                "source_player_id":  str(source_id),
                "ranking_type":      ranking_type,
                # utr_ranking is a positional rank (int), utr_rating is the float rating
                "rank_value":        player_extra.get("utr_rating"),
                "ranking_date":      today,
                "raw_json": {
                    "utr_ranking":        player_extra.get("utr_ranking"),
                    "utr_rating":         player_extra.get("utr_rating"),
                    "three_month_rating": player_extra.get("three_month_rating"),
                    "trend_direction":    player_extra.get("trend_direction"),
                    "scraped_tag":        scraped_tag,
                    "high_school":        player_extra.get("high_school"),
                    "high_school_state":  player_extra.get("high_school_state"),
                },
                "scraped_at": _now(),
            },
            on_conflict="source,source_player_id,ranking_type,ranking_date",
        ).execute()

        print(
            f"  [{source_id}] {player.get('full_name', '?'):30s}"
            f" | rank {str(player_extra.get('utr_ranking') or '?'):>4}"
            f" | UTR {player_extra.get('utr_rating')}"
            f" | {scraped_tag}"
        )
        total += 1

    return total