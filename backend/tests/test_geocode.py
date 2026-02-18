"""Tests for geocode proxy endpoint."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from src.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


def _make_resp(status_code: int, json_data):
    resp = MagicMock()
    resp.status_code = status_code
    resp.is_success = status_code == 200
    resp.json.return_value = json_data
    return resp


@pytest.mark.asyncio
async def test_geocode_empty_query():
    """Empty q returns 422 or 400."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        r = await client.get("/api/v1/geocode", params={"q": "   "})
    assert r.status_code in (400, 422)


def _mock_async_client(get_response):
    """Build a mock AsyncClient that yields a client whose get() returns get_response."""
    mock_client = MagicMock()
    mock_client.get = AsyncMock(return_value=get_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    return mock_client


@pytest.mark.asyncio
async def test_geocode_no_results():
    """Nominatim returns empty list -> 404."""
    with patch(
        "src.api.v1.geocode.httpx.AsyncClient",
        return_value=_mock_async_client(_make_resp(200, [])),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            r = await client.get("/api/v1/geocode", params={"q": "NonexistentPlace12345"})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_geocode_success():
    """Nominatim returns one result -> 200 with lat/lng."""
    with patch(
        "src.api.v1.geocode.httpx.AsyncClient",
        return_value=_mock_async_client(_make_resp(200, [{"lat": "32.0853", "lon": "34.7818"}])),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            r = await client.get("/api/v1/geocode", params={"q": "Tel Aviv"})
    assert r.status_code == 200
    data = r.json()
    assert data["lat"] == 32.0853
    assert data["lng"] == 34.7818


@pytest.mark.asyncio
async def test_geocode_rate_limit():
    """Nominatim 429 -> 429 from proxy."""
    with patch(
        "src.api.v1.geocode.httpx.AsyncClient",
        return_value=_mock_async_client(_make_resp(429, None)),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            r = await client.get("/api/v1/geocode", params={"q": "Paris"})
    assert r.status_code == 429
