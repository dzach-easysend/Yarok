"""API tests for /api/v1/auth endpoints with mocked database."""

from uuid import uuid4

import pytest

from src.services.auth import create_access_token, create_refresh_token, hash_password
from tests.conftest import (
    auth_headers,
    make_execute_result,
    make_password_reset_token,
    make_user,
)

# ---------------------------------------------------------------------------
# POST /api/v1/auth/register
# ---------------------------------------------------------------------------


class TestRegister:
    """Tests for the user registration endpoint."""

    @pytest.mark.asyncio
    async def test_register_success(self, client, mock_db):
        # No existing user with this email
        mock_db.execute.return_value = make_execute_result(scalar_one_or_none_value=None)

        resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "new@example.com",
                "password": "StrongP@ss1",
            },
        )

        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        # Verify add was called (user was created)
        mock_db.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_register_with_display_name(self, client, mock_db):
        mock_db.execute.return_value = make_execute_result(scalar_one_or_none_value=None)

        resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "new@example.com",
                "password": "StrongP@ss1",
                "display_name": "Alice",
            },
        )

        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, client, mock_db):
        existing_user = make_user(email="taken@example.com")
        mock_db.execute.return_value = make_execute_result(
            scalar_one_or_none_value=existing_user,
        )

        resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "taken@example.com",
                "password": "AnyPass1",
            },
        )

        assert resp.status_code == 409
        assert "already registered" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_register_invalid_email(self, client, mock_db):
        resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "not-an-email",
                "password": "P@ssword1",
            },
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_register_missing_password(self, client, mock_db):
        resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "a@b.com",
            },
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/v1/auth/login
# ---------------------------------------------------------------------------


class TestLogin:
    """Tests for the login endpoint."""

    @pytest.mark.asyncio
    async def test_login_success(self, client, mock_db):
        user = make_user(
            email="user@test.com",
            password_hash=hash_password("correct"),
            is_active=True,
        )
        mock_db.execute.return_value = make_execute_result(
            scalar_one_or_none_value=user,
        )

        resp = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "user@test.com",
                "password": "correct",
            },
        )

        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data.get("user_id") == user.id
        assert data.get("display_name") == user.display_name

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client, mock_db):
        user = make_user(password_hash=hash_password("right"))
        mock_db.execute.return_value = make_execute_result(
            scalar_one_or_none_value=user,
        )

        resp = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "user@example.com",
                "password": "wrong",
            },
        )

        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self, client, mock_db):
        mock_db.execute.return_value = make_execute_result(
            scalar_one_or_none_value=None,
        )

        resp = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "ghost@example.com",
                "password": "any",
            },
        )

        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_login_disabled_account(self, client, mock_db):
        user = make_user(
            password_hash=hash_password("pass"),
            is_active=False,
        )
        mock_db.execute.return_value = make_execute_result(
            scalar_one_or_none_value=user,
        )

        resp = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "user@example.com",
                "password": "pass",
            },
        )

        assert resp.status_code == 403
        assert "disabled" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_login_user_without_password(self, client, mock_db):
        """Device-only user has no password_hash; login should fail."""
        user = make_user(password_hash=None)
        mock_db.execute.return_value = make_execute_result(
            scalar_one_or_none_value=user,
        )

        resp = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "user@example.com",
                "password": "any",
            },
        )

        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# POST /api/v1/auth/refresh
# ---------------------------------------------------------------------------


