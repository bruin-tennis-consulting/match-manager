"""
ingest_pipeline.py
==================
Ingests player profiles and homepage rankings from tennisrecruiting.net
into Supabase.

Run directly:
    python ingest_pipeline.py

Or import and call individual functions:
    from ingest_pipeline import ingest_player_profile, ingest_homepage_rankings
"""

import os
from pathlib import Path
import re
from datetime import datetime, timezone

from bs4 import BeautifulSoup
from supabase import create_client
from dotenv import load_dotenv

from tennis_recruiting_profile import parse_profile
from tennis_recruiting_top10 import fetch_from_web, parse_rankings

# ---------------------------------------------------------------------------
# Supabase client
# ---------------------------------------------------------------------------
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_KEY"],
)

# ---------------------------------------------------------------------------
# Entity resolution
# ---------------------------------------------------------------------------

def resolve_player_id(source: str, alias: str, fallback_name: str | None = None) -> str:
    """
    Returns the internal players.id for a given (source, alias_name) pair.

    If no alias record exists yet, creates a new player row (using
    fallback_name if provided) and registers the alias at confidence=1.0.
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

    # No existing alias — create a stub player
    player = supabase.table("players").insert({
        "full_name": fallback_name or f"Unknown ({alias})",
    }).execute()

    player_id = player.data[0]["id"]

    supabase.table("player_aliases").insert({
        "player_id":  player_id,
        "source":     source,
        "alias_name": str(alias),
        "confidence": 1.0,
    }).execute()

    return player_id


def extract_source_id_from_url(url: str) -> str | None:
    """Extracts the integer player ID from a tennisrecruiting.net profile URL."""
    m = re.search(r"[?&]id=(\d+)", url)
    return m.group(1) if m else None


# ---------------------------------------------------------------------------
# Job tracking
# ---------------------------------------------------------------------------

def create_job(source: str) -> dict:
    job = supabase.table("ingest_jobs").insert({
        "source":     source,
        "status":     "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "metadata":   {},
    }).execute()
    return job.data[0]


def finish_job(job_id: str, status: str, count: int = 0, error: str | None = None):
    supabase.table("ingest_jobs").update({
        "status":            status,
        "records_ingested":  count,
        "error_message":     error,
        "finished_at":       datetime.now(timezone.utc).isoformat(),
    }).eq("id", job_id).execute()


# ---------------------------------------------------------------------------
# Profile ingestion
# ---------------------------------------------------------------------------

def ingest_player_profile(source_player_id: int) -> int:
    """
    Fetches and ingests a single player profile by tennisrecruiting.net ID.
    Returns the number of records written (1 on success).
    """
    url  = f"https://www.tennisrecruiting.net/player.asp?id={source_player_id}"
    soup = fetch_from_web(url)
    data = parse_profile(soup)

    player  = data["player"]
    aliases = data["aliases"]   # list[{alias_name, source, confidence}]

    # ------------------------------------------------------------------
    # 1. Resolve or create the internal player ID via the primary alias
    # ------------------------------------------------------------------
    internal_id = resolve_player_id(
        source="tennisrecruiting.net",
        alias=player["_source_id"],
        fallback_name=player["full_name"],
    )

    # ------------------------------------------------------------------
    # 2. Update the players row with the latest profile data
    # ------------------------------------------------------------------
    supabase.table("players").update({
        "full_name":    player["full_name"],
        "first_name":   player["first_name"],
        "last_name":    player["last_name"],
        "grad_year":    player["grad_year"],
        "region":       player["region"],
        "country_code": player["country_code"],
        "gender":       player["gender"],
    }).eq("id", internal_id).execute()

    # ------------------------------------------------------------------
    # 3. Upsert all aliases (USTA, ITF, UTR, WTN, tennisrecruiting.net)
    # ------------------------------------------------------------------
    for alias in aliases:
        supabase.table("player_aliases").upsert(
            {**alias, "player_id": internal_id},
            on_conflict="source,alias_name",
        ).execute()

    # ------------------------------------------------------------------
    # 4. Rankings — fold extra fields (rating, rating_approximate) into
    #    raw_data since they have no dedicated column in player_rankings
    # ------------------------------------------------------------------
    ranking_rows = []
    for r in data["rankings"]:
        raw = {
            **(r.get("raw_data") or {}),
            "rating":             r.get("rating"),
            "rating_approximate": r.get("rating_approximate"),
        }
        ranking_rows.append({
            "player_id":    internal_id,
            "source":       r["source"],
            "ranking":      r["ranking"],
            "ranking_date": r["ranking_date"],
            "raw_data":     raw,
        })

    if ranking_rows:
        supabase.table("player_rankings").insert(ranking_rows).execute()

    # ------------------------------------------------------------------
    # 5. Match results — resolve each opponent to an internal UUID
    # ------------------------------------------------------------------
    match_rows = []
    for m in data["match_results"]:
        opponent_id = None
        if m["_opponent_source_id"]:
            opponent_id = resolve_player_id(
                source="tennisrecruiting.net",
                alias=m["_opponent_source_id"],
                fallback_name=m["opponent_name"],
            )

        winner_id = internal_id if m["outcome"] == "win" else opponent_id

        match_rows.append({
            "player_id":   internal_id,
            "opponent_id": opponent_id,
            "winner_id":   winner_id,
            "outcome":     m["outcome"],
            "score":       m["score"],
            "round":       m["round"],
            "best_of":     m["best_of"],
            "status":      m["status"],
            "played_at":   m["played_at"],
            "source":      m["source"],
            "raw_data":    m["raw_data"],
        })

    if match_rows:
        supabase.table("match_results").insert(match_rows).execute()

    return 1


# ---------------------------------------------------------------------------
# Homepage top-10 rankings ingestion
# ---------------------------------------------------------------------------

def ingest_homepage_rankings() -> int:
    """
    Scrapes the homepage top-10 CRL/RPI rankings for every class year
    and writes them to player_rankings.

    Each player URL contains their site ID, which is used to resolve
    (or create) their internal UUID via player_aliases.

    Returns the number of ranking rows inserted.
    """
    soup    = fetch_from_web("https://www.tennisrecruiting.net/")
    results = parse_rankings(soup)   # results[rank_type][year]["boys"|"girls"]

    today = datetime.now(timezone.utc).date().isoformat()
    rows  = []

    for rank_type, years in results.items():
        source = f"tennisrecruiting_{rank_type.lower()}"   # e.g. "tennisrecruiting_crl"

        for year, data in years.items():
            for gender in ("boys", "girls"):
                for rank, name, url in data.get(gender, []):
                    source_id = extract_source_id_from_url(url)

                    if not source_id:
                        print(f"  [!] No source ID in URL for {name} ({url}) — skipping")
                        continue

                    player_id = resolve_player_id(
                        source="tennisrecruiting.net",
                        alias=source_id,
                        fallback_name=name,
                    )

                    rows.append({
                        "player_id":    player_id,
                        "source":       source,
                        "ranking":      rank,
                        "ranking_date": today,
                        "raw_data": {
                            "rank_type":  rank_type,
                            "class_year": year,
                            "gender":     gender,
                            "name":       name,
                            "url":        url,
                        },
                    })

    if rows:
        supabase.table("player_rankings").insert(rows).execute()

    return len(rows)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    job   = create_job("tennis_recruiting_ingest")
    total = 0

    try:
        # Ingest a single player profile (expand to a list/loop as needed)
        total += ingest_player_profile(928355)

        # Ingest homepage top-10 rankings for all class years / rank types
        total += ingest_homepage_rankings()

        finish_job(job["id"], "success", total)
        print(f"Done — {total} records ingested.")

    except Exception as e:
        finish_job(job["id"], "failed", total, str(e))
        raise


if __name__ == "__main__":
    main()