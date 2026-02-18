"""Notification subscription and log."""

from typing import Any, Optional

from geoalchemy2 import Geometry
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import Base, TimestampMixin, new_uuid


class Subscription(Base, TimestampMixin):
    """User/device subscription to an area for push notifications."""

    __tablename__ = "subscriptions"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=new_uuid,
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    center: Mapped[Any] = mapped_column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    radius_km: Mapped[float] = mapped_column(Float, nullable=False)
    push_enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    user = relationship("User", back_populates="subscriptions")


class NotificationLog(Base, TimestampMixin):
    """Log of sent push notifications."""

    __tablename__ = "notification_log"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=new_uuid,
    )
    subscription_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("subscriptions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    report_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    channel: Mapped[str] = mapped_column(String(16), nullable=False)  # push, email
    status: Mapped[str] = mapped_column(String(16), default="sent")  # sent, failed, read
    sent_at: Mapped[Optional[Any]] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=True,
    )
