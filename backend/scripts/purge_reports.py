"""Purge all reports (and their associated media) from the database.

Usage (from the backend/ directory with venv active):

    python scripts/purge_reports.py            # interactive confirmation
    python scripts/purge_reports.py --force    # skip confirmation prompt
    python scripts/purge_reports.py --dry-run  # show counts only, no changes

The script:
  1. Counts reports and media rows in the database.
  2. Collects all media storage_keys (local file paths / S3 keys).
  3. Deletes local media files from the uploads directory.
  4. Optionally deletes objects from S3 if configured.
  5. TRUNCATEs the reports table (cascades to media rows).
"""

import argparse
import asyncio
import sys
from pathlib import Path

# Ensure the backend/src package is importable when run from backend/.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.services.purge import run_purge


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Purge all reports and their media from the Yarok database."
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Skip the interactive confirmation prompt.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print counts and exit without making any changes.",
    )
    args = parser.parse_args()

    async def _run() -> None:
        dry = await run_purge(dry_run=True)
        report_count = dry["report_count"]
        media_count = dry["media_count"]

        print(f"Reports in database : {report_count}")
        print(f"Media rows in database: {media_count}")

        if report_count == 0:
            print("Nothing to purge.")
            return

        if args.dry_run:
            print("\n[dry-run] No changes made.")
            return

        if not args.force:
            answer = input(
                f"\nThis will permanently delete {report_count} report(s) and "
                f"{media_count} media file(s).\nType 'yes' to confirm: "
            ).strip()
            if answer.lower() != "yes":
                print("Aborted.")
                return

        result = await run_purge(dry_run=False)
        print("\nDeleting local media files...")
        print(f"  Deleted: {result['local_deleted']}  |  Not found: {result['local_missing']}")
        if result.get("s3_deleted", 0) > 0:
            print(f"  S3 objects deleted: {result['s3_deleted']}")
        print("\nPurging database rows...")
        print(f"  Reports remaining : {result['remaining_reports']}")
        print(f"  Media rows remaining: {result['remaining_media']}")
        print("\nPurge complete.")

    asyncio.run(_run())


if __name__ == "__main__":
    main()
