"""User model (optional sign-up; anonymous users use device_id)."""

from typing import Optional

from sqlalchemy import Boolean, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import Base, TimestampMixin, new_uuid


class User(Base, TimestampMixin):
    """User account or anonymous device identity."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=new_uuid,
    )
    email: Mapped[Optional[str]] = mapped_column(
        String(255), unique=True, nullable=True, index=True
    )
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    device_token: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    push_token: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    reports = relationship("Report", back_populates="user", foreign_keys="Report.user_id")
    subscriptions = relationship("Subscription", back_populates="user")
