"""Unit tests for Pydantic request/response schemas."""

import pytest
from pydantic import ValidationError

from src.schemas.report import ReportCreate, ReportListQuery, ReportResponse, ReportUpdate
from src.schemas.user import DeviceRegister, RefreshRequest, TokenPair, UserLogin, UserRegister

# ---------------------------------------------------------------------------
# ReportCreate
# ---------------------------------------------------------------------------


class TestReportCreate:
    def test_valid_minimal(self):
        r = ReportCreate(lat=32.0, lng=34.0)
        assert r.lat == 32.0
        assert r.lng == 34.0
        assert r.description is None
        assert r.contact_info is None

    def test_valid_with_optionals(self):
        r = ReportCreate(lat=0, lng=0, description="pile of trash", contact_info="me@test.com")
        assert r.description == "pile of trash"

    def test_lat_too_high(self):
        with pytest.raises(ValidationError):
            ReportCreate(lat=91, lng=0)

    def test_lat_too_low(self):
        with pytest.raises(ValidationError):
            ReportCreate(lat=-91, lng=0)

    def test_lng_too_high(self):
        with pytest.raises(ValidationError):
            ReportCreate(lat=0, lng=181)

    def test_lng_too_low(self):
        with pytest.raises(ValidationError):
            ReportCreate(lat=0, lng=-181)

    def test_boundary_values_accepted(self):
        """Exact boundary values (-90, 90, -180, 180) should be valid."""
        r = ReportCreate(lat=90, lng=180)
        assert r.lat == 90
        r2 = ReportCreate(lat=-90, lng=-180)
        assert r2.lat == -90

    def test_missing_lat_rejected(self):
        with pytest.raises(ValidationError):
            ReportCreate(lng=34.0)

    def test_missing_lng_rejected(self):
        with pytest.raises(ValidationError):
            ReportCreate(lat=32.0)


# ---------------------------------------------------------------------------
# ReportUpdate
# ---------------------------------------------------------------------------


class TestReportUpdate:
    @pytest.mark.parametrize("valid_status", ["open", "in_progress", "cleaned", "invalid"])
    def test_valid_statuses(self, valid_status):
        r = ReportUpdate(status=valid_status)
        assert r.status == valid_status

    def test_invalid_status_rejected(self):
        with pytest.raises(ValidationError):
            ReportUpdate(status="pending")

    def test_empty_status_rejected(self):
        with pytest.raises(ValidationError):
            ReportUpdate(status="")

    def test_missing_status_rejected(self):
        with pytest.raises(ValidationError):
            ReportUpdate()


# ---------------------------------------------------------------------------
# ReportResponse
# ---------------------------------------------------------------------------


class TestReportResponse:
    def test_from_dict(self):
        r = ReportResponse(
            id="abc",
            lat=32.0,
            lng=34.0,
            address=None,
            description="test",
            status="open",
            created_at="2025-01-01T00:00:00Z",
            media_count=0,
        )
        assert r.id == "abc"
        assert r.media_count == 0

    def test_media_count_default(self):
        r = ReportResponse(
            id="x",
            lat=0,
            lng=0,
            address=None,
            description=None,
            status="open",
            created_at="",
        )
        assert r.media_count == 0


# ---------------------------------------------------------------------------
# ReportListQuery
# ---------------------------------------------------------------------------


class TestReportListQuery:
    def test_defaults(self):
        q = ReportListQuery(lat=32.0, lng=34.0)
        assert q.radius_km == 10
        assert q.page == 1
        assert q.limit == 20
        assert q.status is None

    def test_radius_too_low(self):
        with pytest.raises(ValidationError):
            ReportListQuery(lat=0, lng=0, radius_km=0.01)

    def test_radius_too_high(self):
        with pytest.raises(ValidationError):
            ReportListQuery(lat=0, lng=0, radius_km=501)

    def test_limit_too_high(self):
        with pytest.raises(ValidationError):
            ReportListQuery(lat=0, lng=0, limit=101)

    def test_page_zero_rejected(self):
        with pytest.raises(ValidationError):
            ReportListQuery(lat=0, lng=0, page=0)


# ---------------------------------------------------------------------------
# UserRegister
# ---------------------------------------------------------------------------


class TestUserRegister:
    def test_valid(self):
        u = UserRegister(email="a@b.com", password="pass123")
        assert u.email == "a@b.com"
        assert u.display_name is None

    def test_with_display_name(self):
        u = UserRegister(email="a@b.com", password="pass123", display_name="Alice")
        assert u.display_name == "Alice"

    def test_invalid_email_rejected(self):
        with pytest.raises(ValidationError):
            UserRegister(email="not-an-email", password="pass123")

    def test_missing_password_rejected(self):
        with pytest.raises(ValidationError):
            UserRegister(email="a@b.com")

    def test_missing_email_rejected(self):
        with pytest.raises(ValidationError):
            UserRegister(password="pass")


# ---------------------------------------------------------------------------
# UserLogin
# ---------------------------------------------------------------------------


class TestUserLogin:
    def test_valid(self):
        u = UserLogin(email="a@b.com", password="pass")
        assert u.email == "a@b.com"

    def test_invalid_email_rejected(self):
        with pytest.raises(ValidationError):
            UserLogin(email="bad", password="pass")


# ---------------------------------------------------------------------------
# DeviceRegister
# ---------------------------------------------------------------------------


class TestDeviceRegister:
    def test_valid_minimal(self):
        d = DeviceRegister(device_id="device-abc")
        assert d.push_token is None

    def test_with_push_token(self):
        d = DeviceRegister(device_id="d-1", push_token="ExponentPushToken[xxx]")
        assert d.push_token == "ExponentPushToken[xxx]"

    def test_missing_device_id_rejected(self):
        with pytest.raises(ValidationError):
            DeviceRegister()


# ---------------------------------------------------------------------------
# RefreshRequest
# ---------------------------------------------------------------------------


class TestRefreshRequest:
    def test_valid(self):
        r = RefreshRequest(refresh_token="tok")
        assert r.refresh_token == "tok"

    def test_missing_token_rejected(self):
        with pytest.raises(ValidationError):
            RefreshRequest()


# ---------------------------------------------------------------------------
# TokenPair
# ---------------------------------------------------------------------------


class TestTokenPair:
    def test_default_token_type(self):
        t = TokenPair(access_token="a", refresh_token="r")
        assert t.token_type == "bearer"

    def test_explicit_token_type(self):
        t = TokenPair(access_token="a", refresh_token="r", token_type="mac")
        assert t.token_type == "mac"
