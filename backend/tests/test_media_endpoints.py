"""API tests for /api/v1/reports/{id}/media endpoints with mocked database."""

import io
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from tests.conftest import auth_headers, make_execute_result, make_media, make_report

# ---------------------------------------------------------------------------
# POST /api/v1/reports/{report_id}/media
# ---------------------------------------------------------------------------


class TestUploadMedia:
    """Tests for media upload."""

    @pytest.mark.asyncio
    async def test_upload_media_success(self, client, mock_db):
        user_id = str(uuid4())
        report = make_report(user_id=user_id)
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
                headers=auth_headers(user_id),
            )

        assert resp.status_code == 201
        data = resp.json()
        assert data["report_id"] == report.id
        assert data["media_type"] == "photo"
        assert data["url"].startswith("/media/")
        assert data["url"].endswith(".png")

    @pytest.mark.asyncio
    async def test_upload_media_requires_auth(self, client, mock_db):
        """Upload without auth token → 401."""
        file_content = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        resp = await client.post(
            f"/api/v1/reports/{uuid4()}/media",
            files={"file": ("test.png", io.BytesIO(file_content), "image/png")},
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_upload_media_forbidden_for_non_owner(self, client, mock_db):
        """Upload by a user who is not the owner → 403."""
        owner_id = str(uuid4())
        other_id = str(uuid4())
        report = make_report(user_id=owner_id)
        mock_db.execute = AsyncMock(
            return_value=make_execute_result(scalar_one_or_none_value=report)
        )

        file_content = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        resp = await client.post(
            f"/api/v1/reports/{report.id}/media",
            files={"file": ("test.png", io.BytesIO(file_content), "image/png")},
            headers=auth_headers(other_id),
        )
        assert resp.status_code == 403

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
            headers=auth_headers(str(uuid4())),
        )

        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_upload_media_unsupported_type(self, client, mock_db):
        user_id = str(uuid4())
        report = make_report(user_id=user_id)
        mock_db.execute = AsyncMock(
            return_value=make_execute_result(
                scalar_one_or_none_value=report,
            )
        )

        resp = await client.post(
            f"/api/v1/reports/{report.id}/media",
            files={"file": ("test.txt", io.BytesIO(b"hello"), "text/plain")},
            headers=auth_headers(user_id),
        )

        assert resp.status_code == 400
        assert "unsupported" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_upload_video_success(self, client, mock_db):
        user_id = str(uuid4())
        report = make_report(user_id=user_id)
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
                headers=auth_headers(user_id),
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


# ---------------------------------------------------------------------------
# DELETE /api/v1/reports/{report_id}/media/{media_id}
# ---------------------------------------------------------------------------


class TestDeleteMedia:
    """Tests for deleting a single media item."""

    @pytest.mark.asyncio
    async def test_delete_media_success(self, client, mock_db):
        user_id = str(uuid4())
        report = make_report(user_id=user_id)
        media1 = make_media(id="m1", report_id=report.id, storage_key="a.jpg")
        make_media(id="m2", report_id=report.id, storage_key="b.jpg")
        # New query order: report → media → count
        mock_db.execute = AsyncMock(
            side_effect=[
                make_execute_result(scalar_one_or_none_value=report),
                make_execute_result(scalar_one_or_none_value=media1),
                make_execute_result(scalar_value=2),
            ]
        )

        with patch("src.api.v1.media.delete_file") as mock_delete:
            resp = await client.delete(
                f"/api/v1/reports/{report.id}/media/m1",
                headers=auth_headers(user_id),
            )

        assert resp.status_code == 204
        mock_delete.assert_called_once_with("a.jpg")

    @pytest.mark.asyncio
    async def test_delete_media_requires_auth(self, client, mock_db):
        """Delete without auth token → 401."""
        resp = await client.delete(f"/api/v1/reports/{uuid4()}/media/{uuid4()}")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_delete_media_forbidden_for_non_owner(self, client, mock_db):
        """Delete by a user who is not the owner → 403."""
        owner_id = str(uuid4())
        other_id = str(uuid4())
        report = make_report(user_id=owner_id)
        mock_db.execute = AsyncMock(
            return_value=make_execute_result(scalar_one_or_none_value=report)
        )

        resp = await client.delete(
            f"/api/v1/reports/{report.id}/media/{uuid4()}",
            headers=auth_headers(other_id),
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_media_not_found(self, client, mock_db):
        # When report itself is not found, still returns 404
        mock_db.execute = AsyncMock(
            return_value=make_execute_result(scalar_one_or_none_value=None),
        )

        resp = await client.delete(
            f"/api/v1/reports/{uuid4()}/media/{uuid4()}",
            headers=auth_headers(str(uuid4())),
        )

        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_media_last_image_returns_400(self, client, mock_db):
        user_id = str(uuid4())
        report = make_report(user_id=user_id)
        media = make_media(id="m1", report_id=report.id, storage_key="only.jpg")
        # New query order: report → media → count
        mock_db.execute = AsyncMock(
            side_effect=[
                make_execute_result(scalar_one_or_none_value=report),
                make_execute_result(scalar_one_or_none_value=media),
                make_execute_result(scalar_value=1),
            ]
        )

        resp = await client.delete(
            f"/api/v1/reports/{report.id}/media/m1",
            headers=auth_headers(user_id),
        )

        assert resp.status_code == 400
        assert "last" in resp.json()["detail"].lower()
