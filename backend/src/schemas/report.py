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
    """Update report fields.

    status is allowed for all authenticated users.
    description and contact_info are owner-only fields — the endpoint
    enforces this at the handler level, not the schema level.
    """

    status: Optional[str] = Field(None, pattern="^(open|in_progress|cleaned|invalid)$")
    description: Optional[str] = None
    contact_info: Optional[str] = None


class ReportListQuery(BaseModel):
    """Query parameters for listing reports within a radius."""

    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    radius_km: float = Field(10, ge=0.1, le=500)
    page: int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=100)
    status: Optional[str] = None


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
    view_count: int = 0
    is_mine: bool = False
    author_display: Optional[str] = None

    model_config = {"from_attributes": True}
