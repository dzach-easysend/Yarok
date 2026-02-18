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

from sqlalchemy import func, select, text

# Ensure the backend/src package is importable when run from backend/.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.config import settings
from src.database import AsyncSessionLocal
from src.models.media import Media
from src.models.report import Report


def _get_upload_dir() -> Path:
    """Resolve the local upload directory (mirrors logic in the media API)."""
    upload_dir = Path(settings.media_upload_dir)
    if not upload_dir.is_absolute():
        # Relative paths are resolved from the backend/ root (three levels up from src/api/v1/)
        upload_dir = Path(__file__).resolve().parents[1] / upload_dir
    return upload_dir


async def _count_rows(session) -> tuple[int, int]:
    """Return (report_count, media_count)."""
    report_count = (await session.execute(select(func.count()).select_from(Report))).scalar_one()
    media_count = (await session.execute(select(func.count()).select_from(Media))).scalar_one()
    return report_count, media_count


async def _collect_storage_keys(session) -> list[str]:
    """Return all media storage_keys currently in the database."""
    result = await session.execute(select(Media.storage_key))
    return [row[0] for row in result.all()]


def _delete_local_files(storage_keys: list[str]) -> tuple[int, int]:
    """Delete local media files. Returns (deleted, missing)."""
    upload_dir = _get_upload_dir()
    deleted = missing = 0
    for key in storage_keys:
        path = upload_dir / key
        if path.exists():
            path.unlink()
            deleted += 1
        else:
            missing += 1
    return deleted, missing


async def _delete_s3_objects(storage_keys: list[str]) -> int:
    """Delete objects from S3 if configured. Returns number of objects deleted."""
    if not settings.s3_access_key or not settings.s3_secret_key:
        return 0

    try:
        import aiobotocore.session  # type: ignore[import]
    except ImportError:
        print("  [warn] aiobotocore not installed — skipping S3 deletion.")
        return 0

    session = aiobotocore.session.get_session()
    kwargs = {
        "region_name": settings.s3_region,
        "aws_access_key_id": settings.s3_access_key,
        "aws_secret_access_key": settings.s3_secret_key,
    }
    if settings.s3_endpoint_url:
        kwargs["endpoint_url"] = settings.s3_endpoint_url

    deleted = 0
    async with session.create_client("s3", **kwargs) as client:
        # S3 batch-delete supports up to 1 000 keys per request.
        batch_size = 1000
        for i in range(0, len(storage_keys), batch_size):
            batch = storage_keys[i : i + batch_size]
            objects = [{"Key": k} for k in batch]
            response = await client.delete_objects(
                Bucket=settings.s3_bucket,
                Delete={"Objects": objects, "Quiet": True},
            )
            errors = response.get("Errors", [])
            if errors:
                for err in errors:
                    print(f"  [warn] S3 delete error for {err['Key']}: {err['Message']}")
            deleted += len(batch) - len(errors)

    return deleted


async def purge(*, dry_run: bool = False, force: bool = False) -> None:
    """Main purge logic."""
    async with AsyncSessionLocal() as session:
        report_count, media_count = await _count_rows(session)

    print(f"Reports in database : {report_count}")
    print(f"Media rows in database: {media_count}")

    if report_count == 0:
        print("Nothing to purge.")
        return

    if dry_run:
        print("\n[dry-run] No changes made.")
        return

    if not force:
        answer = input(
            f"\nThis will permanently delete {report_count} report(s) and "
            f"{media_count} media file(s).\nType 'yes' to confirm: "
        ).strip()
        if answer.lower() != "yes":
            print("Aborted.")
            return

    # Collect storage keys before truncating the DB.
    async with AsyncSessionLocal() as session:
        storage_keys = await _collect_storage_keys(session)

    # Delete media files from local storage.
    print("\nDeleting local media files...")
    local_deleted, local_missing = _delete_local_files(storage_keys)
    print(f"  Deleted: {local_deleted}  |  Not found on disk: {local_missing}")

    # Delete media files from S3 if configured.
    if settings.s3_access_key and settings.s3_secret_key:
        print("Deleting S3 objects...")
        s3_deleted = await _delete_s3_objects(storage_keys)
        print(f"  S3 objects deleted: {s3_deleted}")

    # Truncate reports table; media rows cascade automatically.
    print("\nPurging database rows...")
    async with AsyncSessionLocal() as session:
        await session.execute(text("TRUNCATE TABLE reports CASCADE"))
        await session.commit()

    # Verify the tables are empty.
    async with AsyncSessionLocal() as session:
        remaining_reports, remaining_media = await _count_rows(session)

    print(f"  Reports remaining : {remaining_reports}")
    print(f"  Media rows remaining: {remaining_media}")
    print("\nPurge complete.")


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

    asyncio.run(purge(dry_run=args.dry_run, force=args.force))


if __name__ == "__main__":
    main()
