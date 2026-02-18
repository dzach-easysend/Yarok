"""API tests for /api/v1/auth endpoints with mocked database."""


import pytest

from src.services.auth import create_access_token, create_refresh_token, hash_password
from tests.conftest import make_execute_result, make_user

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
