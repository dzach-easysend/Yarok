"""Field-level encryption for PII (Fernet)."""

import os

from cryptography.fernet import Fernet


def get_fernet(key_b64: str | None = None) -> Fernet | None:
    """Return a Fernet instance from env key or None if not configured."""
    raw = (key_b64 or os.environ.get("ENCRYPTION_KEY", "")).strip()
    if not raw:
        return None
    try:
        return Fernet(raw.encode())
    except Exception:
        return None


def encrypt_value(fernet: Fernet | None, value: str | None) -> str | None:
    """Encrypt a string; return None if value is None or fernet missing."""
    if value is None or not value.strip():
        return None
    if fernet is None:
        return value
    try:
        return fernet.encrypt(value.encode()).decode()
    except Exception:
        return value


def decrypt_value(fernet: Fernet | None, value: str | None) -> str | None:
    """Decrypt a string; return original if fernet missing or invalid."""
    if value is None or not value.strip():
        return None
    if fernet is None:
        return value
    try:
        return fernet.decrypt(value.encode()).decode()
    except Exception:
        return value
