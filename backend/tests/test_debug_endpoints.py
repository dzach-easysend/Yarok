"""Debug endpoints (client log ingestion for Railway)."""

import pytest
from httpx import ASGITransport, AsyncClient

from src.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.asyncio
async def test_client_log_returns_204_when_disabled():
    """When DEBUG_CLIENT_LOGS is false, client-log accepts POST and returns 204."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        r = await client.post(
            "/api/v1/debug/client-log",
            json={"message": "test", "level": "info"},
        )
    assert r.status_code == 204
