"""Media upload and retrieval endpoints."""

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.database import get_db
from src.models.media import Media
from src.models.report import Report

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
    """Upload a media file (photo/video) for a report.

    Stores the file locally in the uploads directory and creates a
    Media record in the database.
    """
    # Verify report exists
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    # Validate content type
    content_type = file.content_type or ""
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {content_type}",
        )

    # Read file data (with size limit)
    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large (max 20 MB)",
        )

    # Generate unique filename
    ext = _extension_for(content_type)
    filename = f"{uuid.uuid4().hex}{ext}"
    upload_dir = _get_upload_dir()
    filepath = upload_dir / filename
    filepath.write_bytes(data)

    # Create Media record
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
        "url": f"/media/{filename}",
        "file_size_bytes": len(data),
    }


@router.get("/{report_id}/media")
async def list_media(
    report_id: str,
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """List all media files for a report."""
    # Verify report exists
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
            "url": f"/media/{m.storage_key}",
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
