"""API tests for /api/v1/reports endpoints with mocked database.

NOTE on mock side_effect ordering:
    Several endpoints make multiple sequential db.execute() calls (e.g. fetch
    report, then SELECT media).  The tests use side_effect lists whose order
    mirrors the current query sequence.  If the implementation changes (e.g.
    replacing the N+1 media-count query with a JOIN), the side_effect lists
    here must be updated accordingly.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from tests.conftest import make_execute_result, make_media, make_report, make_report_row

# ---------------------------------------------------------------------------
# POST /api/v1/reports
# ---------------------------------------------------------------------------


class TestCreateReport:
    """Tests for report creation."""

    @pytest.mark.asyncio
    async def test_create_report_success(self, client, mock_db):
        resp = await client.post(
            "/api/v1/reports",
            json={
                "lat": 32.0853,
                "lng": 34.7818,
                "description": "Illegal dump site",
            },
        )

        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "open"
        assert "id" in data
        assert data["description"] == "Illegal dump site"
        mock_db.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_report_minimal(self, client, mock_db):
        """Only lat/lng required; optionals can be omitted."""
        resp = await client.post(
            "/api/v1/reports",
            json={
                "lat": 0.0,
                "lng": 0.0,
            },
        )

        assert resp.status_code == 201
        data = resp.json()
        assert data["description"] is None

    @pytest.mark.asyncio
    async def test_create_report_invalid_lat(self, client, mock_db):
        resp = await client.post(
            "/api/v1/reports",
            json={
                "lat": 100,
                "lng": 34.0,
            },
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_create_report_invalid_lng(self, client, mock_db):
        resp = await client.post(
            "/api/v1/reports",
            json={
                "lat": 32.0,
                "lng": 200,
            },
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_create_report_missing_lat(self, client, mock_db):
        resp = await client.post("/api/v1/reports", json={"lng": 34.0})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_create_report_empty_body(self, client, mock_db):
        resp = await client.post("/api/v1/reports", json={})
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/v1/reports/{report_id}
# ---------------------------------------------------------------------------


class TestGetReport:
    """Tests for fetching a single report."""

    @pytest.mark.asyncio
    async def test_get_report_success(self, client, mock_db):
        report = make_report(description="found it")
        row = make_report_row(report, lat=report.location.y, lng=report.location.x)
        media1 = make_media(report_id=report.id, storage_key="img1.jpg")
        media2 = make_media(report_id=report.id, storage_key="img2.jpg")
        # First execute: fetch report (with labeled lat/lng); second: SELECT media
        mock_db.execute = AsyncMock(
            side_effect=[
                make_execute_result(first_row=row),
                make_execute_result(scalars_all=[media1, media2]),
            ]
        )

        resp = await client.get(f"/api/v1/reports/{report.id}")

        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == report.id
        assert data["description"] == "found it"
        assert data["media_count"] == 2
        assert len(data["media"]) == 2
        assert data["media"][0]["url"] == f"/media/{media1.storage_key}"

    @pytest.mark.asyncio
    async def test_get_report_not_found(self, client, mock_db):
        mock_db.execute = AsyncMock(return_value=make_execute_result(first_row=None))

        resp = await client.get(f"/api/v1/reports/{uuid4()}")

        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_get_report_zero_media(self, client, mock_db):
        report = make_report()
        row = make_report_row(report, lat=report.location.y, lng=report.location.x)
        mock_db.execute = AsyncMock(
            side_effect=[
                make_execute_result(first_row=row),
                make_execute_result(scalars_all=[]),
            ]
        )

        resp = await client.get(f"/api/v1/reports/{report.id}")

        assert resp.status_code == 200
        assert resp.json()["media_count"] == 0
        assert resp.json()["media"] == []

    @pytest.mark.asyncio
    async def test_get_report_returns_invalid_status(self, client, mock_db):
        """GET by ID returns report even when status is invalid (so detail screen works after update)."""
        report = make_report(status="invalid")
        row = make_report_row(report, lat=report.location.y, lng=report.location.x)
        mock_db.execute = AsyncMock(
            side_effect=[
                make_execute_result(first_row=row),
                make_execute_result(scalars_all=[]),
            ]
        )

        resp = await client.get(f"/api/v1/reports/{report.id}")

        assert resp.status_code == 200
        assert resp.json()["status"] == "invalid"


# ---------------------------------------------------------------------------
# PATCH /api/v1/reports/{report_id}
# ---------------------------------------------------------------------------


class TestUpdateReport:
    """Tests for updating report status."""

    @pytest.mark.asyncio
    async def test_update_report_success(self, client, mock_db):
        report = make_report(status="open")
        row = make_report_row(report, lat=report.location.y, lng=report.location.x)
        # Calls: fetch report (with labeled lat/lng), flush/refresh (no execute), then COUNT media
        mock_db.execute = AsyncMock(
            side_effect=[
                make_execute_result(first_row=row),
                make_execute_result(scalar_value=0),
            ]
        )

        resp = await client.patch(
            f"/api/v1/reports/{report.id}",
            json={
                "status": "cleaned",
            },
        )

        assert resp.status_code == 200
        assert resp.json()["status"] == "cleaned"
        # Verify the report object was mutated
        assert report.status == "cleaned"

    @pytest.mark.asyncio
    async def test_update_report_not_found(self, client, mock_db):
        mock_db.execute = AsyncMock(return_value=make_execute_result(first_row=None))

        resp = await client.patch(
            f"/api/v1/reports/{uuid4()}",
            json={
                "status": "cleaned",
            },
        )

        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_update_report_invalid_status(self, client, mock_db):
        """Status must match the pattern ^(open|in_progress|cleaned|invalid)$."""
        resp = await client.patch(
            f"/api/v1/reports/{uuid4()}",
            json={
                "status": "bogus_status",
            },
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_update_report_all_valid_statuses(self, client, mock_db):
        """Each valid status value should be accepted."""
        for new_status in ("open", "in_progress", "cleaned", "invalid"):
            report = make_report(status="open")
            row = make_report_row(report, lat=report.location.y, lng=report.location.x)
            mock_db.execute = AsyncMock(
                side_effect=[
                    make_execute_result(first_row=row),
                    make_execute_result(scalar_value=0),
                ]
            )

            resp = await client.patch(
                f"/api/v1/reports/{report.id}",
                json={
                    "status": new_status,
                },
            )

            assert resp.status_code == 200
            assert resp.json()["status"] == new_status


# ---------------------------------------------------------------------------
# DELETE /api/v1/reports/{report_id}
# ---------------------------------------------------------------------------


class TestDeleteReport:
    """Tests for soft-delete (sets status to 'invalid')."""

    @pytest.mark.asyncio
    async def test_delete_report_success(self, client, mock_db):
        report = make_report(status="open")
        mock_db.execute = AsyncMock(
            return_value=make_execute_result(
                scalar_one_or_none_value=report,
            )
        )

        resp = await client.delete(f"/api/v1/reports/{report.id}")

        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_report_sets_status_invalid(self, client, mock_db):
        """Verify the in-memory object's status is mutated to 'invalid'."""
        report = make_report(status="open")
        mock_db.execute = AsyncMock(
            return_value=make_execute_result(
                scalar_one_or_none_value=report,
            )
        )

        await client.delete(f"/api/v1/reports/{report.id}")

        assert report.status == "invalid"

    @pytest.mark.asyncio
    async def test_delete_report_not_found(self, client, mock_db):
        mock_db.execute = AsyncMock(
            return_value=make_execute_result(
                scalar_one_or_none_value=None,
            )
        )

        resp = await client.delete(f"/api/v1/reports/{uuid4()}")

        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/v1/reports  (list with geo query)
