"""
usta_ingest_pipeline.py
=======================
Ingests USTA national junior standings into Supabase.

Run directly:
    python usta_ingest_pipeline.py

Or import and call individual functions:
    from usta_ingest_pipeline import ingest_usta_rankings

Tables written to:
    players         — upserts canonical player profile fields
    player_aliases  — maps uaid → internal player UUID (source="USTA")
    player_rankings — one ranking row per player per run date
"""

from datetime import datetime, timezone

from db.client import (
    supabase,
    PLAYER_COLUMNS,
    resolve_player_id,
    create_job,
    finish_job,
)
from usta_scraper import scrape_all

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SOURCE = "USTA"

# ---------------------------------------------------------------------------
# Ingestion
# ---------------------------------------------------------------------------

def ingest_usta_rankings() -> int:
    """
    Scrape USTA national junior standings, resolve players, and write to Supabase.
    Returns the number of players successfully ingested.
    """
    players = scrape_all()
    today   = datetime.now(timezone.utc).date().isoformat()
    total   = 0
    failed  = []

    for entry in players:
        player       = entry["player"]
        player_extra = entry["player_extra"]

        try:
            player_id = resolve_player_id(
                source=SOURCE,
                alias=player["_source_id"] or player.get("full_name"),
                fallback_name=player.get("full_name"),
                player_fields=player,
            )

            # Update the player row with any fields we have from USTA
            update_fields = {
                k: v for k, v in player.items()
                if k in PLAYER_COLUMNS and v is not None
            }
            if update_fields:
                supabase.table("players").update(update_fields).eq("id", player_id).execute()

            # Append a ranking snapshot for this run
            supabase.table("player_rankings").upsert(
                {
                    "player_id":    player_id,
                    "source":       SOURCE,
                    "ranking":      player_extra.get("usta_ranking"),
                    "ranking_date": today,
                    "raw_data": {
                        "usta_points":    player_extra.get("usta_points"),
                        "singles_points": player_extra.get("singles_points"),
                        "doubles_points": player_extra.get("doubles_points"),
                        "bonus_points":   player_extra.get("bonus_points"),
                        "city":           player_extra.get("city"),
                        "state":          player_extra.get("state"),
                        "section":        player_extra.get("section"),
                        "district":       player_extra.get("district"),
                        "age_division":   player_extra.get("age_division"),
                    },
                },
                on_conflict="player_id,source,ranking_date",
            ).execute()

            print(
                f"  [{player['_source_id']}] {player.get('full_name', '?'):30s}"
                f" | rank {str(player_extra.get('usta_ranking') or '?'):>4}"
                f" | {player_extra.get('age_division')} {player.get('gender', '?')}"
            )
            total += 1

        except Exception as e:
            print(f"  [!] Failed on player {player.get('_source_id')}: {e}")
            failed.append(player.get("_source_id"))

    if failed:
        print(f"\n  Failed player IDs: {failed}")

    return total


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    print("Starting USTA ingest ...")

    job   = create_job(SOURCE)
    total = 0
    error = None

    try:
        total  = ingest_usta_rankings()
        status = "success"
    except Exception as e:
        print(f"[!] Pipeline failed: {e}")
        status = "failed"
        error  = str(e)

    finish_job(job["id"], status, total, error)
    print(f"\nDone — {total} players ingested.")


if __name__ == "__main__":
    main()
