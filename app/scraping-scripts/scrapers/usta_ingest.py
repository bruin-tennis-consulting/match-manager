"""
scrapers/usta_ingest.py
=======================
Writes USTA standings scrape payloads into the raw.* layer only.
No canonical resolution happens here.
"""

from datetime import datetime, timezone

from usta_scraper import scrape_all
from db.client import supabase

_SOURCE = "USTA"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def ingest_usta_rankings() -> int:
    """
    Scrape USTA national junior standings and write to raw.players + raw.rankings.
    Returns the number of players written.
    """
    players = scrape_all()
    today   = datetime.now(timezone.utc).date().isoformat()
    total   = 0

    for entry in players:
        player       = entry["player"]
        player_extra = entry["player_extra"]
        source_id    = player["_source_id"] or player.get("full_name")

        if not source_id:
            print(f"  [!] No source ID for {player.get('full_name')} — skipping")
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
        # raw.rankings — one row per age_division + ranking_date snapshot
        # ------------------------------------------------------------------
        age_division = player_extra.get("age_division", "unknown")
        gender       = player.get("gender", "unknown")
        ranking_type = f"usta_national_{age_division}_{gender}"

        supabase.schema("raw").table("rankings").upsert(
            {
                "source":            _SOURCE,
                "source_player_id":  str(source_id),
                "ranking_type":      ranking_type,
                "rank_value":        float(player_extra["usta_ranking"]) if player_extra.get("usta_ranking") else None,
                "ranking_date":      today,
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

        print(
            f"  [{source_id}] {player.get('full_name', '?'):30s}"
            f" | rank {str(player_extra.get('usta_ranking') or '?'):>4}"
            f" | {age_division} {gender}"
        )
        total += 1

    return total