"""Shared test fixtures for the Yarok backend test suite.

Provides:
- Environment isolation (mock_env) to prevent .env leakage
- Mock async DB session with FastAPI dependency override
- httpx AsyncClient bound to the ASGI app
- Factory helpers for User and Report mock objects
"""

from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Optional
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import bcrypt as _bcrypt_mod
import pytest
from httpx import ASGITransport, AsyncClient

# ---------------------------------------------------------------------------
# Workaround: passlib + bcrypt >= 4.1 incompatibility
# passlib's internal backend validation tests a 255-byte password, which
# bcrypt >= 4.1 rejects with ValueError.  We patch bcrypt.hashpw/checkpw
# to silently truncate at 72 bytes, matching the old behavior.
# See: https://github.com/pyca/bcrypt/issues/684
# ---------------------------------------------------------------------------

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
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Environment isolation -- runs before every test automatically
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def mock_env(monkeypatch):
    """Force deterministic env vars so tests never read the local .env."""
    monkeypatch.setenv("APP_NAME", "yarok-test")
    monkeypatch.setenv("DEBUG", "false")
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test_yarok")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/15")
    monkeypatch.setenv("JWT_PRIVATE_KEY_PEM", "")
    monkeypatch.setenv("JWT_PUBLIC_KEY_PEM", "")
    monkeypatch.setenv("JWT_ACCESS_EXP_MINUTES", "15")
    monkeypatch.setenv("JWT_REFRESH_EXP_DAYS", "30")
    monkeypatch.setenv("ENCRYPTION_KEY", "")
    monkeypatch.setenv("S3_ACCESS_KEY", "")
    monkeypatch.setenv("S3_SECRET_KEY", "")


# ---------------------------------------------------------------------------
# Mock async database session
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_db():
    """Return an AsyncMock that behaves like an AsyncSession.

    Callers configure `.execute.return_value` or `.execute.side_effect`
    per-test to control what the 'database' returns.
    """
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.close = AsyncMock()

    # Default refresh: populate .id if missing
    async def _refresh(obj):
        if not getattr(obj, "id", None):
            obj.id = str(uuid4())

    session.refresh = AsyncMock(side_effect=_refresh)
    return session


# ---------------------------------------------------------------------------
# httpx AsyncClient with get_db overridden
# ---------------------------------------------------------------------------


@pytest.fixture
async def client(mock_db):
    """Yield an httpx AsyncClient whose DB dependency is the mock_db."""
    from src.database import get_db
    from src.main import app

    async def _override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = _override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Factory helpers
# ---------------------------------------------------------------------------


def make_user(
    *,
    id: Optional[str] = None,
    email: str = "user@example.com",
    password_hash: Optional[str] = "hashed",
    display_name: Optional[str] = "Test User",
    device_token: Optional[str] = None,
    push_token: Optional[str] = None,
    is_active: bool = True,
):
    """Return a SimpleNamespace that quacks like a User ORM object."""
    return SimpleNamespace(
        id=id or str(uuid4()),
        email=email,
        password_hash=password_hash,
        display_name=display_name,
        device_token=device_token,
        push_token=push_token,
        is_active=is_active,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


def make_report(
    *,
    id: Optional[str] = None,
    user_id: Optional[str] = None,
    device_id: Optional[str] = None,
    lat: float = 32.0853,
    lng: float = 34.7818,
    address: Optional[str] = None,
    description: Optional[str] = "Test report",
    contact_info: Optional[str] = None,
    status: str = "open",
    created_at: Optional[datetime] = None,
    view_count: int = 0,
):
    """Return a SimpleNamespace that quacks like a Report ORM object.

    The `location` attribute exposes `.x` (lng) and `.y` (lat) so that
    `_report_to_response` can extract coordinates without PostGIS.
    """
    location = SimpleNamespace(x=lng, y=lat)
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=id or str(uuid4()),
        user_id=user_id,
        device_id=device_id,
        location=location,
        address=address,
        description=description,
        contact_info=contact_info,
        status=status,
        created_at=created_at if created_at is not None else now,
        updated_at=now,
        view_count=view_count,
    )


def make_media(
    *,
    id: Optional[str] = None,
    report_id: Optional[str] = None,
    media_type: str = "photo",
    storage_key: str = "test_image.jpg",
    thumbnail_key: Optional[str] = None,
    file_size_bytes: int = 12345,
):
    """Return a SimpleNamespace that quacks like a Media ORM object."""
    return SimpleNamespace(
        id=id or str(uuid4()),
        report_id=report_id or str(uuid4()),
        media_type=media_type,
        storage_key=storage_key,
        thumbnail_key=thumbnail_key,
        file_size_bytes=file_size_bytes,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


class _RowLike:
    """Minimal Row-like object for mocked SQLAlchemy results.

    The API implementation accesses rows as `row[0]` (the ORM object) and also
    via labeled attributes (e.g. `row.lat`, `row.lng`).
    """

    def __init__(self, *values, **labels):
        self._values = tuple(values)
        for k, v in labels.items():
            setattr(self, k, v)

    def __getitem__(self, idx: int):
        return self._values[idx]


def make_report_row(report, *, lat: float, lng: float) -> _RowLike:
    """Return a Row-like tuple: (Report, lat, lng) with .lat/.lng labels."""
    return _RowLike(report, lat, lng, lat=lat, lng=lng)


def make_execute_result(
    scalar_one_or_none_value=None,
    scalar_value=None,
    scalars_all=None,
    *,
    all_rows=None,
    first_row=None,
):
    """Build a mock result for ``session.execute()``.

    Supports three common patterns used by the endpoints:
    - ``result.scalar_one_or_none()``  (single object lookup)
    - ``result.scalar()``              (aggregate: COUNT)
    - ``result.scalars().all()``       (list of objects)
    - ``result.all()``                 (list of Row-like objects)
    - ``result.first()``               (single Row-like object)
    """
    result = MagicMock()
    result.scalar_one_or_none.return_value = scalar_one_or_none_value
    result.scalar.return_value = scalar_value
    result.all.return_value = all_rows if all_rows is not None else []
    result.first.return_value = first_row

    if scalars_all is not None:
        scalars_mock = MagicMock()
        scalars_mock.all.return_value = scalars_all
        result.scalars.return_value = scalars_mock

    return result
