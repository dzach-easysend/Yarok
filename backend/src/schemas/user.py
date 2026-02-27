"""User schemas."""

from typing import Optional

from pydantic import BaseModel, EmailStr


class UserRegister(BaseModel):
    """Registration payload."""

    email: EmailStr
    password: str
    display_name: Optional[str] = None


class UserLogin(BaseModel):
    """Login payload."""

    email: EmailStr
    password: str


class DeviceRegister(BaseModel):
    """Anonymous device registration."""

    device_id: str
    push_token: Optional[str] = None


class RefreshRequest(BaseModel):
    """Refresh token payload."""

    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    """Forgot password: send reset link to this email."""

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Reset password with token from email link."""

    token: str
    new_password: str


class TokenPair(BaseModel):
    """Access and refresh tokens; login/register also return user info."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    display_name: Optional[str] = None
    user_id: Optional[str] = None


class MeResponse(BaseModel):
    """Current user profile (GET /auth/me)."""

    id: str
    email: Optional[str] = None
    display_name: Optional[str] = None


class UserResponse(BaseModel):
    """Public user info."""

    id: str
    email: Optional[str]
    display_name: Optional[str]
    is_active: bool

    model_config = {"from_attributes": True}
