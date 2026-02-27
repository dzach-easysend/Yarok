"""Purge all reports and their media from the database. Used by CLI script and admin API."""

from pathlib import Path
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.database import AsyncSessionLocal
from src.models.media import Media
from src.models.report import Report


def _get_upload_dir() -> Path:
    """Resolve the local upload directory (mirrors logic in the media API)."""
    upload_dir = Path(settings.media_upload_dir)
    if not upload_dir.is_absolute():
        upload_dir = Path(__file__).resolve().parents[2] / upload_dir
    return upload_dir


async def _count_rows(session: AsyncSession) -> tuple[int, int]:
    """Return (report_count, media_count)."""
    report_count = (await session.execute(select(func.count()).select_from(Report))).scalar_one()
    media_count = (await session.execute(select(func.count()).select_from(Media))).scalar_one()
    return report_count, media_count


async def _collect_storage_keys(session: AsyncSession) -> list[str]:
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
        return 0

    session = aiobotocore.session.get_session()
    kwargs: dict[str, Any] = {
        "region_name": settings.s3_region,
        "aws_access_key_id": settings.s3_access_key,
        "aws_secret_access_key": settings.s3_secret_key,
    }
    if settings.s3_endpoint_url:
        kwargs["endpoint_url"] = settings.s3_endpoint_url

    deleted = 0
    async with session.create_client("s3", **kwargs) as client:
        batch_size = 1000
        for i in range(0, len(storage_keys), batch_size):
            batch = storage_keys[i : i + batch_size]
            objects = [{"Key": k} for k in batch]
            response = await client.delete_objects(
                Bucket=settings.s3_bucket,
                Delete={"Objects": objects, "Quiet": True},
            )
            errors = response.get("Errors", [])
            deleted += len(batch) - len(errors)

    return deleted


async def run_purge(*, dry_run: bool = False) -> dict[str, Any]:
    """Purge all reports and their media. Safe to call from API or CLI.

    When dry_run=True, only returns current counts and does not delete anything.
    When dry_run=False, deletes local/S3 media and truncates reports table.

    Returns a dict with keys: report_count, media_count, dry_run; when not dry_run
    also: local_deleted, local_missing, s3_deleted, remaining_reports, remaining_media.
    """
    async with AsyncSessionLocal() as session:
        report_count, media_count = await _count_rows(session)

    result: dict[str, Any] = {
        "report_count": report_count,
        "media_count": media_count,
        "dry_run": dry_run,
    }

    if dry_run or report_count == 0:
        return result

    async with AsyncSessionLocal() as session:
        storage_keys = await _collect_storage_keys(session)

    local_deleted, local_missing = _delete_local_files(storage_keys)
    result["local_deleted"] = local_deleted
    result["local_missing"] = local_missing

    s3_deleted = await _delete_s3_objects(storage_keys)
    result["s3_deleted"] = s3_deleted

    async with AsyncSessionLocal() as session:
        await session.execute(delete(Media))
        await session.execute(delete(Report))
        await session.commit()

    async with AsyncSessionLocal() as session:
        remaining_reports, remaining_media = await _count_rows(session)

    result["remaining_reports"] = remaining_reports
    result["remaining_media"] = remaining_media
    return result
