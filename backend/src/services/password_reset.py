"""Password reset: token creation, verification, and email sending."""

import hashlib
import secrets
from datetime import datetime, timezone, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.models.password_reset import PasswordResetToken
from src.models.user import User
from src.services.auth import hash_password
from src.services.email import send_email

RESET_TOKEN_EXPIRY_HOURS = 1


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_reset_token() -> str:
    """Return a URL-safe random token (for link)."""
    return secrets.token_urlsafe(32)


async def create_and_send_reset(
    db: AsyncSession,
    email: str,
) -> None:
    """
    If a user exists with this email and has a password (registered user):
    create a reset token, persist it, and send the reset link by email.
    Otherwise do nothing (no leak of whether email exists).
    Raises if email sending is not configured.
    """
    if not settings.password_reset_base_url:
        raise RuntimeError("PASSWORD_RESET_BASE_URL not set")
    result = await db.execute(
        select(User).where(User.email == email, User.password_hash.isnot(None))
    )
    user = result.scalar_one_or_none()
    if not user:
        return
    raw_token = generate_reset_token()
    token_hash = _hash_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=RESET_TOKEN_EXPIRY_HOURS)
    prt = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(prt)
    await db.flush()
    link = f"{settings.password_reset_base_url.rstrip('/')}/auth/reset-password?token={raw_token}"
    subject = "איפוס סיסמה - ירוק"
    body_text = f"ביקשת לאפס את הסיסמה. לחץ על הקישור להמשך (תוקף שעה):\n{link}"
    body_html = f"""
    <p>ביקשת לאפס את הסיסמה.</p>
    <p><a href="{link}">לחץ כאן לאיפוס סיסמה</a> (תוקף שעה).</p>
    <p>אם לא ביקשת זאת, התעלם מהמייל.</p>
    """
    send_email(to=email, subject=subject, body_text=body_text, body_html=body_html)


async def consume_reset_token(db: AsyncSession, raw_token: str, new_password: str) -> None:
    """
    If the token is valid and not expired, update the user's password and delete the token.
    Raises ValueError with a message if token invalid or expired.
    """
    token_hash = _hash_token(raw_token)
    result = await db.execute(
        select(PasswordResetToken)
        .where(PasswordResetToken.token_hash == token_hash)
        .where(PasswordResetToken.expires_at > datetime.now(timezone.utc))
    )
    prt = result.scalar_one_or_none()
    if not prt:
        raise ValueError("Invalid or expired reset token")
    result_user = await db.execute(select(User).where(User.id == prt.user_id))
    user = result_user.scalar_one_or_none()
    if not user:
        raise ValueError("User not found")
    user.password_hash = hash_password(new_password)
    await db.delete(prt)
    await db.flush()
