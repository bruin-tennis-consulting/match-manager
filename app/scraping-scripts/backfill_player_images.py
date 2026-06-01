"""
backfill_player_images.py
=========================
One-time script: set image_url on canonical.players for all existing players
that have TennisRecruiting raw data and no image_url yet.

Run once:
    python backfill_player_images.py

After this run, image_url is only set for newly added players (handled by
resolution.py's _create_canonical_player).
"""

from db.client import supabase

_TR_BASE_URL = "https://www.tennisrecruiting.net"
_TR_NO_PHOTO = "/img/nophoto.gif"
_SOURCE      = "tennisrecruiting.net"

_raw        = lambda t: supabase.schema("raw").table(t)
_resolution = lambda t: supabase.schema("resolution").table(t)
_canonical  = lambda t: supabase.schema("canonical").table(t)


def _load_tr_photo_map() -> dict[str, str]:
    """
    Returns {canonical_player_uuid: image_url} for all TR players that have a
    real profile photo (i.e. not the nophoto placeholder).

    Joins raw.players -> resolution.player_mappings to get canonical IDs.
    """
    raw_rows = (
        _raw("players")
        .select("source_id,raw_json")
        .eq("source", _SOURCE)
        .execute()
        .data or []
    )

    # source_id -> image_url
    sid_to_url: dict[str, str] = {}
    for row in raw_rows:
        pe    = (row.get("raw_json") or {}).get("player_extra") or {}
        photo = pe.get("photo_path")
        if photo and photo != _TR_NO_PHOTO:
            sid_to_url[str(row["source_id"])] = f"{_TR_BASE_URL}{photo}"

    if not sid_to_url:
        return {}

    # Resolve source_ids -> canonical UUIDs
    mappings = (
        _resolution("player_mappings")
        .select("source_id,canonical_id")
        .eq("source", _SOURCE)
        .in_("source_id", list(sid_to_url.keys()))
        .execute()
        .data or []
    )

    return {
        row["canonical_id"]: sid_to_url[row["source_id"]]
        for row in mappings
        if row["source_id"] in sid_to_url
    }


def backfill_player_images(dry_run: bool = False) -> None:
    print("Loading TR photo data ...")
    photo_map = _load_tr_photo_map()
    print(f"  {len(photo_map)} players have a real TR profile photo")

    if not photo_map:
        print("Nothing to backfill.")
        return

    # Fetch canonical players that already have an image_url to skip them
    existing = (
        _canonical("players")
        .select("id,image_url")
        .in_("id", list(photo_map.keys()))
        .execute()
        .data or []
    )

    already_set = {r["id"] for r in existing if r.get("image_url")}
    to_update   = {cid: url for cid, url in photo_map.items() if cid not in already_set}

    print(f"  {len(already_set)} already have an image_url — skipping")
    print(f"  {len(to_update)} to update")

    if not to_update:
        print("Nothing new to backfill.")
        return

    updated = 0
    for canonical_id, image_url in to_update.items():
        if dry_run:
            print(f"  [dry-run] Would set {canonical_id} -> {image_url}")
            continue
        _canonical("players").update({"image_url": image_url}).eq("id", canonical_id).execute()
        updated += 1

    action = "Would update" if dry_run else "Updated"
    print(f"{action} {updated} canonical players with image_url.")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print changes without writing to DB")
    args = parser.parse_args()
    backfill_player_images(dry_run=args.dry_run)
