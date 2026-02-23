"""Report model with PostGIS location."""

from typing import Any, Optional

from geoalchemy2 import Geometry
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import Base, TimestampMixin, new_uuid


class Report(Base, TimestampMixin):
    """A garbage report with location and optional description/contact."""

    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=new_uuid,
    )
    user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    device_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    location: Mapped[Any] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326), nullable=False
    )
    address: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    contact_info: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(
        String(32), default="open"
    )  # open, in_progress, cleaned, invalid
    view_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    user = relationship("User", back_populates="reports", foreign_keys=[user_id])
    media = relationship("Media", back_populates="report", cascade="all, delete-orphan")
