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

import time
import re
from datetime import datetime, timezone

from tennis_recruiting_profile import parse_profile, parse_activity
from tennis_recruiting_top10 import fetch_from_web, parse_rankings
from db.client import (
    supabase,
    PLAYER_COLUMNS,
    resolve_player_id,
    resolve_player_ids_batch,
    create_job,
    finish_job,
)

# ---------------------------------------------------------------------------
# Pipeline-local config
# ---------------------------------------------------------------------------

# If public.players gains a raw_data jsonb column, flip this to True and
# player_extra will be written into it automatically.
#   ALTER TABLE players ADD COLUMN raw_data jsonb;
_PLAYER_HAS_RAW_DATA = False

# Politeness delay between profile fetches (seconds).
# The site has no published rate limit; 2s is conservative but safe.
_FETCH_DELAY_SECONDS = 2.0


def extract_source_id_from_url(url: str) -> str | None:
    m = re.search(r"[?&]id=(\d+)", url)
    return m.group(1) if m else None


# ---------------------------------------------------------------------------
# Tournament resolution
# ---------------------------------------------------------------------------

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
    if not name:
        return None
    prefix = name.strip().split()[0].upper()
    return _TOURNAMENT_LEVEL_MAP.get(prefix)


def _tournament_upsert_key(name: str, start_date: str | None) -> str:
    return f"{(name or '').strip().upper()}|{start_date or ''}"


def resolve_tournament_ids_batch(tournaments: list[dict]) -> dict[str, str]:
    if not tournaments:
        return {}

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
        }
        for t in seen.values()
    ]

    result = supabase.table("tournaments").upsert(
        rows,
        on_conflict="name,start_date",
    ).execute()

    id_map: dict[str, str] = {}
    for row in result.data:
        key = _tournament_upsert_key(row["name"], row.get("start_date"))
        id_map[key] = row["id"]

    return id_map


# ---------------------------------------------------------------------------
# Seed player list
# ---------------------------------------------------------------------------

# Top-10 boys CRL (class of 2026) as of May 2026, plus high-value opponents
# observed in Kennedy's activity page. Comments show why each is included.
#
# Strategy: seeding from highly-ranked players maximises the number of
# meaningful match edges ingested early, because top players play each other
# frequently at Grade A / Level 1 events.
#
# To expand the graph further, run collect_opponent_ids() after each batch
# to discover new IDs from match_results rows where opponent profiles are
# still stubs (full_name only, no grad_year/region/etc.).

SEED_PLAYER_IDS: list[tuple[int, str]] = [
    # --- Top-10 boys CRL 2026 ---
    (928355,  "Jack Kennedy          — #1 CRL, committed Virginia"),
    (946607,  "Tanishk Konduri       — #2 CRL, 2026"),
    (870512,  "Ronit Karki           — top-10 CRL, Wimbledon R16 vs Kennedy"),
    (875494,  "Darwin Blanch         — beat Kennedy at Kalamazoo SF"),
    (901346,  "Jack Satterfield      — appears twice in Kennedy activity"),
    (893061,  "Matisse Farzam        — Kalamazoo QF vs Kennedy"),
    (905437,  "Keaton Hance          — Kalamazoo PL-F vs Kennedy"),
    (923164,  "Rishvanth Krishna     — 2027, high-value opponent"),
    (943818,  "Winston Lee           — 2025, 5-star"),
    (917817,  "Bode Campbell         — 2025, 4-star"),
    # --- High-value opponents from Kennedy's activity ---
    (1019268, "Thijs Boogaard        — beat Kennedy in Orange Bowl final"),
    (859960,  "Benjamin Willwerth    — ITF World Finals, Blue Chip"),
    (972314,  "Oliver Bonding        — 2025, Wimbledon R64 vs Kennedy"),
]


