"""
db/client.py
============
Shared Supabase client and helper functions used by all ingest pipelines.

Each pipeline imports from here:
    from db.client import supabase, resolve_player_id, create_job, finish_job

Once all pipelines have migrated to import from here, the duplicate copies
of these functions in each ingest pipeline file can be deleted.
"""

import os
from pathlib import Path
from datetime import datetime, timezone

from supabase import create_client
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Supabase client
# ---------------------------------------------------------------------------

load_dotenv(Path(__file__).resolve().parent.parent.parent.parent / ".env")

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_KEY"],
)

# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

# Exact columns on public.players — any key not in this set is dropped before
# writing to the DB. Update this when the schema changes.
PLAYER_COLUMNS = {
    "full_name", "first_name", "last_name", "date_of_birth",
    "grad_year", "region", "country_code", "height",
    "dominant_hand", "play_style", "gender",
}

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _split_name(full_name: str | None) -> tuple[str | None, str | None]:
    if not full_name:
        return None, None
    parts = full_name.strip().split(None, 1)
    if len(parts) == 2:
        return parts[0], parts[1]
    return parts[0], None


def _build_player_row(
    player_fields: dict | None,
    fallback_name: str | None,
    alias: str,
) -> dict:
    if player_fields:
        row = {k: v for k, v in player_fields.items() if k in PLAYER_COLUMNS and v is not None}
    else:
        row = {}

    if not row.get("full_name"):
        row["full_name"] = fallback_name or f"Unknown ({alias})"

    if not row.get("first_name") and not row.get("last_name"):
        first, last = _split_name(row["full_name"])
        if first:
            row["first_name"] = first
        if last:
            row["last_name"] = last

    return row

# ---------------------------------------------------------------------------
# Entity resolution
# ---------------------------------------------------------------------------

def resolve_player_id(
    source: str,
    alias: str,
    fallback_name: str | None = None,
    player_fields: dict | None = None,
) -> str:
    """
    Find or create a player by their source-specific ID.

    Checks player_aliases for an existing record. If found, returns the
    internal UUID. If not, creates a new player row and alias and returns
    the new UUID.

    Parameters
    ----------
    source        : the data source name, e.g. "UTR", "USTA", "tennisrecruiting.net"
    alias         : the player's ID in that source, e.g. utr_id or tennisrecruiting pid
    fallback_name : used as full_name if player_fields has no name
    player_fields : dict of player data mapped to PLAYER_COLUMNS
    """
    res = (
        supabase.table("player_aliases")
        .select("player_id")
        .eq("source", source)
        .eq("alias_name", str(alias))
        .limit(1)
        .execute()
    )

    if res.data:
        return res.data[0]["player_id"]

    row = _build_player_row(player_fields, fallback_name, alias)
    player = supabase.table("players").insert(row).execute()
    player_id = player.data[0]["id"]

    supabase.table("player_aliases").insert({
        "player_id":  player_id,
        "source":     source,
        "alias_name": str(alias),
        "confidence": 1.0,
    }).execute()

    return player_id


def resolve_player_ids_batch(source: str, aliases: list[dict]) -> dict[str, str]:
    """
    Bulk version of resolve_player_id. Minimises round trips by checking all
    aliases in one query and inserting all missing players in one batch.

    Parameters
    ----------
    source  : the data source name
    aliases : list of dicts with keys:
                alias         — source-specific player ID (required)
                fallback_name — player name string (optional)
                player_fields — dict mapped to PLAYER_COLUMNS (optional)

    Returns
    -------
    dict mapping alias string → internal Supabase UUID
    """
    alias_strs = [str(a["alias"]) for a in aliases]

    existing = (
        supabase.table("player_aliases")
        .select("alias_name, player_id")
        .eq("source", source)
        .in_("alias_name", alias_strs)
        .execute()
    )
    resolved = {row["alias_name"]: row["player_id"] for row in existing.data}

    missing = [a for a in aliases if str(a["alias"]) not in resolved]
    if not missing:
        return resolved

    stub_rows = [
        _build_player_row(a.get("player_fields"), a.get("fallback_name"), a["alias"])
        for a in missing
    ]
    created = supabase.table("players").insert(stub_rows).execute()

    new_aliases = []
    for a, player_row in zip(missing, created.data):
        player_id = player_row["id"]
        alias_str = str(a["alias"])
        resolved[alias_str] = player_id
        new_aliases.append({
            "player_id":  player_id,
            "source":     source,
            "alias_name": alias_str,
            "confidence": 1.0,
        })

    supabase.table("player_aliases").insert(new_aliases).execute()

    return resolved

# ---------------------------------------------------------------------------
# Job tracking
# ---------------------------------------------------------------------------

def create_job(source: str, metadata: dict | None = None) -> dict:
    """Insert a running ingest_jobs row and return it."""
    job = supabase.table("ingest_jobs").insert({
        "source":     source,
        "status":     "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "metadata":   metadata or {},
    }).execute()
    return job.data[0]


def finish_job(job_id: str, status: str, count: int = 0, error: str | None = None):
    """Update an ingest_jobs row with the final status and record count."""
    supabase.table("ingest_jobs").update({
        "status":           status,
        "records_ingested": count,
        "error_message":    error,
        "finished_at":      datetime.now(timezone.utc).isoformat(),
    }).eq("id", job_id).execute()
