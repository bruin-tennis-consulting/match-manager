"""
ingest_pipeline.py
==================
Single entrypoint for the full pipeline across all sources.

Usage
-----
    python ingest_pipeline.py
    python ingest_pipeline.py --sources tennisrecruiting usta utr
    python ingest_pipeline.py --sources youtube
    python ingest_pipeline.py --scrape-only
    python ingest_pipeline.py --resolve-only
    python ingest_pipeline.py --promote-only

    Tennis Recruiting Backfill (100)
    python ingest_pipeline.py --backfill-stubs
"""

import argparse
import re

from db.client import create_job, fetch_all, finish_job
from resolution import resolve_all
from canonical import promote_all

# ---------------------------------------------------------------------------
# Source registry
# ---------------------------------------------------------------------------

def _get_sources(requested: list[str], backfill_stubs: bool = False) -> dict:
    registry = {}

    if "tennisrecruiting" in requested or "all" in requested:
        registry["tennisrecruiting"] = {
            "label":       "TennisRecruiting",
            "db_key":      "tennisrecruiting.net",
            "run":         lambda: _run_tennisrecruiting(backfill_stubs=backfill_stubs),
            "scrape_only": False,
        }

    if "usta" in requested or "all" in requested:
        registry["usta"] = {
            "label":       "USTA",
            "db_key":      "USTA",
            "run":         _run_usta,
            "scrape_only": False,
        }

    if "utr" in requested or "all" in requested:
        registry["utr"] = {
            "label":       "UTR",
            "db_key":      "UTR",
            "run":         _run_utr,
            "scrape_only": False,
        }

    if "youtube" in requested or "all" in requested:
        registry["youtube"] = {
            "label":       "YouTube",
            "db_key":      None,   # writes directly to canonical — no raw/resolution tables
            "run":         _run_youtube,
            "scrape_only": True,   # skip resolve + promote phases for this source
        }

    return registry


# ---------------------------------------------------------------------------
# Manual seed list (kept as a curated baseline)
# ---------------------------------------------------------------------------

_TR_SEED_PLAYERS: list[tuple[int, str]] = [
    (928355,  "Jack Kennedy          — #1 CRL, committed Virginia"),
    (946607,  "Tanishk Konduri       — #2 CRL, 2026"),
    (870512,  "Ronit Karki           — top-10 CRL"),
    (875494,  "Darwin Blanch         — beat Kennedy at Kalamazoo SF"),
    (901346,  "Jack Satterfield"),
    (893061,  "Matisse Farzam        — Kalamazoo QF vs Kennedy"),
    (905437,  "Keaton Hance          — Kalamazoo PL-F vs Kennedy"),
    (923164,  "Rishvanth Krishna     — 2027, high-value opponent"),
    (943818,  "Winston Lee           — 2025, 5-star"),
    (917817,  "Bode Campbell         — 2025, 4-star"),
    (1019268, "Thijs Boogaard        — Orange Bowl final"),
    (859960,  "Benjamin Willwerth    — ITF World Finals"),
    (972314,  "Oliver Bonding        — Wimbledon R64 vs Kennedy"),
]


# ---------------------------------------------------------------------------
# Per-source scrape runners
# ---------------------------------------------------------------------------

def _run_tennisrecruiting(backfill_stubs: bool = False) -> int:
    from scrapers.tennisrecruiting_ingest import (
        ingest_player_profiles,
        ingest_homepage_rankings,
    )
    from tennis_recruiting_top10 import fetch_from_web, parse_rankings

    # --- Build seed list from homepage top-10 ---
    print("  Fetching homepage top-10 as seed list ...")
    soup = fetch_from_web("https://www.tennisrecruiting.net/")
    rankings = parse_rankings(soup)

    homepage_ids: set[int] = set()
    for rank_type, years in rankings.items():
        for year, data in years.items():
            for gender in ("boys", "girls"):
                for rank, name, url in data.get(gender, []):
                    m = re.search(r"[?&]id=(\d+)", url)
                    if m:
                        homepage_ids.add(int(m.group(1)))

    manual_ids = [pid for pid, _ in _TR_SEED_PLAYERS]
    ids = list(dict.fromkeys(manual_ids + list(homepage_ids)))
    print(f" = {len(ids)} unique profiles")

    # --- Append backfill stub opponents (capped at 100) ---
    if backfill_stubs:
        stub_ids = _collect_tr_stub_opponents()
        if stub_ids:
            new_stubs = [sid for sid in stub_ids if sid not in ids][:100]
            print(f"  Adding {len(new_stubs)} stub opponents (capped at 100) ...")
            ids = ids + new_stubs

    # --- Batch ingest with staleness filtering + concurrency ---
    success, failed = ingest_player_profiles(ids)

    # --- Homepage rankings (pass pre-fetched soup to avoid redundant request) ---
    print("  Writing homepage top-10 rankings ...")
    try:
        n = ingest_homepage_rankings(soup=soup)
        print(f"    {n} ranking rows -> raw.rankings")
    except Exception as e:
        print(f"    [!] Homepage rankings failed: {e}")

    # --- Report remaining stubs ---
    if backfill_stubs:
        remaining = _collect_tr_stub_opponents()
        if remaining:
            print(f"\n  {len(remaining)} opponent stub(s) still unscraped.")

    if failed:
        print(f"  Failed IDs: {failed}")

    return success


