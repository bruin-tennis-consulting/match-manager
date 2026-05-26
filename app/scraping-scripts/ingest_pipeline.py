"""
ingest_pipeline.py
==================
Single entrypoint for the full pipeline across all sources:

    1. SCRAPE  — fetch from each source → raw.*
    2. RESOLVE — match raw entities    → resolution.*  (+ canonical stubs)
    3. PROMOTE — build canonical.*     from raw + resolution

Usage
-----
    # Full run (all sources, all phases):
    python ingest_pipeline.py

    # Specific sources:
    python ingest_pipeline.py --sources tennisrecruiting usta utr

    # Specific phases:
    python ingest_pipeline.py --scrape-only
    python ingest_pipeline.py --resolve-only
    python ingest_pipeline.py --promote-only

    # Combine — e.g. scrape + resolve but not promote:
    python ingest_pipeline.py --scrape-only --resolve-only
"""

import argparse
import time

from db.client import create_job, finish_job
from resolution import resolve_all, _load_existing_player_mappings, _load_existing_tournament_mappings
from canonical import promote_all

# ---------------------------------------------------------------------------
# Source registry
# Each entry: (short_name, scrape_fn, source_string_in_db)
# Add new sources here as you build them.
# ---------------------------------------------------------------------------

def _get_sources(requested: list[str]) -> list[tuple]:
    """
    Lazily import scraper functions so missing dependencies don't crash
    sources you're not running.
    """
    registry = {}

    if "tennisrecruiting" in requested or "all" in requested:
        from scrapers.tennisrecruiting_ingest import (
            ingest_player_profile,
            ingest_homepage_rankings,
        )
        registry["tennisrecruiting"] = {
            "label":  "TennisRecruiting",
            "db_key": "tennisrecruiting.net",
            "run":    _run_tennisrecruiting,
        }

    if "usta" in requested or "all" in requested:
        from scrapers.usta_ingest import ingest_usta_rankings
        registry["usta"] = {
            "label":  "USTA",
            "db_key": "USTA",
            "run":    _run_usta,
        }

    if "utr" in requested or "all" in requested:
        from scrapers.utr_ingest import ingest_utr_rankings
        registry["utr"] = {
            "label":  "UTR",
            "db_key": "UTR",
            "run":    _run_utr,
        }

    return registry


# ---------------------------------------------------------------------------
# Per-source scrape runners
# ---------------------------------------------------------------------------

# Seed list for TennisRecruiting profile scrapes
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

_FETCH_DELAY = 2.0


def _run_tennisrecruiting() -> int:
    from scrapers.tennisrecruiting_ingest import ingest_player_profile, ingest_homepage_rankings

    total  = 0
    failed = []
    ids    = [pid for pid, _ in _TR_SEED_PLAYERS]

    print(f"  Scraping {len(ids)} TennisRecruiting profiles ...")
    for i, source_id in enumerate(ids):
        try:
            ingest_player_profile(source_id)
            total += 1
        except Exception as e:
            print(f"    [!] Player {source_id} failed: {e}")
            failed.append(source_id)
        if i < len(ids) - 1:
            time.sleep(_FETCH_DELAY)

    print("  Scraping homepage top-10 rankings ...")
    try:
        n = ingest_homepage_rankings()
        print(f"    {n} ranking rows -> raw.rankings")
        total += 1
    except Exception as e:
        print(f"    [!] Homepage rankings failed: {e}")

    # Report opponents seen in matches but not yet profiled
    stubs = _collect_tr_stub_opponents()
    if stubs:
        print(f"\n  {len(stubs)} opponent stub(s) found — add to _TR_SEED_PLAYERS to backfill:")
        for sid in stubs[:20]:
            print(f"    {sid}")
        if len(stubs) > 20:
            print(f"    ... and {len(stubs) - 20} more")

    if failed:
        print(f"  Failed TennisRecruiting IDs: {failed}")
    return total


def _run_usta() -> int:
    from scrapers.usta_ingest import ingest_usta_rankings
    print("  Scraping USTA national junior standings ...")
    return ingest_usta_rankings()


