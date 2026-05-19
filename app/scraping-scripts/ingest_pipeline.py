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

from tennis_recruiting_profile import parse_profile, parse_activity
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

# Columns that exist on public.players -- exactly the schema, nothing more.
# Any key not in this set is silently dropped before writing to the DB.
_PLAYER_COLUMNS = {
    "full_name", "first_name", "last_name", "date_of_birth",
    "grad_year", "region", "country_code", "height",
    "dominant_hand", "play_style", "gender",
}

# If public.players gains a raw_data jsonb column, flip this to True and
# player_extra will be written into it automatically.
#   ALTER TABLE players ADD COLUMN raw_data jsonb;
_PLAYER_HAS_RAW_DATA = False


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
        row = {k: v for k, v in player_fields.items() if k in _PLAYER_COLUMNS and v is not None}
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


def resolve_player_id(
    source: str,
    alias: str,
    fallback_name: str | None = None,
    player_fields: dict | None = None,
) -> str:
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

    row    = _build_player_row(player_fields, fallback_name, alias)
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


def extract_source_id_from_url(url: str) -> str | None:
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
# Tournament resolution
# ---------------------------------------------------------------------------

# Maps the prefix found in tennisrecruiting.net tournament name strings
# to a canonical level label stored in tournaments.level.
#
# ITF junior grade prefixes (most → least prestigious):
#   JGS  = Grade A (Grand Slam juniors)
#   JM   = Junior Masters / World Finals
#   J500 = Grade 1 (500-point events)
#   J300 = Grade 2
#   J200 = Grade 3
#   J100 = Grade 4
#   J060 = Grade 5
# USTA domestic prefixes:
#   L1   = Level 1 (Nationals / Kalamazoo)
#   L2   = Level 2
#   L3   = Level 3
_TOURNAMENT_LEVEL_MAP: dict[str, str] = {
    "JGS":  "ITF_Grade_A",
    "JM":   "ITF_Junior_Masters",
    "J500": "ITF_Grade_1",
    "J300": "ITF_Grade_2",
    "J200": "ITF_Grade_3",
    "J100": "ITF_Grade_4",
    "J060": "ITF_Grade_5",
    "L1":   "USTA_Level_1",
    "L2":   "USTA_Level_2",
    "L3":   "USTA_Level_3",
}


def _infer_tournament_level(name: str | None) -> str | None:
    """
    Infer a level string from the tournament name prefix.

    The site prefixes tournament names with their grade/level code,
    e.g. "J500 FORT LAUDERDALE", "JGS WIMBLEDON JUNIORS", "L1 USTA B16,18 …"
    Returns None when no known prefix is matched.
    """
    if not name:
        return None
    prefix = name.strip().split()[0].upper()
    return _TOURNAMENT_LEVEL_MAP.get(prefix)


def _tournament_upsert_key(name: str, start_date: str | None) -> str:
    """
    Stable string key used to deduplicate tournaments within a single run
    before they are written to Supabase.

    Format: "<normalised_name>|<start_date>"  e.g. "J500 FORT LAUDERDALE|2025-12-08"
    start_date may be None for tournaments whose date couldn't be parsed.
    """
    return f"{(name or '').strip().upper()}|{start_date or ''}"


def resolve_tournament_ids_batch(tournaments: list[dict]) -> dict[str, str]:
    """
    Upsert a list of tournament dicts and return a mapping of
    upsert-key → tournaments.id (UUID).

    Each dict must contain at least:
        name        : str   (required — used in the upsert key)
        start_date  : str | None   (ISO date, used in the upsert key)

    Optional fields written on insert / updated on conflict:
        end_date, location, level, source

    Upsert conflict target: (name, start_date).
    Add a unique constraint in Postgres:
        ALTER TABLE tournaments ADD CONSTRAINT tournaments_name_start_date_key
            UNIQUE (name, start_date);

    Returns
    -------
    dict mapping upsert_key (str) -> tournament UUID (str)
    """
    if not tournaments:
        return {}

    # Deduplicate within the batch — keep first occurrence of each key
    seen: dict[str, dict] = {}
    for t in tournaments:
        key = _tournament_upsert_key(t.get("name"), t.get("start_date"))
        if key not in seen:
            seen[key] = t

    rows = [
        {
            "name":       t["name"],
            "start_date": t.get("start_date"),
            "end_date":   t.get("end_date"),
            "location":   t.get("location"),
            "level":      t.get("level") or _infer_tournament_level(t.get("name")),
            "source":     t.get("source", "tennisrecruiting.net"),
            # surface is not available from this source — left null
        }
        for t in seen.values()
    ]

    result = supabase.table("tournaments").upsert(
        rows,
        on_conflict="name,start_date",
    ).execute()

    # Build key → id map from the returned rows
    id_map: dict[str, str] = {}
    for row in result.data:
        key = _tournament_upsert_key(row["name"], row.get("start_date"))
        id_map[key] = row["id"]

    return id_map


