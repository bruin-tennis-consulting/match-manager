"""
scrapers/usta_ingest.py
=======================
Writes USTA standings scrape payloads into the raw schema only.
No canonical resolution happens here.

Flow: scrape -> raw.players / raw.rankings

Public API
----------
    ingest_usta_rankings() -> int   # returns number of players written
"""

from datetime import datetime, timezone

from usta_scraper import scrape_all
from db.client import supabase

_SOURCE = "USTA"

_raw = lambda table: supabase.schema("raw").table(table)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# raw.players
# ---------------------------------------------------------------------------

def _upsert_raw_player(source_id: str, player: dict, player_extra: dict, raw: dict) -> None:
    """
    Upsert one USTA player into raw.players.
    source_id = USTA uaid (or full_name as fallback).
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
    Upsert one USTA ranking snapshot into raw.rankings.
    ranking_type encodes age_division + gender so each combination gets its
    own row and they don't clobber each other.
    Uniqueness: (source, source_player_id, ranking_type, ranking_date).
    """
    age_division = player_extra.get("age_division", "unknown")
    gender       = player.get("gender", "unknown")

    _raw("rankings").upsert(
        {
            "source":           _SOURCE,
            "source_player_id": source_id,
            "ranking_type":     f"usta_national_{age_division}_{gender}",
            "rank_value":       float(player_extra["usta_ranking"]) if player_extra.get("usta_ranking") else None,
            "ranking_date":     today,
            "raw_json": {
                "usta_points":    player_extra.get("usta_points"),
                "singles_points": player_extra.get("singles_points"),
                "doubles_points": player_extra.get("doubles_points"),
                "bonus_points":   player_extra.get("bonus_points"),
                "city":           player_extra.get("city"),
                "state":          player_extra.get("state"),
                "section":        player_extra.get("section"),
                "district":       player_extra.get("district"),
                "age_division":   age_division,
            },
            "scraped_at": _now(),
        },
        on_conflict="source,source_player_id,ranking_type,ranking_date",
    ).execute()


# ---------------------------------------------------------------------------
# Public
# ---------------------------------------------------------------------------

def ingest_usta_rankings() -> int:
    """
    Scrape USTA national junior standings and write to raw.players + raw.rankings.
    Returns the number of players successfully written.
    """
    players = scrape_all()
    today   = datetime.now(timezone.utc).date().isoformat()
    total   = 0

    for entry in players:
        player       = entry["player"]
        player_extra = entry["player_extra"]
        source_id    = str(player["_source_id"] or player.get("full_name") or "")

        if not source_id:
            print(f"  [!] No source ID for {player.get('full_name')} — skipping")
            continue

        _upsert_raw_player(source_id, player, player_extra, entry.get("raw", {}))
        _upsert_raw_ranking(source_id, player, player_extra, today)

        print(
            f"  [{source_id}] {player.get('full_name', '?'):30s}"
            f" | rank {str(player_extra.get('usta_ranking') or '?'):>4}"
            f" | {player_extra.get('age_division')} {player.get('gender', '?')}"
            f"  -> raw"
        )
        total += 1

    return total