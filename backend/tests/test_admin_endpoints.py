"""Tests for admin endpoints (purge-reports)."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from src.main import app


@pytest.fixture
def admin_secret():
    return "test-admin-secret-123"


@pytest.mark.asyncio
async def test_purge_reports_admin_disabled_returns_503(monkeypatch):
    """When ADMIN_SECRET is not set, admin endpoints return 503."""
    monkeypatch.setenv("ADMIN_SECRET", "")
    # Reload settings so admin_secret is empty (conftest mock_env doesn't set it)
    from src.config import settings

    monkeypatch.setattr(settings, "admin_secret", None)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        r = await c.get(
            "/api/v1/admin/purge-reports",
            headers={"X-Admin-Secret": "anything"},
        )
    assert r.status_code == 503
    assert "disabled" in (r.json().get("detail") or "").lower()


@pytest.mark.asyncio
async def test_purge_reports_wrong_secret_returns_403(monkeypatch, admin_secret):
    """When X-Admin-Secret does not match, return 403."""
    from src.config import settings

    monkeypatch.setattr(settings, "admin_secret", admin_secret)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        r = await c.get(
            "/api/v1/admin/purge-reports",
            headers={"X-Admin-Secret": "wrong-secret"},
        )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_purge_reports_missing_secret_returns_403(monkeypatch, admin_secret):
    """When X-Admin-Secret is missing, return 403."""
    from src.config import settings

    monkeypatch.setattr(settings, "admin_secret", admin_secret)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        r = await c.get("/api/v1/admin/purge-reports")
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_purge_reports_get_dry_run_success(monkeypatch, admin_secret):
    """GET with correct X-Admin-Secret returns counts (mocked run_purge)."""
    from src.api.v1 import admin
    from src.config import settings

    monkeypatch.setattr(settings, "admin_secret", admin_secret)

    mock_result = {"report_count": 5, "media_count": 3, "dry_run": True}
    with patch.object(admin, "run_purge", new_callable=AsyncMock, return_value=mock_result):
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as c:
            r = await c.get(
                "/api/v1/admin/purge-reports",
                headers={"X-Admin-Secret": admin_secret},
            )
    assert r.status_code == 200
    assert r.json() == mock_result


@pytest.mark.asyncio
async def test_purge_reports_post_success(monkeypatch, admin_secret):
    """POST with correct X-Admin-Secret runs purge and returns result (mocked)."""
    from src.api.v1 import admin
    from src.config import settings

    monkeypatch.setattr(settings, "admin_secret", admin_secret)

    mock_result = {
        "report_count": 2,
        "media_count": 2,
        "dry_run": False,
        "local_deleted": 2,
        "local_missing": 0,
        "s3_deleted": 0,
        "remaining_reports": 0,
        "remaining_media": 0,
    }
    with patch.object(admin, "run_purge", new_callable=AsyncMock, return_value=mock_result):
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as c:
            r = await c.post(
                "/api/v1/admin/purge-reports",
                headers={"X-Admin-Secret": admin_secret},
            )
    assert r.status_code == 200
    assert r.json() == mock_result
