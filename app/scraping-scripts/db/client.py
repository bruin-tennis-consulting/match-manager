"""
db/client.py
============
Supabase client and shared DB utilities.
"""

import os
from pathlib import Path
from datetime import datetime, timezone
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent.parent.parent / ".env")
# load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

SUPABASE_URL: str = os.environ["SUPABASE_URL"]
SUPABASE_KEY: str = os.environ["SUPABASE_KEY"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Allow-list of columns that exist on canonical.players.
# Used by resolution.py when building insert/update payloads.
PLAYER_COLUMNS = {
    "full_name", "first_name", "last_name", "date_of_birth",
    "grad_year", "gender", "region", "country_code",
    "height", "dominant_hand", "play_style",
    "utr_id", "usta_id", "ita_id",
}

_raw = lambda t: supabase.schema("raw").table(t)

def fetch_all(schema: str, table_name: str, select_str: str = "*", in_filter: tuple[str, list] | None = None) -> list[dict]:
    """Fetch all rows from a table, paginating past Supabase's 1000-row limit."""
    all_rows = []
    page_size = 1000
    start = 0
    while True:
        query = supabase.schema(schema).table(table_name).select(select_str)
        if in_filter and in_filter[1]:
            query = query.in_(in_filter[0], in_filter[1])
        result = query.range(start, start + page_size - 1).execute()
        
        data = result.data or []
        all_rows.extend(data)
        
        if len(data) < page_size:
            break
        start += page_size
        
    return all_rows


def create_job(source: str, metadata: dict | None = None) -> dict:
    """Insert a new ingest job row into raw.ingest_jobs and return it."""
    result = _raw("ingest_jobs").insert(
        {
            "source":     source,
            "status":     "running",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "metadata":   metadata or {},
        }
    ).execute()
    return result.data[0]


def finish_job(
    job_id: str,
    status: str,
    records_ingested: int = 0,
    error_message: str | None = None,
) -> None:
    """Update a raw.ingest_jobs row on completion."""
    _raw("ingest_jobs").update(
        {
            "status":           status,
            "records_ingested": records_ingested,
            "error_message":    error_message,
            "finished_at":      datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", job_id).execute()