def _run_utr() -> int:
    from scrapers.utr_ingest import ingest_utr_rankings
    print("  Scraping UTR junior rankings ...")
    return ingest_utr_rankings()


def _collect_tr_stub_opponents() -> list[int]:
    """Opponents seen in raw.matches but not yet in raw.players."""
    from db.client import supabase

    matches = (
        supabase.schema("raw").table("matches")
        .select("raw_json")
        .eq("source", "tennisrecruiting.net")
        .execute()
    )
    if not matches.data:
        return []

    all_opp_ids: set[str] = set()
    for row in matches.data:
        opp_id = str(row["raw_json"].get("opponent_source_id", ""))
        if opp_id and opp_id != "unknown":
            all_opp_ids.add(opp_id)

    if not all_opp_ids:
        return []

    existing = (
        supabase.schema("raw").table("players")
        .select("source_id")
        .eq("source", "tennisrecruiting.net")
        .in_("source_id", list(all_opp_ids))
        .execute()
    )
    existing_ids = {r["source_id"] for r in (existing.data or [])}
    return sorted(int(s) for s in all_opp_ids - existing_ids if s.isdigit())


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Tennis data ingest pipeline")
    parser.add_argument(
        "--sources", nargs="+",
        choices=["tennisrecruiting", "usta", "utr", "all"],
        default=["all"],
        help="Which sources to run (default: all)",
    )
    parser.add_argument("--scrape-only",  action="store_true")
    parser.add_argument("--resolve-only", action="store_true")
    parser.add_argument("--promote-only", action="store_true")
    args = parser.parse_args()

    run_all    = not any([args.scrape_only, args.resolve_only, args.promote_only])
    do_scrape  = run_all or args.scrape_only
    do_resolve = run_all or args.resolve_only
    do_promote = run_all or args.promote_only

    requested  = args.sources
    source_reg = _get_sources(requested)
    db_keys    = [s["db_key"] for s in source_reg.values()]

    job = create_job(
        "tennis_pipeline",
        metadata={
            "sources": list(source_reg.keys()),
            "phases":  [p for p, on in [("scrape", do_scrape), ("resolve", do_resolve), ("promote", do_promote)] if on],
        },
    )

    total_records = 0
    all_failed    = []

    # ------------------------------------------------------------------
    # Phase 1 — Scrape
    # ------------------------------------------------------------------
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

    # ------------------------------------------------------------------
    # Phase 2 — Resolution
    # ------------------------------------------------------------------
    player_map     = {}
    tournament_map = {}

    if do_resolve:
        print(f"\n{'='*60}")
        print(f"  PHASE 2 — RESOLVE  ({', '.join(db_keys)})")
        print(f"{'='*60}")
        try:
            player_map, tournament_map = resolve_all(sources=db_keys)
        except Exception as e:
            print(f"  [!] Resolution failed: {e}")
            finish_job(job["id"], "failed", total_records, str(e))
            raise

    # ------------------------------------------------------------------
    # Phase 3 — Canonical promotion
    # ------------------------------------------------------------------
    if do_promote:
        print(f"\n{'='*60}")
        print(f"  PHASE 3 — PROMOTE TO CANONICAL")
        print(f"{'='*60}")

        if not do_resolve:
            # Load maps from DB when resolution was skipped in this run
            player_map     = _load_existing_player_mappings(db_keys)
            tournament_map = _load_existing_tournament_mappings(db_keys)
            print(
                f"  Loaded {len(player_map)} player mappings "
                f"and {len(tournament_map)} tournament mappings from DB"
            )

        try:
            counts = promote_all(player_map, tournament_map)
            total_records += counts["rankings"] + counts["matches"]
        except Exception as e:
            print(f"  [!] Canonical promotion failed: {e}")
            finish_job(job["id"], "failed", total_records, str(e))
            raise

    # ------------------------------------------------------------------
    # Finish
    # ------------------------------------------------------------------
    status = ("partial" if total_records > 0 else "failed") if all_failed else "success"
    error  = f"Failed sources: {all_failed}" if all_failed else None
    finish_job(job["id"], status, total_records, error)

    print(f"\n{'='*60}")
    print(f"  Done — {total_records} records. Failed: {all_failed or 'none'}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()