# ---------------------------------------------------------------------------
# Profile ingestion
# ---------------------------------------------------------------------------

def ingest_player_profile(source_player_id: int) -> int:
    """
    Fetches and ingests a single player profile + activity page by
    tennisrecruiting.net ID.  Returns the number of records written (1).
    """
    base_url = "https://www.tennisrecruiting.net"

    # ------------------------------------------------------------------
    # 1. Fetch and parse both pages
    # ------------------------------------------------------------------
    profile_soup  = fetch_from_web(f"{base_url}/player.asp?id={source_player_id}")
    activity_soup = fetch_from_web(f"{base_url}/player/activity.asp?id={source_player_id}")

    data = parse_profile(profile_soup)
    data["match_results"] = parse_activity(activity_soup, source_player_id)

    player       = data["player"]
    player_extra = data["player_extra"]
    aliases      = data["aliases"]

    # ------------------------------------------------------------------
    # 2. Resolve or create the internal player ID
    # ------------------------------------------------------------------
    internal_id = resolve_player_id(
        source="tennisrecruiting.net",
        alias=player["_source_id"],
        fallback_name=player["full_name"],
        player_fields=player,
    )

    # ------------------------------------------------------------------
    # 3. Update public.players with all schema columns from the profile.
    #    If the table has a raw_data jsonb column, player_extra is written
    #    there too (controlled by the _PLAYER_HAS_RAW_DATA flag).
    # ------------------------------------------------------------------
    update_fields = {
        k: v for k, v in player.items()
        if k in _PLAYER_COLUMNS and v is not None
    }
    if _PLAYER_HAS_RAW_DATA:
        update_fields["raw_data"] = player_extra
    supabase.table("players").update(update_fields).eq("id", internal_id).execute()

    # ------------------------------------------------------------------
    # 4. Upsert all aliases (USTA, ITF, UTR, WTN, tennisrecruiting.net)
    # ------------------------------------------------------------------
    for alias in aliases:
        supabase.table("player_aliases").upsert(
            {**alias, "player_id": internal_id},
            on_conflict="source,alias_name",
        ).execute()

    # ------------------------------------------------------------------
    # 5. Rankings — upsert on (player_id, source, ranking_date)
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
        supabase.table("player_rankings").upsert(
            ranking_rows,
            on_conflict="player_id,source,ranking_date",
        ).execute()

    # ------------------------------------------------------------------
    # 6. Tournaments — upsert one row per unique (name, start_date) and
    #    build a key→UUID map for use in match rows below.
    # ------------------------------------------------------------------
    match_results = data["match_results"]

    unique_tournaments = list({
        _tournament_upsert_key(m.get("tournament_name"), m.get("tournament_start")): {
            "name":       m["tournament_name"],
            "start_date": m.get("tournament_start"),
            "end_date":   m.get("tournament_end"),
            "location":   m.get("tournament_location"),
            "source":     m["source"],
        }
        for m in match_results
        if m.get("tournament_name")
    }.values())

    tournament_id_map = resolve_tournament_ids_batch(unique_tournaments)

    # ------------------------------------------------------------------
    # 7. Match results — batch-resolve opponents, then upsert
    # ------------------------------------------------------------------

    # Collect unique opponent source IDs
    seen: set[str] = set()
    unique_opponent_lookups: list[dict] = []
    for m in match_results:
        opp_id = m["_opponent_source_id"]
        if opp_id is not None:
            key = str(opp_id)
            if key not in seen:
                seen.add(key)
                unique_opponent_lookups.append({
                    "alias":         opp_id,
                    "fallback_name": m["opponent_name"],
                })

    opponent_id_map = resolve_player_ids_batch(
        source="tennisrecruiting.net",
        aliases=unique_opponent_lookups,
    ) if unique_opponent_lookups else {}

    match_rows = []
    for m in match_results:
        opp_source_id = m["_opponent_source_id"]
        opponent_id   = opponent_id_map.get(str(opp_source_id)) if opp_source_id else None

        if m["outcome"] == "win":
            winner_id = internal_id
        elif opponent_id is not None:
            winner_id = opponent_id
        else:
            winner_id = None
            print(
                f"  [!] Could not resolve winner for loss on {m['played_at']} "
                f"(opponent source ID: {opp_source_id})"
            )

        t_key       = _tournament_upsert_key(m.get("tournament_name"), m.get("tournament_start"))
        tournament_id = tournament_id_map.get(t_key)

        match_rows.append({
            "player_id":     internal_id,
            "opponent_id":   opponent_id,
            "winner_id":     winner_id,
            "outcome":       m["outcome"],
            "score":         m["score"],
            "round":         m["round"],
            "best_of":       m["best_of"],
            "status":        m["status"],
            "played_at":     m["played_at"],
            "tournament_id": tournament_id,
            "source":        m["source"],
            "raw_data": {
                **(m.get("raw_data") or {}),
                "draw_type":   m.get("draw_type"),
                "results_url": m.get("results_url"),
            },
        })

    if match_rows:
        supabase.table("match_results").upsert(
            match_rows,
            on_conflict="player_id,opponent_id,played_at,score",
        ).execute()

    return 1