def collect_opponent_ids() -> list[int]:
    """
    Query match_results for opponent_ids whose player row is still a stub
    (no grad_year set, which is the most reliable indicator that a full
    profile has never been ingested).

    Use this to discover the next wave of player IDs to ingest.
    """
    res = (
        supabase.table("match_results")
        .select("opponent_id")
        .execute()
    )
    if not res.data:
        return []

    opponent_ids = list({r["opponent_id"] for r in res.data if r.get("opponent_id")})
    if not opponent_ids:
        return []

    # Find which of those have no grad_year yet (stub rows)
    stubs = (
        supabase.table("players")
        .select("id")
        .in_("id", opponent_ids)
        .is_("grad_year", "null")
        .execute()
    )
    stub_uuids = {r["id"] for r in stubs.data}

    # Resolve back to source IDs via player_aliases
    if not stub_uuids:
        return []

    aliases = (
        supabase.table("player_aliases")
        .select("alias_name")
        .eq("source", "tennisrecruiting.net")
        .in_("player_id", list(stub_uuids))
        .execute()
    )
    return [int(r["alias_name"]) for r in aliases.data if r["alias_name"].isdigit()]


# ---------------------------------------------------------------------------
# Profile ingestion
# ---------------------------------------------------------------------------

def ingest_player_profile(source_player_id: int) -> int:
    """
    Fetches and ingests a single player profile + activity page.
    Returns 1 on success.
    """
    base_url = "https://www.tennisrecruiting.net"

    profile_soup  = fetch_from_web(f"{base_url}/player.asp?id={source_player_id}")
    time.sleep(_FETCH_DELAY_SECONDS)
    activity_soup = fetch_from_web(f"{base_url}/player/activity.asp?id={source_player_id}")

    data = parse_profile(profile_soup)
    data["match_results"] = parse_activity(activity_soup, source_player_id)

    player       = data["player"]
    player_extra = data["player_extra"]
    aliases      = data["aliases"]

    internal_id = resolve_player_id(
        source="tennisrecruiting.net",
        alias=player["_source_id"],
        fallback_name=player["full_name"],
        player_fields=player,
    )

    update_fields = {
        k: v for k, v in player.items()
        if k in PLAYER_COLUMNS and v is not None
    }
    if _PLAYER_HAS_RAW_DATA:
        update_fields["raw_data"] = player_extra
    supabase.table("players").update(update_fields).eq("id", internal_id).execute()

    for alias in aliases:
        supabase.table("player_aliases").upsert(
            {**alias, "player_id": internal_id},
            on_conflict="source,alias_name",
        ).execute()

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

        t_key         = _tournament_upsert_key(m.get("tournament_name"), m.get("tournament_start"))
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

    print(
        f"  [{source_player_id}] {player.get('full_name', '?'):30s} "
        f"| {len(match_rows):2d} matches  "
        f"| {len(ranking_rows):2d} rankings  "
        f"| {len(unique_opponent_lookups):2d} opponents resolved"
    )

    return 1


# ---------------------------------------------------------------------------
# Homepage top-10 rankings ingestion
# ---------------------------------------------------------------------------

def ingest_homepage_rankings() -> int:
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
    player_ids = [pid for pid, _ in SEED_PLAYER_IDS]

    job = create_job(
        "tennis_recruiting_ingest",
        metadata={"player_ids": player_ids, "count": len(player_ids)},
    )
    total  = 0
    failed = []

    print(f"Ingesting {len(player_ids)} seed players ...")
    for i, source_player_id in enumerate(player_ids):
        try:
            total += ingest_player_profile(source_player_id)
        except Exception as e:
            print(f"  [!] Failed to ingest player {source_player_id}: {e}")
            failed.append(source_player_id)

        # Delay between players (not just between the two pages for one player)
        if i < len(player_ids) - 1:
            time.sleep(_FETCH_DELAY_SECONDS)

    print("\nIngesting homepage rankings ...")
    try:
        total += ingest_homepage_rankings()
    except Exception as e:
        print(f"  [!] Failed to ingest homepage rankings: {e}")

    # Report stub opponents that could be ingested next
    stub_ids = collect_opponent_ids()
    if stub_ids:
        print(f"\n{len(stub_ids)} opponent stub(s) discovered — add to SEED_PLAYER_IDS to backfill:")
        for sid in stub_ids[:20]:   # show first 20
            print(f"    {sid}")
        if len(stub_ids) > 20:
            print(f"    ... and {len(stub_ids) - 20} more")

    status = ("partial" if total > 0 else "failed") if failed else "success"
    error  = f"Failed player IDs: {failed}" if failed else None
    finish_job(job["id"], status, total, error)

    print(f"\nDone — {total} players ingested. Failed: {failed or 'none'}")


if __name__ == "__main__":
    main()