def _run_usta() -> int:
    from scrapers.usta_ingest import ingest_usta_rankings
    print("  Scraping USTA national junior standings ...")
    return ingest_usta_rankings()


def _run_utr() -> int:
    from scrapers.utr_ingest import ingest_utr_rankings
    print("  Scraping UTR junior rankings ...")
    return ingest_utr_rankings()


def _run_youtube() -> int:
    from scrapers.youtube_ingest import ingest_youtube_videos
    print("  Searching YouTube for top 100 USTA players ...")
    return ingest_youtube_videos()


def _collect_tr_stub_opponents() -> list[int]:
    """Opponents seen in raw.matches but not yet in raw.players."""
    match_rows = fetch_all(
        "raw", "matches",
        "raw_json",
        ("source", ["tennisrecruiting.net"]),
    )

    all_opp_ids: set[str] = set()
    for row in match_rows:
        opp_id = str(row["raw_json"].get("opponent_source_id", ""))
        if opp_id and opp_id != "unknown":
            all_opp_ids.add(opp_id)

    if not all_opp_ids:
        return []

    existing_rows = fetch_all(
        "raw", "players",
        "source_id",
        ("source_id", list(all_opp_ids)),
    )
    existing_ids = {r["source_id"] for r in existing_rows}
    return sorted(int(s) for s in all_opp_ids - existing_ids if s.isdigit())


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Tennis data ingest pipeline")
    parser.add_argument(
        "--sources", nargs="+",
        choices=["tennisrecruiting", "usta", "utr", "youtube", "all"],
        default=["all"],
    )
    parser.add_argument("--scrape-only",  action="store_true")
    parser.add_argument("--resolve-only", action="store_true")
    parser.add_argument("--promote-only", action="store_true")
    parser.add_argument("--backfill-stubs", action="store_true",
                    help="Scrape up to 100 unseen stub opponents from raw.matches (tennisrecruiting only)")
    args = parser.parse_args()

    run_all    = not any([args.scrape_only, args.resolve_only, args.promote_only])
    do_scrape  = run_all or args.scrape_only
    do_resolve = run_all or args.resolve_only
    do_promote = run_all or args.promote_only

    requested  = args.sources
    source_reg = _get_sources(requested, backfill_stubs=args.backfill_stubs)

    # Sources that participate in resolution/promotion (youtube writes directly to canonical)
    pipeline_sources = [
        s["db_key"]
        for s in source_reg.values()
        if s["db_key"] is not None
    ]

    job = create_job(
        "tennis_pipeline",
        metadata={
            "sources": list(source_reg.keys()),
            "phases":  [p for p, on in [("scrape", do_scrape), ("resolve", do_resolve), ("promote", do_promote)] if on],
        },
    )

    total_records = 0
    all_failed    = []

    # Phase 1 — Scrape
    if do_scrape:
        print(f"\n{'='*60}")
        print(f"  PHASE 1 — SCRAPE  ({', '.join(source_reg.keys())})")
        print(f"{'='*60}")
        for key, spec in source_reg.items():
            print(f"\n  [{spec['label']}]")
            try:
                n = spec["run"]()
                total_records += n
            except Exception as e:
                print(f"  [!] {spec['label']} scrape failed: {e}")
                all_failed.append(key)

    # Phase 2 — Resolution (skipped for scrape-only sources like youtube)
    player_map     = {}
    tournament_map = {}
    match_map      = {}

    if do_resolve and pipeline_sources:
        print(f"\n{'='*60}")
        print(f"  PHASE 2 — RESOLVE  ({', '.join(pipeline_sources)})")
        print(f"{'='*60}")
        try:
            player_map, tournament_map, match_map = resolve_all(sources=pipeline_sources)
        except Exception as e:
            print(f"  [!] Resolution failed: {e}")
            finish_job(job["id"], "failed", total_records, str(e))
            raise

    # Phase 3 — Canonical promotion (skipped for scrape-only sources like youtube)
    if do_promote and pipeline_sources:
        print(f"\n{'='*60}")
        print(f"  PHASE 3 — PROMOTE TO CANONICAL")
        print(f"{'='*60}")

        if not do_resolve:
            from resolution import (
                _load_existing_player_mappings,
                _load_existing_tournament_mappings,
                _load_existing_match_mappings,
            )
            player_map     = _load_existing_player_mappings(pipeline_sources)
            tournament_map = _load_existing_tournament_mappings(pipeline_sources)
            match_map      = _load_existing_match_mappings(pipeline_sources)
            print(
                f"  Loaded {len(player_map)} player, "
                f"{len(tournament_map)} tournament, "
                f"{len(match_map)} match mappings from DB"
            )

        try:
            counts = promote_all(player_map, tournament_map, match_map)
            total_records += counts.get("players", 0) + counts["rankings"] + counts["matches"]
        except Exception as e:
            print(f"  [!] Canonical promotion failed: {e}")
            finish_job(job["id"], "failed", total_records, str(e))
            raise

    status = ("partial" if total_records > 0 else "failed") if all_failed else "success"
    error  = f"Failed sources: {all_failed}" if all_failed else None
    finish_job(job["id"], status, total_records, error)

    print(f"\n{'='*60}")
    print(f"  Done — {total_records} records. Failed: {all_failed or 'none'}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()