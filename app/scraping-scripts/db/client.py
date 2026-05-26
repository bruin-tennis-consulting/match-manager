"""
db/client.py
============
Supabase client and shared DB utilities.

Resolution helpers (resolve_player_id, resolve_player_ids_batch) have been
removed — that logic now lives in resolution.py.
"""

import os
from pathlib import Path
from datetime import datetime, timezone
from supabase import create_client, Client
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------
load_dotenv(Path(__file__).resolve().parent.parent.parent.parent / ".env")

SUPABASE_URL: str = os.environ["SUPABASE_URL"]
SUPABASE_KEY: str = os.environ["SUPABASE_KEY"]   # service role key


supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ---------------------------------------------------------------------------
# Column allow-list for canonical.players
# Used by canonical.py when building upsert payloads.
# ---------------------------------------------------------------------------

PLAYER_COLUMNS = {
    "full_name",
    "first_name",
    "last_name",
    "date_of_birth",
    "grad_year",
    "gender",
    "region",
    "country_code",
    "height",
    "dominant_hand",
    "play_style",
    "utr_id",
    "usta_id",
    "ita_id",
}


# ---------------------------------------------------------------------------
# Ingest job helpers  (raw.ingest_jobs)
# ---------------------------------------------------------------------------

def create_job(source: str, metadata: dict | None = None) -> dict:
    """Insert a new ingest job row and return it."""
    row = {
        "source":     source,
        "status":     "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "metadata":   metadata or {},
    }
    result = supabase.schema("raw").table("ingest_jobs").insert(row).execute()
    return result.data[0]


def finish_job(
    job_id: str,
    status: str,
    records_ingested: int = 0,
    error_message: str | None = None,
) -> None:
    """Update an ingest job row on completion."""
    supabase.schema("raw").table("ingest_jobs").update(
        {
            "status":            status,
            "records_ingested":  records_ingested,
            "error_message":     error_message,
            "finished_at":       datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", job_id).execute()