# ---------------------------------------------------------------------------


class TestListReports:
    """Tests for listing reports within a radius.

    NOTE: The list endpoint performs an N+1 pattern -- one SELECT for reports,
    then one COUNT(media) per report.  To keep mocks manageable, tests use
    0 or 1 reports.  If the query count changes (e.g. optimized JOIN), update
    the side_effect lists below.
    """

    @pytest.mark.asyncio
    async def test_list_reports_success_single(self, client, mock_db):
        """One report in radius, with 3 media items."""
        report = make_report(lat=32.0, lng=34.0)
        row = make_report_row(report, lat=32.0, lng=34.0)
        mock_db.execute = AsyncMock(
            side_effect=[
                make_execute_result(all_rows=[row]),  # SELECT reports (rows)
                make_execute_result(scalar_value=3),  # COUNT media for report
            ]
        )

        resp = await client.get(
            "/api/v1/reports",
            params={
                "lat": 32.0,
                "lng": 34.0,
            },
        )

        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["media_count"] == 3

    @pytest.mark.asyncio
    async def test_list_reports_empty(self, client, mock_db):
        mock_db.execute = AsyncMock(return_value=make_execute_result(all_rows=[]))

        resp = await client.get(
            "/api/v1/reports",
            params={
                "lat": 32.0,
                "lng": 34.0,
            },
        )

        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_list_reports_missing_lat(self, client, mock_db):
        resp = await client.get("/api/v1/reports", params={"lng": 34.0})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_list_reports_missing_lng(self, client, mock_db):
        resp = await client.get("/api/v1/reports", params={"lat": 32.0})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_list_reports_with_status_filter(self, client, mock_db):
        """Passing a status filter should still return 200."""
        mock_db.execute = AsyncMock(return_value=make_execute_result(all_rows=[]))

        resp = await client.get(
            "/api/v1/reports",
            params={
                "lat": 32.0,
                "lng": 34.0,
                "status": "cleaned",
            },
        )

        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_list_reports_pagination_params(self, client, mock_db):
        """Custom page/limit should be accepted."""
        mock_db.execute = AsyncMock(return_value=make_execute_result(all_rows=[]))

        resp = await client.get(
            "/api/v1/reports",
            params={
                "lat": 32.0,
                "lng": 34.0,
                "page": 2,
                "limit": 5,
            },
        )

        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_list_reports_invalid_radius(self, client, mock_db):
        resp = await client.get(
            "/api/v1/reports",
            params={
                "lat": 32.0,
                "lng": 34.0,
                "radius_km": 0.01,
            },
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_list_reports_ordered_by_created_at_desc(self, client, mock_db):
        """GET /reports returns results in created_at descending order (newest first)."""
        base = datetime.now(timezone.utc)
        report_old = make_report(
            description="Older",
            lat=32.0,
            lng=34.0,
            created_at=base - timedelta(hours=2),
        )
        report_new = make_report(
            description="Newer",
            lat=32.0,
            lng=34.0,
            created_at=base - timedelta(hours=1),
        )
        row_old = make_report_row(report_old, lat=32.0, lng=34.0)
        row_new = make_report_row(report_new, lat=32.0, lng=34.0)
        # Simulate DB returning rows in ORDER BY created_at DESC order (newest first)
        mock_db.execute = AsyncMock(
            side_effect=[
                make_execute_result(all_rows=[row_new, row_old]),
                make_execute_result(scalar_value=0),
                make_execute_result(scalar_value=0),
            ]
        )

        resp = await client.get(
            "/api/v1/reports",
            params={"lat": 32.0, "lng": 34.0},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["description"] == "Newer"
        assert data[1]["description"] == "Older"
        # created_at should be descending (newest first)
        t0 = datetime.fromisoformat(data[0]["created_at"].replace("Z", "+00:00"))
        t1 = datetime.fromisoformat(data[1]["created_at"].replace("Z", "+00:00"))
        assert t0 >= t1
