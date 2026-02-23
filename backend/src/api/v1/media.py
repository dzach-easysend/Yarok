"""Media upload and retrieval endpoints."""

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.database import get_db
from src.models.media import Media
from src.models.report import Report
from src.storage import delete_file, is_s3_configured, media_url, upload_to_s3

router = APIRouter(prefix="/reports", tags=["media"])

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "video/mp4",
    "video/quicktime",
    "video/webm",
}

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


def _get_upload_dir() -> Path:
    """Return the absolute upload directory, creating it if needed."""
    upload_dir = Path(settings.media_upload_dir)
    if not upload_dir.is_absolute():
        upload_dir = Path(__file__).resolve().parents[3] / upload_dir
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


def _media_type_from_content(content_type: str) -> str:
    """Map MIME type to media_type value."""
    if content_type.startswith("video/"):
        return "video"
    return "photo"


@router.post(
    "/{report_id}/media",
    status_code=status.HTTP_201_CREATED,
)
async def upload_media(
    report_id: str,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Upload a media file (photo/video) for a report."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    content_type = file.content_type or ""
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {content_type}",
        )

    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large (max 20 MB)",
        )

    ext = _extension_for(content_type)
    filename = f"{uuid.uuid4().hex}{ext}"

    if is_s3_configured():
        upload_to_s3(filename, data, content_type)
    else:
        upload_dir = _get_upload_dir()
        filepath = upload_dir / filename
        filepath.write_bytes(data)

    media = Media(
        report_id=report_id,
        media_type=_media_type_from_content(content_type),
        storage_key=filename,
        file_size_bytes=len(data),
    )
    db.add(media)
    await db.flush()
    await db.refresh(media)

    return {
        "id": media.id,
        "report_id": report_id,
        "media_type": media.media_type,
        "url": media_url(filename),
        "file_size_bytes": len(data),
    }


@router.get("/{report_id}/media")
async def list_media(
    report_id: str,
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """List all media files for a report."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    stmt = select(Media).where(Media.report_id == report_id).order_by(Media.created_at)
    result = await db.execute(stmt)
    media_items = result.scalars().all()

    return [
        {
            "id": m.id,
            "media_type": m.media_type,
            "url": media_url(m.storage_key),
            "file_size_bytes": m.file_size_bytes,
        }
        for m in media_items
    ]


def _extension_for(content_type: str) -> str:
    """Return a file extension for the given MIME type."""
    mapping = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
        "video/mp4": ".mp4",
        "video/quicktime": ".mov",
        "video/webm": ".webm",
    }
    return mapping.get(content_type, ".bin")


@router.delete("/{report_id}/media/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_media(
    report_id: str,
    media_id: str,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a media item. Only allowed if report has more than one media (cannot delete last)."""
    stmt = select(Media).where(
        Media.id == media_id,
        Media.report_id == report_id,
    )
    result = await db.execute(stmt)
    media = result.scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")

    count_result = await db.execute(
        select(func.count(Media.id)).where(Media.report_id == report_id)
    )
    n = count_result.scalar() or 0
    if n <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the last image",
        )

    storage_key = media.storage_key
    await db.delete(media)
    await db.flush()
    delete_file(storage_key)
