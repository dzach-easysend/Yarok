"""Media schemas."""

from pydantic import BaseModel


class MediaUploadRequest(BaseModel):
    """Request presigned upload URL."""

    report_id: str
    media_type: str  # photo, video
    content_type: str
    file_size_bytes: int


class PresignedUrlResponse(BaseModel):
    """Presigned PUT URL and key."""

    upload_url: str
    storage_key: str
    media_id: str
