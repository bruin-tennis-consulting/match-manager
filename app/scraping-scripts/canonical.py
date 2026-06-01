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

    existing_rows = _fetch_in_batches("players", "id", list(canonical_ids_needed), "*")
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