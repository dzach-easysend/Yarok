"""JWT creation/verification and password hashing."""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from src.config import settings

# Workaround: passlib + bcrypt >= 4.1 incompatibility.
# bcrypt 4.1+ rejects passwords > 72 bytes, but passlib's internal
# wrap-bug detection test uses a 255-byte password. Monkey-patch
# bcrypt.hashpw/checkpw to truncate before calling the C implementation.
try:
    import bcrypt as _bcrypt_mod

    _orig_hashpw = _bcrypt_mod.hashpw
    _orig_checkpw = _bcrypt_mod.checkpw

    def _safe_hashpw(password, salt):
        if isinstance(password, str):
            password = password.encode("utf-8")
        return _orig_hashpw(password[:72], salt)

    def _safe_checkpw(password, hashed_password):
        if isinstance(password, str):
            password = password.encode("utf-8")
        return _orig_checkpw(password[:72], hashed_password)

    _bcrypt_mod.hashpw = _safe_hashpw
    _bcrypt_mod.checkpw = _safe_checkpw
except Exception:
    pass

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

# Random fallback secret generated at startup. Unpredictable (unlike a hardcoded string)
# and invalidates all tokens on restart, which is acceptable for dev.
# Production deployments must set JWT_PRIVATE_KEY_PEM / JWT_PUBLIC_KEY_PEM.
_DEV_SECRET = secrets.token_hex(32)


def _get_signing_key() -> tuple[str, str]:
    """Return (key, algorithm) for JWT signing."""
    if settings.jwt_private_key_pem:
        return settings.jwt_private_key_pem, "RS256"
    return _DEV_SECRET, "HS256"


def _get_verify_key() -> tuple[str, list[str]]:
    """Return (key, algorithms) for JWT verification."""
    if settings.jwt_public_key_pem:
        return settings.jwt_public_key_pem, ["RS256"]
    return _DEV_SECRET, ["HS256"]


def hash_password(password: str) -> str:
    """Return bcrypt hash of password."""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify plain password against hash."""
    return pwd_context.verify(plain, hashed)


def create_access_token(sub: str, scope: str = "user") -> str:
    """Create short-lived access JWT (RS256 if keys set, else HS256 fallback)."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_exp_minutes)
    key, algorithm = _get_signing_key()
    return jwt.encode({"sub": sub, "exp": expire, "scope": scope}, key, algorithm=algorithm)


def create_refresh_token(sub: str) -> str:
    """Create long-lived refresh JWT."""
    expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_exp_days)
    key, algorithm = _get_signing_key()
    return jwt.encode({"sub": sub, "exp": expire, "type": "refresh"}, key, algorithm=algorithm)


def decode_token(token: str) -> Optional[dict[str, Any]]:
    """Decode and verify JWT; return payload or None."""
    key, algorithms = _get_verify_key()
    # Explicitly reject 'none' algorithm to prevent algorithm confusion attacks
    algorithms = [a for a in algorithms if a.lower() != "none"]
    if not algorithms:
        return None
    try:
        return jwt.decode(token, key, algorithms=algorithms)
    except JWTError:
        return None
