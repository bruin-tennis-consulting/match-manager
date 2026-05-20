"""
utr_ingest_pipeline.py
======================
Ingests UTR junior rankings into Supabase.

Run directly:
    python utr_ingest_pipeline.py

Or import and call individual functions:
    from utr_ingest_pipeline import ingest_utr_rankings

Tables written to:
    players         — upserts canonical player profile fields
    player_aliases  — maps utr_id → internal player UUID (source="UTR")
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
from utr_scraper import scrape_all

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SOURCE = "UTR"

# ---------------------------------------------------------------------------
# Ingestion
# ---------------------------------------------------------------------------

def ingest_utr_rankings() -> int:
    """
    Scrape UTR rankings, resolve players, and write to Supabase.
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
                alias=player["_source_id"],
                fallback_name=player.get("full_name"),
                player_fields=player,
            )

            # Update the player row with any fields we have from UTR
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
                    "ranking":      player_extra.get("utr_ranking"),
                    "ranking_date": today,
                    "raw_data": {
                        "utr_rating":         player_extra.get("utr_rating"),
                        "three_month_rating": player_extra.get("three_month_rating"),
                        "trend_direction":    player_extra.get("trend_direction"),
                        "scraped_tag":        player_extra.get("scraped_tag"),
                        "high_school":        player_extra.get("high_school"),
                        "high_school_state":  player_extra.get("high_school_state"),
                    },
                },
                on_conflict="player_id,source,ranking_date",
            ).execute()

            print(
                f"  [{player['_source_id']}] {player.get('full_name', '?'):30s}"
                f" | rank {str(player_extra.get('utr_ranking') or '?'):>4}"
                f" | UTR {player_extra.get('utr_rating')}"
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
    print("Starting UTR ingest ...")

    job   = create_job(SOURCE)
    total = 0
    error = None

    try:
        total  = ingest_utr_rankings()
        status = "success"
    except Exception as e:
        print(f"[!] Pipeline failed: {e}")
        status = "failed"
        error  = str(e)

    finish_job(job["id"], status, total, error)
    print(f"\nDone — {total} players ingested.")


if __name__ == "__main__":
    main()
