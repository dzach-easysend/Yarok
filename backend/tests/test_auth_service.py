"""Unit tests for src/services/auth.py -- JWT and password hashing."""

from datetime import datetime, timedelta, timezone

from jose import jwt

from src.services.auth import (
    _DEV_SECRET as DEV_SECRET,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------


class TestPasswordHashing:
    """Tests for hash_password / verify_password (bcrypt)."""

    def test_hash_and_verify_roundtrip(self):
        hashed = hash_password("s3cureP@ss")
        assert verify_password("s3cureP@ss", hashed) is True

    def test_verify_wrong_password(self):
        hashed = hash_password("correctPassword")
        assert verify_password("wrongPassword", hashed) is False

    def test_hash_produces_bcrypt_prefix(self):
        hashed = hash_password("test")
        assert hashed.startswith("$2b$")

    def test_different_hashes_for_same_input(self):
        """bcrypt uses a random salt, so two hashes of the same password differ."""
        h1 = hash_password("same")
        h2 = hash_password("same")
        assert h1 != h2
        assert verify_password("same", h1)
        assert verify_password("same", h2)


# ---------------------------------------------------------------------------
# Access token
# ---------------------------------------------------------------------------


class TestAccessToken:
    """Tests for create_access_token (HS256 dev mode)."""

    def test_contains_sub_and_scope(self):
        token = create_access_token("user-123")
        payload = jwt.decode(token, DEV_SECRET, algorithms=["HS256"])
        assert payload["sub"] == "user-123"
        assert payload["scope"] == "user"

    def test_custom_scope(self):
        token = create_access_token("dev-456", scope="device")
        payload = jwt.decode(token, DEV_SECRET, algorithms=["HS256"])
        assert payload["scope"] == "device"

    def test_has_expiry(self):
        token = create_access_token("user-1")
        payload = jwt.decode(token, DEV_SECRET, algorithms=["HS256"])
        assert "exp" in payload

    def test_expiry_is_in_the_future(self):
        token = create_access_token("user-1")
        payload = jwt.decode(token, DEV_SECRET, algorithms=["HS256"])
        exp_dt = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        assert exp_dt > datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Refresh token
# ---------------------------------------------------------------------------


class TestRefreshToken:
    """Tests for create_refresh_token (HS256 dev mode)."""

    def test_contains_type_refresh(self):
        token = create_refresh_token("user-1")
        payload = jwt.decode(token, DEV_SECRET, algorithms=["HS256"])
        assert payload["type"] == "refresh"

    def test_contains_sub(self):
        token = create_refresh_token("user-99")
        payload = jwt.decode(token, DEV_SECRET, algorithms=["HS256"])
        assert payload["sub"] == "user-99"

    def test_has_expiry(self):
        token = create_refresh_token("user-1")
        payload = jwt.decode(token, DEV_SECRET, algorithms=["HS256"])
        assert "exp" in payload


# ---------------------------------------------------------------------------
# decode_token
# ---------------------------------------------------------------------------


class TestDecodeToken:
    """Tests for decode_token."""

    def test_decode_valid_access_token(self):
        token = create_access_token("user-1")
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "user-1"

    def test_decode_valid_refresh_token(self):
        token = create_refresh_token("user-2")
        payload = decode_token(token)
        assert payload is not None
        assert payload["type"] == "refresh"

    def test_decode_garbage_returns_none(self):
        assert decode_token("not.a.jwt") is None

    def test_decode_empty_string_returns_none(self):
        assert decode_token("") is None

    def test_decode_expired_token_returns_none(self):
        """Manually craft an already-expired token."""
        expired_payload = {
            "sub": "user-1",
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),
        }
        expired_token = jwt.encode(expired_payload, DEV_SECRET, algorithm="HS256")
        assert decode_token(expired_token) is None

    def test_decode_token_with_wrong_secret_returns_none(self):
        payload = {"sub": "user-1", "exp": datetime.now(timezone.utc) + timedelta(hours=1)}
        bad_token = jwt.encode(payload, "wrong-secret", algorithm="HS256")
        assert decode_token(bad_token) is None
