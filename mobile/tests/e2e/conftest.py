"""Shared fixtures for Yarok E2E tests (Expo web).

Provides:
- Environment-driven config (WEB_URL, API_URL)
- Server health checks (skip suite if servers are down)
- Geolocation mock (Jerusalem) and localStorage cleanup
- API seed fixtures for atomic test data (register user, create/delete reports)
- Session-scoped cleanup of all E2E-created reports

NOTE: These tests target the Expo web dev server (default localhost:8081),
adapted from the original vanilla web app tests.
"""

import logging
import os
from uuid import uuid4

import httpx
import pytest

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Environment-driven configuration
# ---------------------------------------------------------------------------

WEB_URL = os.getenv("WEB_URL", "http://localhost:8081")
API_URL = os.getenv("API_URL", "http://localhost:8000")

JERUSALEM = {"latitude": 31.7683, "longitude": 35.2137}


# ---------------------------------------------------------------------------
# Server availability check (session-scoped, runs once)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session", autouse=True)
def check_servers():
    """Skip the entire suite if the backend or web server is unreachable."""
    try:
        r = httpx.get(f"{API_URL}/health", timeout=5)
        r.raise_for_status()
    except Exception:
        pytest.skip(
            f"Backend not reachable at {API_URL}. "
            "Start it with: cd backend && uvicorn src.main:app --port 8000"
        )

    try:
        r = httpx.get(WEB_URL, timeout=5)
        r.raise_for_status()
    except Exception:
        pytest.skip(
            f"Expo web server not reachable at {WEB_URL}. "
            "Start it with: cd mobile && npx expo start --web"
        )


# ---------------------------------------------------------------------------
# Session-scoped report cleanup (runs once after all tests)
# ---------------------------------------------------------------------------

E2E_DESCRIPTION_PREFIX = "E2E"


@pytest.fixture(scope="session", autouse=True)
def cleanup_e2e_reports():
    """Delete all reports created during the E2E session.

    Runs after every test has finished.  Queries the API for reports whose
    description starts with the E2E prefix and soft-deletes each one.
    This catches reports created both via ``api_create_report`` (belt-and-
    suspenders) and those created through the UI (which have no per-test
    teardown).
    """
    yield  # ---- run all tests first ----

    try:
        resp = httpx.get(
            f"{API_URL}/api/v1/reports",
            params={
                "lat": JERUSALEM["latitude"],
                "lng": JERUSALEM["longitude"],
                "radius_km": 500,
                "limit": 500,
            },
            timeout=10,
        )
        resp.raise_for_status()
        reports = resp.json()
    except Exception as exc:
        logger.warning("E2E cleanup: failed to fetch reports: %s", exc)
        return

    deleted = 0
    for report in reports:
        desc = report.get("description") or ""
        if desc.startswith(E2E_DESCRIPTION_PREFIX):
            try:
                httpx.delete(
                    f"{API_URL}/api/v1/reports/{report['id']}",
                    timeout=5,
                )
                deleted += 1
            except Exception as exc:
                logger.warning(
                    "E2E cleanup: failed to delete report %s: %s",
                    report["id"],
                    exc,
                )

    if deleted:
        logger.info("E2E cleanup: soft-deleted %d test report(s)", deleted)


# ---------------------------------------------------------------------------
# Playwright overrides
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    """Override default browser context: geolocation, permissions, locale."""
    return {
        **browser_context_args,
        "geolocation": JERUSALEM,
        "permissions": ["geolocation"],
        "locale": "he-IL",
    }


@pytest.fixture()
def page(page):
    """Override the default page fixture: clear localStorage before each test."""
    page.goto(WEB_URL)
    page.evaluate("localStorage.clear()")
    page.goto(WEB_URL)
    page.wait_for_load_state("networkidle")
    return page


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def base_url():
    return WEB_URL


@pytest.fixture(scope="session")
def api_url():
    return API_URL


@pytest.fixture()
def unique_email():
    """Factory returning a unique email per call."""
    def _make():
        return f"e2e_{uuid4().hex[:8]}@yarok-e2e.com"
    return _make


# ---------------------------------------------------------------------------
# API seed fixtures -- bypass the UI to create test data directly
# ---------------------------------------------------------------------------

@pytest.fixture()
def api_register_user():
    """Register a user via the backend API. Returns (email, password, tokens)."""
    created = []

    def _register(email=None, password="TestPass123"):
        email = email or f"e2e_{uuid4().hex[:8]}@yarok-e2e.com"
        resp = httpx.post(
            f"{API_URL}/api/v1/auth/register",
            json={"email": email, "password": password},
            timeout=10,
        )
        resp.raise_for_status()
        tokens = resp.json()
        created.append((email, tokens))
        return email, password, tokens

    yield _register


@pytest.fixture()
def api_create_report():
    """Create a report via the backend API. Returns the report dict (including id).

    Cleans up by soft-deleting (setting status to 'invalid') after the test.
    """
    created_ids = []

    def _create(description=None):
        desc = description or f"E2E seeded {uuid4().hex[:8]}"
        resp = httpx.post(
            f"{API_URL}/api/v1/reports",
            json={
                "lat": JERUSALEM["latitude"],
                "lng": JERUSALEM["longitude"],
                "description": desc,
            },
            timeout=10,
        )
        resp.raise_for_status()
        report = resp.json()
        created_ids.append(report["id"])
        return report

    yield _create

    # Teardown: soft-delete seeded reports
    for rid in created_ids:
        try:
            httpx.delete(f"{API_URL}/api/v1/reports/{rid}", timeout=5)
        except Exception:
            pass


@pytest.fixture()
def api_get_reports():
    """Fetch reports from the backend API."""
    def _get(**params):
        defaults = {
            "lat": JERUSALEM["latitude"],
            "lng": JERUSALEM["longitude"],
            "radius_km": 100,
            "limit": 100,
        }
        defaults.update(params)
        resp = httpx.get(
            f"{API_URL}/api/v1/reports",
            params=defaults,
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
    return _get


@pytest.fixture()
def api_get_report():
    """Fetch a single report from the backend API."""
    def _get(report_id):
        resp = httpx.get(
            f"{API_URL}/api/v1/reports/{report_id}",
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
    return _get
