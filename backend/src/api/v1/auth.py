"""Auth endpoints: register, login, refresh, device, me."""

from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models.user import User
from src.schemas.user import (
    DeviceRegister,
    ForgotPasswordRequest,
    MeResponse,
    RefreshRequest,
    ResetPasswordRequest,
    TokenPair,
    UserLogin,
    UserRegister,
)
from src.services.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from src.services.password_reset import create_and_send_reset, consume_reset_token

router = APIRouter(prefix="/auth", tags=["auth"])


async def get_current_user_id(authorization: Optional[str] = Header(None)) -> Optional[str]:
    """Extract user_id (JWT sub) from Bearer token; returns None if absent/invalid."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    payload = decode_token(authorization[7:])
    if not payload:
        return None
    return payload.get("sub")


@router.post("/register", response_model=TokenPair)
async def register(
    body: UserRegister,
    db: AsyncSession = Depends(get_db),
) -> TokenPair:
    """Register with email and password."""
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        display_name=body.display_name,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    sub = str(user.id)
    return TokenPair(
        access_token=create_access_token(sub),
        refresh_token=create_refresh_token(sub),
        display_name=user.display_name,
        user_id=sub,
    )


@router.post("/login", response_model=TokenPair)
async def login(
    body: UserLogin,
    db: AsyncSession = Depends(get_db),
) -> TokenPair:
    """Login with email and password."""
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")
    sub = str(user.id)
    return TokenPair(
        access_token=create_access_token(sub),
        refresh_token=create_refresh_token(sub),
        display_name=user.display_name,
        user_id=sub,
    )


@router.get("/me", response_model=MeResponse)
async def get_me(
    db: AsyncSession = Depends(get_db),
    user_id: Optional[str] = Depends(get_current_user_id),
) -> MeResponse:
    """Return current user profile; 401 if no valid token."""
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return MeResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshRequest) -> TokenPair:
    """Exchange refresh token for new access + refresh."""
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        )
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid payload")
    return TokenPair(
        access_token=create_access_token(sub),
        refresh_token=create_refresh_token(sub),
    )


@router.post("/forgot-password")
async def forgot_password(
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Request a password reset link by email.
    Always returns 200 with the same message (no email enumeration).
    Returns 503 if email/SMTP or PASSWORD_RESET_BASE_URL not configured.
    """
    from src.config import settings

    if not settings.password_reset_base_url or not settings.smtp_host:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password reset is not configured",
        )
    try:
        await create_and_send_reset(db, body.email)
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password reset is not configured",
        )
    return {"message": "If an account exists with this email, a reset link was sent."}


@router.post("/reset-password")
async def reset_password(
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Set a new password using the token from the reset email."""
    try:
        await consume_reset_token(db, body.token, body.new_password)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    return {"message": "Password updated. You can log in with your new password."}


@router.post("/device", response_model=TokenPair)
async def register_device(
    body: DeviceRegister,
    db: AsyncSession = Depends(get_db),
) -> TokenPair:
    """Register anonymous device; returns device-scoped JWT."""
    result = await db.execute(select(User).where(User.device_token == body.device_id))
    user = result.scalar_one_or_none()
    if not user:
        user = User(device_token=body.device_id, push_token=body.push_token)
        db.add(user)
        await db.flush()
        await db.refresh(user)
    else:
        if body.push_token:
            user.push_token = body.push_token
            await db.flush()
    sub = str(user.id)
    return TokenPair(
        access_token=create_access_token(sub, scope="device"),
        refresh_token=create_refresh_token(sub),
    )
