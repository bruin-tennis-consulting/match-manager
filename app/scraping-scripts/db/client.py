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
    "utr_id", "usta_id", "ita_id", "image_url",
}

_raw = lambda t: supabase.schema("raw").table(t)

# PostgREST encodes .in_() values into the URL query string.
# Lists beyond ~50 UUIDs push the URL past ~8 KB, returning a raw
# "Bad Request" instead of JSON. Chunk at 50 to stay well clear.
_IN_CHUNK = 50


def fetch_all(
    schema: str,
    table_name: str,
    select_str: str = "*",
    in_filter: tuple[str, list] | None = None,
) -> list[dict]:
    """
    Fetch all rows from a table, handling two limits automatically:

    1. Pagination — Supabase caps responses at 1 000 rows; this loops
       with .range() until the final page.

    2. .in_() URL length — PostgREST serialises filter values into the
       URL, so large ID lists exceed the server's ~8 KB limit.  When
       in_filter is provided the list is split into chunks of _IN_CHUNK
       and the results are merged before returning.

    Args:
        schema:     Supabase schema name (e.g. "raw", "canonical").
        table_name: Table name within that schema.
        select_str: Columns to select (default "*").
        in_filter:  Optional (column, values) tuple — equivalent to
                    .in_(column, values) but safe for large value lists.
    """
    col, values = (in_filter[0], in_filter[1]) if in_filter else (None, None)

    # Chunk the filter values; [None] means "no filter" (single pass, no .in_() call)
    chunks: list[list | None] = (
        [values[i : i + _IN_CHUNK] for i in range(0, len(values), _IN_CHUNK)]
        if values and col
        else [None]
    )

    all_rows: list[dict] = []
    seen_ids: set = set()  # deduplicate across chunks (defensive; shouldn't overlap)

    for chunk in chunks:
        page_size = 1000
        start = 0
        while True:
            query = supabase.schema(schema).table(table_name).select(select_str)
            if chunk is not None:
                query = query.in_(col, chunk)
            result = query.range(start, start + page_size - 1).execute()

            data = result.data or []
            for row in data:
                # Fall back to object id() for tables whose PK isn't named "id"
                row_id = row.get("id") or id(row)
                if row_id not in seen_ids:
                    seen_ids.add(row_id)
                    all_rows.append(row)

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