class TestRefresh:
    """Tests for the token refresh endpoint."""

    @pytest.mark.asyncio
    async def test_refresh_success(self, client, mock_db):
        refresh_tok = create_refresh_token("user-1")

        resp = await client.post(
            "/api/v1/auth/refresh",
            json={
                "refresh_token": refresh_tok,
            },
        )

        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data

    @pytest.mark.asyncio
    async def test_refresh_with_garbage_token(self, client, mock_db):
        resp = await client.post(
            "/api/v1/auth/refresh",
            json={
                "refresh_token": "garbage.token.here",
            },
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_with_access_token_rejected(self, client, mock_db):
        """An access token does not have type='refresh'; should be rejected."""
        access_tok = create_access_token("user-1")

        resp = await client.post(
            "/api/v1/auth/refresh",
            json={
                "refresh_token": access_tok,
            },
        )

        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_missing_body(self, client, mock_db):
        resp = await client.post("/api/v1/auth/refresh", json={})
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/v1/auth/device
# ---------------------------------------------------------------------------


class TestDeviceRegister:
    """Tests for anonymous device registration."""

    @pytest.mark.asyncio
    async def test_device_register_new(self, client, mock_db):
        """New device_id -> creates user, returns tokens."""
        mock_db.execute.return_value = make_execute_result(
            scalar_one_or_none_value=None,
        )

        resp = await client.post(
            "/api/v1/auth/device",
            json={
                "device_id": "device-abc-123",
            },
        )

        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        mock_db.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_device_register_existing_no_push(self, client, mock_db):
        """Existing device, no push_token update."""
        existing = make_user(device_token="device-abc-123")
        mock_db.execute.return_value = make_execute_result(
            scalar_one_or_none_value=existing,
        )

        resp = await client.post(
            "/api/v1/auth/device",
            json={
                "device_id": "device-abc-123",
            },
        )

        assert resp.status_code == 200
        # Should NOT call add (user already exists)
        mock_db.add.assert_not_called()

    @pytest.mark.asyncio
    async def test_device_register_existing_updates_push_token(self, client, mock_db):
        """Existing device with a new push_token -> push_token updated."""
        existing = make_user(device_token="device-abc-123", push_token=None)
        mock_db.execute.return_value = make_execute_result(
            scalar_one_or_none_value=existing,
        )

        resp = await client.post(
            "/api/v1/auth/device",
            json={
                "device_id": "device-abc-123",
                "push_token": "ExponentPushToken[new]",
            },
        )

        assert resp.status_code == 200
        assert existing.push_token == "ExponentPushToken[new]"

    @pytest.mark.asyncio
    async def test_device_register_missing_device_id(self, client, mock_db):
        resp = await client.post("/api/v1/auth/device", json={})
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/v1/auth/me
# ---------------------------------------------------------------------------


class TestGetMe:
    """Tests for the current user profile endpoint."""

    @pytest.mark.asyncio
    async def test_me_success_returns_display_name(self, client, mock_db):
        user_id = str(uuid4())
        user = make_user(id=user_id, display_name="Dana", email="dana@test.com")
        mock_db.execute.return_value = make_execute_result(
            scalar_one_or_none_value=user,
        )

        resp = await client.get(
            "/api/v1/auth/me",
            headers=auth_headers(user_id),
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == user_id
        assert data["email"] == "dana@test.com"
        assert data["display_name"] == "Dana"

    @pytest.mark.asyncio
    async def test_me_401_without_token(self, client, mock_db):
        resp = await client.get("/api/v1/auth/me")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_me_401_user_not_found(self, client, mock_db):
        user_id = str(uuid4())
        mock_db.execute.return_value = make_execute_result(
            scalar_one_or_none_value=None,
        )

        resp = await client.get(
            "/api/v1/auth/me",
            headers=auth_headers(user_id),
        )

        assert resp.status_code == 401
        assert "not found" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# POST /api/v1/auth/forgot-password
# ---------------------------------------------------------------------------


class TestForgotPassword:
    """Tests for the forgot-password endpoint."""

    @pytest.mark.asyncio
    async def test_forgot_password_not_configured(self, client, mock_db, monkeypatch):
        from src import config

        monkeypatch.setattr(config.settings, "password_reset_base_url", "")
        monkeypatch.setattr(config.settings, "smtp_host", "")

        resp = await client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "user@example.com"},
        )
        assert resp.status_code == 503
        assert "not configured" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_forgot_password_success(self, client, mock_db, monkeypatch):
        from unittest import mock

        from src import config

        monkeypatch.setattr(config.settings, "password_reset_base_url", "https://app.example.com")
        monkeypatch.setattr(config.settings, "smtp_host", "smtp.example.com")

        with mock.patch("src.api.v1.auth.create_and_send_reset", new_callable=mock.AsyncMock):
            resp = await client.post(
                "/api/v1/auth/forgot-password",
                json={"email": "user@example.com"},
            )
        assert resp.status_code == 200
        assert "message" in resp.json()

    @pytest.mark.asyncio
    async def test_forgot_password_invalid_email(self, client, mock_db, monkeypatch):
        from src import config

        monkeypatch.setattr(config.settings, "password_reset_base_url", "https://app.example.com")
        monkeypatch.setattr(config.settings, "smtp_host", "smtp.example.com")

        resp = await client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "not-an-email"},
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/v1/auth/reset-password
# ---------------------------------------------------------------------------


class TestResetPassword:
    """Tests for the reset-password endpoint."""

    @pytest.mark.asyncio
    async def test_reset_password_invalid_token(self, client, mock_db):
        mock_db.execute.return_value = make_execute_result(scalar_one_or_none_value=None)

        resp = await client.post(
            "/api/v1/auth/reset-password",
            json={"token": "invalid-or-expired", "new_password": "NewPass123!"},
        )
        assert resp.status_code == 400
        detail = resp.json()["detail"].lower()
        assert "invalid" in detail or "expired" in detail

    @pytest.mark.asyncio
    async def test_reset_password_success(self, client, mock_db):
        user_id = str(uuid4())
        user = make_user(id=user_id, email="u@example.com", password_hash="old_hash")
        prt = make_password_reset_token(user_id=user_id)
        mock_db.execute.side_effect = [
            make_execute_result(scalar_one_or_none_value=prt),
            make_execute_result(scalar_one_or_none_value=user),
        ]

        resp = await client.post(
            "/api/v1/auth/reset-password",
            json={"token": "any-raw-token", "new_password": "NewPass123!"},
        )
        assert resp.status_code == 200
        assert "password" in resp.json()["message"].lower()

    @pytest.mark.asyncio
    async def test_reset_password_missing_fields(self, client, mock_db):
        resp = await client.post("/api/v1/auth/reset-password", json={"token": "abc"})
        assert resp.status_code == 422