# ---------------------------------------------------------------------------
# Homepage top-10 rankings ingestion
# ---------------------------------------------------------------------------

def ingest_homepage_rankings() -> int:
    """
    Scrapes the homepage top-10 CRL/RPI rankings for every class year
    and writes them to player_rankings.  Returns the number of rows inserted.
    """
    soup    = fetch_from_web("https://www.tennisrecruiting.net/")
    results = parse_rankings(soup)

    today = datetime.now(timezone.utc).date().isoformat()

    entries = []
    for rank_type, years in results.items():
        for year, data in years.items():
            for gender in ("boys", "girls"):
                for rank, name, url in data.get(gender, []):
                    source_id = extract_source_id_from_url(url)
                    if not source_id:
                        print(f"  [!] No source ID in URL for {name} ({url}) — skipping")
                        continue
                    entries.append((rank_type, year, gender, rank, name, source_id))

    if not entries:
        return 0

    unique_aliases = list({
        e[5]: {"alias": e[5], "fallback_name": e[4]}
        for e in entries
    }.values())

    player_id_map = resolve_player_ids_batch(
        source="tennisrecruiting.net",
        aliases=unique_aliases,
    )

    rows = []
    for rank_type, year, gender, rank, name, source_id in entries:
        player_id = player_id_map.get(str(source_id))
        if not player_id:
            print(f"  [!] Could not resolve player ID for {name} ({source_id}) — skipping")
            continue

        source = f"tennisrecruiting_{rank_type.lower()}_{year}_{gender}"
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
                "url":        f"https://www.tennisrecruiting.net/player.asp?id={source_id}",
            },
        })

    if rows:
        supabase.table("player_rankings").upsert(
            rows,
            on_conflict="player_id,source,ranking_date",
        ).execute()

    return len(rows)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    job    = create_job("tennis_recruiting_ingest")
    total  = 0
    failed = []

    player_ids = [928355]

    for source_player_id in player_ids:
        try:
            total += ingest_player_profile(source_player_id)
        except Exception as e:
            print(f"  [!] Failed to ingest player {source_player_id}: {e}")
            failed.append(source_player_id)

    try:
        total += ingest_homepage_rankings()
    except Exception as e:
        print(f"  [!] Failed to ingest homepage rankings: {e}")

    if failed:
        status = "partial" if total > 0 else "failed"
        error  = f"Failed player IDs: {failed}"
    else:
        status = "success"
        error  = None

    finish_job(job["id"], status, total, error)
    print(f"Done — {total} records ingested. Failed: {failed or 'none'}")


if __name__ == "__main__":
    main()