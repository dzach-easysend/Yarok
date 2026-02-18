"""Auth endpoints: register, login, refresh, device."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models.user import User
from src.schemas.user import DeviceRegister, RefreshRequest, TokenPair, UserLogin, UserRegister
from src.services.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


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
