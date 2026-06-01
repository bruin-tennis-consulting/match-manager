"""
canonical.py
============
Reads from raw schema and enriches canonical schema records.

canonical.players, canonical.tournaments, and canonical.matches stubs are
created by resolution.py as a side effect of entity matching. This module:

  promote_rankings — reads raw.rankings, resolves to canonical player UUIDs
                     via player_map, upserts into canonical.player_rankings.

  promote_matches  — reads raw.matches, resolves to canonical match UUIDs
                     via match_map, then fills any null fields on the stub
                     that the first source left empty (sets, round, best_of).
                     Never overwrites fields that are already populated.

Flow:
    raw.rankings  + player_map -> canonical.player_rankings  (upsert)
    raw.matches   + match_map  -> canonical.matches          (enrich nulls only)

Public API
----------
    promote_rankings(player_map)                        -> int
    promote_matches(match_map)                          -> int
    promote_all(player_map, tournament_map, match_map)  -> dict
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

from db.client import fetch_all, supabase

_RATING_SOURCES = {"UTR", "WTN"}

_raw       = lambda t: supabase.schema("raw").table(t)
_canonical = lambda t: supabase.schema("canonical").table(t)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_sets(score: str | None) -> list[dict] | None:
    """Parse "6-4;3-6;7-5(4)" -> [{"p":6,"o":4}, {"p":3,"o":6}, {"p":7,"o":5,"tb":4}]."""
    if not score:
        return None
    sets = []
    for s in re.sub(r"[;,\s]+", " ", score.strip()).split():
        tb_m = re.search(r"\((\d+)\)", s)
        tb   = int(tb_m.group(1)) if tb_m else None
        s    = re.sub(r"\(\d+\)", "", s)
        parts = s.split("-")
        if len(parts) != 2:
            return None
        try:
            entry: dict = {"p": int(parts[0]), "o": int(parts[1])}
        except ValueError:
            return None
        if tb is not None:
            entry["tb"] = tb
        sets.append(entry)
    return sets or None


# ---------------------------------------------------------------------------
# Players
# ---------------------------------------------------------------------------

def promote_players(player_map: dict[tuple[str, str], str]) -> int:
    """
    Enrich canonical.players stubs that were created by resolve_players or match opponents.
    Fills in any fields that are currently null — never overwrites populated fields.
    """
    if not player_map:
        print("  [canonical] Players: no player_map — skipping")
        return 0

    raw_rows = fetch_all("raw", "players")

    canonical_ids_needed = {
        player_map[(r["source"], r["source_id"])]
        for r in raw_rows
        if (r["source"], r["source_id"]) in player_map
    }

    if not canonical_ids_needed:
        print("  [canonical] Players: no mapped rows to enrich")
        return 0

    # fetch_all handles both pagination and .in_() chunking
    existing_rows = fetch_all("canonical", "players", "*", ("id", list(canonical_ids_needed)))
    current_by_id = {r["id"]: r for r in existing_rows}

    ENRICHABLE_EXTRA = {
        "city", "state", "high_school", "high_school_state",
        "committed_to", "nli_signed", "stars", "image_url",
        "academy", "international", "video_urls",
    }

    enriched = 0
    skipped  = 0

    for r in raw_rows:
        canonical_id = player_map.get((r["source"], str(r["source_id"])))
        if not canonical_id:
            skipped += 1
            continue

        current = current_by_id.get(canonical_id)
        if not current:
            skipped += 1
            continue

        rj    = r.get("raw_json", {})
        p     = rj.get("player", {})
        extra = rj.get("player_extra", {})
        src   = r["source"]
        updates = {}

        # Core player fields — source-agnostic, fill nulls only
        for field in ["date_of_birth", "grad_year", "gender", "region",
                      "country_code", "height", "dominant_hand", "play_style"]:
            if current.get(field) is None and p.get(field) is not None:
                updates[field] = p[field]

        # Enriched fields — source-specific
        if src == "tennisrecruiting.net":
            candidates = {
                "city":          extra.get("city"),
                "state":         extra.get("state_code"),
                "high_school":   extra.get("highschool"),
                "committed_to":  extra.get("committed_to"),
                "nli_signed":    next(
                    (s.get("nli_signed") for s in (extra.get("school_interests") or [])
                     if s.get("nli_signed")),
                    None,
                ),
                "stars":         extra.get("stars"),
                "image_url": (
                    "https://www.tennisrecruiting.net" + extra["photo_path"]
                    if extra.get("photo_path") and extra.get("photo_path") != "/img/nophoto.gif"
                    else None
                ),
                "academy":       extra.get("academy"),
                "international": extra.get("international"),
                "video_urls":    extra.get("video_urls") or None,
            }
        elif src == "UTR":
            candidates = {
                "high_school":       extra.get("high_school"),
                "high_school_state": extra.get("high_school_state"),
            }
        elif src == "USTA":
            candidates = {
                "city":  extra.get("city"),
                "state": extra.get("state"),
            }
        else:
            candidates = {}

        for k, v in candidates.items():
            if k not in ENRICHABLE_EXTRA or v is None:
                continue
            if k == "video_urls":
                existing_urls = set(current.get("video_urls") or [])
                new_urls = [u for u in v if u not in existing_urls]
                if new_urls:
                    updates[k] = list(existing_urls) + new_urls
            elif not current.get(k):
                updates[k] = v

        if updates:
            updates["updated_at"] = _now()
            _canonical("players").update(updates).eq("id", canonical_id).execute()
            current_by_id[canonical_id].update(updates)
            enriched += 1

    print(f"  [canonical] Players: {enriched} enriched, {skipped} skipped")
    return enriched


# ---------------------------------------------------------------------------
# Rankings
# ---------------------------------------------------------------------------

def promote_rankings(player_map: dict[tuple[str, str], str]) -> int:
    # fetch_all paginates past the 1000-row cap
    raw_rows = fetch_all("raw", "rankings")

    rows    = []
    skipped = 0

    for r in raw_rows:
        canonical_id = player_map.get((r["source"], str(r["source_player_id"])))
        if not canonical_id:
            skipped += 1
            continue

        rank_value   = r.get("rank_value")
        ranking_type = r["ranking_type"]
        source       = r["source"]
        is_rating    = any(s in ranking_type for s in _RATING_SOURCES)
        rj           = r.get("raw_json") or {}

        # raw.rankings stores the scraped raw_json directly — but our three
        # scrapers each nest their extra fields under "player_extra"
        extra = rj.get("player_extra") or rj  # fall back to root if flat

        if source == "UTR":
            source_fields = {
                "rank_value":         rank_value,
                "three_month_rating": extra.get("three_month_rating"),
                "trend_direction":    extra.get("trend_direction"),
                "high_school":        extra.get("high_school"),
                "high_school_state":  extra.get("high_school_state"),
                "scraped_tag":        extra.get("scraped_tag"),
            }
        elif source == "USTA":
            source_fields = {
                "points":         extra.get("usta_points"),
                "singles_points": extra.get("singles_points"),
                "doubles_points": extra.get("doubles_points"),
                "bonus_points":   extra.get("bonus_points"),
                "age_division":   extra.get("age_division"),
                "section":        extra.get("section"),
                "district":       extra.get("district"),
                "state":          extra.get("state"),
                "city":           extra.get("city"),
            }
        elif source == "tennisrecruiting.net":
            source_fields = {
                "city":         extra.get("city"),
                "state":        extra.get("state_code"),
                "high_school":  extra.get("highschool"),
                "committed_to": extra.get("committed_to"),
                "stars":        extra.get("stars"),
            }
        else:
            source_fields = {}

        rows.append({
            "player_id":    canonical_id,
            "ranking_type": ranking_type,
            "ranking":      None if is_rating else (int(rank_value) if rank_value is not None else None),
            "rank_value":   rank_value,
            "ranking_date": r["ranking_date"],
            "source":       source,
            "ingested_at":  _now(),
            **source_fields,
        })

    if rows:
        deduped = list({
            (r["player_id"], r["ranking_type"], r["ranking_date"]): r
            for r in rows
        }.values())

        # Batch upsert in chunks to stay under PostgREST's request size limits
        _BATCH_SIZE = 500
        for i in range(0, len(deduped), _BATCH_SIZE):
            _canonical("player_rankings").upsert(
                deduped[i : i + _BATCH_SIZE],
                on_conflict="player_id,ranking_type,ranking_date",
            ).execute()

    print(f"  [canonical] Rankings: {len(rows)} upserted, {skipped} skipped (unmapped player)")
    return len(rows)


# ---------------------------------------------------------------------------
# Matches
# ---------------------------------------------------------------------------

def promote_matches(match_map: dict[tuple[str, str], str]) -> int:
    """
    Enrich canonical.matches stubs that were created by resolve_matches().

    For each raw match row, look up its canonical stub via match_map and fill
    in any fields that are currently null (sets, round, best_of). We never
    overwrite fields that are already populated — the first source to report
    a match wins on data fields.
    """
    if not match_map:
        print("  [canonical] Matches: no match_map — skipping")
        return 0

    # fetch_all paginates past the 1000-row cap
    raw_rows = fetch_all("raw", "matches")

    canonical_ids_needed = {
        match_map[(r["source"], r["source_match_id"])]
        for r in raw_rows
        if (r["source"], r["source_match_id"]) in match_map
    }

    if not canonical_ids_needed:
        print("  [canonical] Matches: no mapped rows to enrich")
        return 0

    # fetch_all handles both pagination and .in_() chunking
    existing_rows = fetch_all(
        "canonical", "matches",
        "id,sets,round,best_of",
        ("id", list(canonical_ids_needed)),
    )
    current_by_id = {r["id"]: r for r in existing_rows}

    enriched = 0
    skipped  = 0

    for r in raw_rows:
        canonical_id = match_map.get((r["source"], r["source_match_id"]))
        if not canonical_id:
            skipped += 1
            continue

        current = current_by_id.get(canonical_id)
        if not current:
            skipped += 1
            continue

        rj      = r.get("raw_json", {})
        score   = rj.get("score")
        updates = {}

        if current.get("sets") is None and score:
            parsed = _parse_sets(score)
            if parsed:
                updates["sets"] = parsed

        if current.get("round") is None and rj.get("round"):
            updates["round"] = rj["round"]

        if current.get("best_of") is None and rj.get("best_of"):
            updates["best_of"] = rj["best_of"]

        if updates:
            _canonical("matches").update(updates).eq("id", canonical_id).execute()
            # Keep in-memory view consistent so duplicate raw rows
            # don't re-enrich fields we just wrote
            current_by_id[canonical_id].update(updates)
            enriched += 1

    print(f"  [canonical] Matches: {enriched} enriched, {skipped} skipped")
    return enriched


# ---------------------------------------------------------------------------
# Convenience
# ---------------------------------------------------------------------------

def promote_all(
    player_map:     dict[tuple[str, str], str],
    tournament_map: dict[tuple[str, str], str],
    match_map:      dict[tuple[str, str], str],
) -> dict:
    n_players  = promote_players(player_map)
    n_rankings = promote_rankings(player_map)
    n_matches  = promote_matches(match_map)
    return {"players": n_players, "rankings": n_rankings, "matches": n_matches}