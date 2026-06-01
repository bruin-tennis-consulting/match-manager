"""
scrapers/utr_ingest.py
======================
Writes UTR rankings scrape payloads into the raw schema only.
No canonical resolution happens here.

Flow: scrape -> raw.players / raw.rankings

Public API
----------
    ingest_utr_rankings() -> int   # returns number of players written
"""

from datetime import datetime, timezone

from utr_scraper import scrape_all
from db.client import supabase

_SOURCE = "UTR"

_raw = lambda table: supabase.schema("raw").table(table)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# raw.players
# ---------------------------------------------------------------------------

def _upsert_raw_player(source_id: str, player: dict, player_extra: dict, raw: dict) -> None:
    """
    Upsert one UTR player into raw.players.
    source_id = UTR integer player ID (always present from API).
    Uniqueness: (source, source_id).
    """
    _raw("players").upsert(
        {
            "source":     _SOURCE,
            "source_id":  source_id,
            "raw_json": {
                "player":       player,
                "player_extra": player_extra,
                "raw":          raw,
            },
            "scraped_at": _now(),
        },
        on_conflict="source,source_id",
    ).execute()


# ---------------------------------------------------------------------------
# raw.rankings
# ---------------------------------------------------------------------------

def _upsert_raw_ranking(source_id: str, player: dict, player_extra: dict, today: str) -> None:
    """
    Upsert one UTR ranking snapshot into raw.rankings.
    ranking_type encodes scraped_tag + gender so HighSchool/U18/U16 don't
    clobber each other for the same player.
    Uniqueness: (source, source_player_id, ranking_type, ranking_date).
    """
    scraped_tag = player_extra.get("scraped_tag", "unknown")
    gender      = player.get("gender", "unknown")

    _raw("rankings").upsert(
        {
            "source":           _SOURCE,
            "source_player_id": source_id,
            "ranking_type":     f"utr_{scraped_tag.lower()}_{gender}",
            # rank_value stores the float UTR rating; the positional rank is in raw_json
            "rank_value":       player_extra.get("utr_rating"),
            "ranking_date":     today,
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


# ---------------------------------------------------------------------------
# Public
# ---------------------------------------------------------------------------

def ingest_utr_rankings() -> int:
    """
    Scrape UTR junior rankings and write to raw.players + raw.rankings.
    Returns the number of players successfully written.
    """
    players = scrape_all()
    today   = datetime.now(timezone.utc).date().isoformat()
    total   = 0

    for entry in players:
        player       = entry["player"]
        player_extra = entry["player_extra"]
        source_id    = str(player["_source_id"] or "")

        if not source_id:
            print(f"  [!] No UTR ID for {player.get('full_name')} — skipping")
            continue

        _upsert_raw_player(source_id, player, player_extra, entry.get("raw", {}))
        _upsert_raw_ranking(source_id, player, player_extra, today)

        print(
            f"  [{source_id}] {player.get('full_name', '?'):30s}"
            f" | rank {str(player_extra.get('utr_ranking') or '?'):>4}"
            f" | UTR {player_extra.get('utr_rating')}"
            f" | {player_extra.get('scraped_tag')}"
            f"  -> raw"
        )
        total += 1

    return total