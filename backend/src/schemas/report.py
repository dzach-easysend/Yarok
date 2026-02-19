"""Report schemas."""

from typing import Optional

from pydantic import BaseModel, Field


class ReportCreate(BaseModel):
    """Create report (location + metadata; media via separate upload)."""

    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    description: Optional[str] = None
    contact_info: Optional[str] = None


class ReportUpdate(BaseModel):
    """Update report status."""

    status: str = Field(..., pattern="^(open|in_progress|cleaned|invalid)$")


class MediaItem(BaseModel):
    """Media item in API response."""

    id: str
    media_type: str
    url: str


class ReportResponse(BaseModel):
    """Report in API response."""

    id: str
    lat: float
    lng: float
    address: Optional[str]
    description: Optional[str]
    status: str
    created_at: str
    media_count: int = 0
    media: list[MediaItem] = []

    model_config = {"from_attributes": True}
