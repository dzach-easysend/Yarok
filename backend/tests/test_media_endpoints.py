"""API tests for /api/v1/reports/{id}/media endpoints with mocked database."""

import io
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from tests.conftest import make_execute_result, make_media, make_report

# ---------------------------------------------------------------------------
# POST /api/v1/reports/{report_id}/media
# ---------------------------------------------------------------------------


class TestUploadMedia:
    """Tests for media upload."""

    @pytest.mark.asyncio
    async def test_upload_media_success(self, client, mock_db):
        report = make_report()
        mock_db.execute = AsyncMock(
            return_value=make_execute_result(
                scalar_one_or_none_value=report,
            )
        )

        file_content = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        with patch("src.api.v1.media._get_upload_dir") as mock_dir:
            import tempfile
            from pathlib import Path

            tmpdir = Path(tempfile.mkdtemp())
            mock_dir.return_value = tmpdir

            resp = await client.post(
                f"/api/v1/reports/{report.id}/media",
                files={"file": ("test.png", io.BytesIO(file_content), "image/png")},
            )

        assert resp.status_code == 201
        data = resp.json()
        assert data["report_id"] == report.id
        assert data["media_type"] == "photo"
        assert data["url"].startswith("/media/")
        assert data["url"].endswith(".png")

    @pytest.mark.asyncio
    async def test_upload_media_report_not_found(self, client, mock_db):
        mock_db.execute = AsyncMock(
            return_value=make_execute_result(
                scalar_one_or_none_value=None,
            )
        )

        file_content = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        resp = await client.post(
            f"/api/v1/reports/{uuid4()}/media",
            files={"file": ("test.png", io.BytesIO(file_content), "image/png")},
        )

        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_upload_media_unsupported_type(self, client, mock_db):
        report = make_report()
        mock_db.execute = AsyncMock(
            return_value=make_execute_result(
                scalar_one_or_none_value=report,
            )
        )

        resp = await client.post(
            f"/api/v1/reports/{report.id}/media",
            files={"file": ("test.txt", io.BytesIO(b"hello"), "text/plain")},
        )

        assert resp.status_code == 400
        assert "unsupported" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_upload_video_success(self, client, mock_db):
        report = make_report()
        mock_db.execute = AsyncMock(
            return_value=make_execute_result(
                scalar_one_or_none_value=report,
            )
        )

        file_content = b"\x00\x00\x00\x1c" + b"\x00" * 100
        with patch("src.api.v1.media._get_upload_dir") as mock_dir:
            import tempfile
            from pathlib import Path

            tmpdir = Path(tempfile.mkdtemp())
            mock_dir.return_value = tmpdir

            resp = await client.post(
                f"/api/v1/reports/{report.id}/media",
                files={"file": ("clip.mp4", io.BytesIO(file_content), "video/mp4")},
            )

        assert resp.status_code == 201
        assert resp.json()["media_type"] == "video"


# ---------------------------------------------------------------------------
# GET /api/v1/reports/{report_id}/media
# ---------------------------------------------------------------------------


class TestListMedia:
    """Tests for listing media items."""

    @pytest.mark.asyncio
    async def test_list_media_success(self, client, mock_db):
        report = make_report()
        media1 = make_media(report_id=report.id, storage_key="a.jpg")
        media2 = make_media(report_id=report.id, storage_key="b.png")

        # First execute: check report exists; second: select media
        mock_db.execute = AsyncMock(
            side_effect=[
                make_execute_result(scalar_one_or_none_value=report),
                make_execute_result(scalars_all=[media1, media2]),
            ]
        )

        resp = await client.get(f"/api/v1/reports/{report.id}/media")

        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["url"] == "/media/a.jpg"
        assert data[1]["url"] == "/media/b.png"

    @pytest.mark.asyncio
    async def test_list_media_empty(self, client, mock_db):
        report = make_report()
        mock_db.execute = AsyncMock(
            side_effect=[
                make_execute_result(scalar_one_or_none_value=report),
                make_execute_result(scalars_all=[]),
            ]
        )

        resp = await client.get(f"/api/v1/reports/{report.id}/media")

        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_list_media_report_not_found(self, client, mock_db):
        mock_db.execute = AsyncMock(
            return_value=make_execute_result(
                scalar_one_or_none_value=None,
            )
        )

        resp = await client.get(f"/api/v1/reports/{uuid4()}/media")

        assert resp.status_code == 404
