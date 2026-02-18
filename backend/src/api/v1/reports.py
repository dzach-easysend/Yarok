"""Reports CRUD and geo-query endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from geoalchemy2 import WKTElement
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models.media import Media
from src.models.report import Report
from src.schemas.report import MediaItem, ReportCreate, ReportResponse, ReportUpdate

router = APIRouter(prefix="/reports", tags=["reports"])


def _extract_coords(row) -> tuple[float, float]:
    """Extract (lat, lng) from a SQLAlchemy row with labeled ST_Y/ST_X columns."""
    return float(row.lat or 0), float(row.lng or 0)


def _report_to_response(
    r: Report,
    *,
    media_count: int = 0,
    media_items: list[MediaItem] | None = None,
    lat: float | None = None,
    lng: float | None = None,
) -> ReportResponse:
    """Build API response from a report row.

    Important: GeoAlchemy2 typically returns PostGIS geometries as WKBElement,
    which does NOT expose `.x/.y`. Tests use a mock object that *does*.

    In production, lat/lng should be provided explicitly (via ST_X/ST_Y in the
    SELECT). For test mocks and non-PostGIS cases, we fall back to `.x/.y`.
    """
    if lat is None or lng is None:
        geom = r.location
        if geom is not None and hasattr(geom, "x") and hasattr(geom, "y"):
            lat, lng = float(geom.y), float(geom.x)
        else:
            lat, lng = 0.0, 0.0
    return ReportResponse(
        id=r.id,
        lat=float(lat),
        lng=float(lng),
        address=r.address,
        description=r.description,
        status=r.status,
        created_at=r.created_at.isoformat() if r.created_at else "",
        media_count=media_count,
        media=media_items or [],
    )


@router.post("", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    body: ReportCreate,
    db: AsyncSession = Depends(get_db),
    user_id: str | None = None,
    device_id: str | None = None,
) -> ReportResponse:
    """Create a new report (user_id or device_id from JWT in real impl)."""
    point = WKTElement(f"POINT({body.lng} {body.lat})", srid=4326)
    report = Report(
        user_id=user_id,
        device_id=device_id,
        location=point,
        description=body.description,
        contact_info=body.contact_info,
        status="open",
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)
    # Return the coordinates we just received (avoid geometry extraction issues).
    return _report_to_response(report, lat=body.lat, lng=body.lng)


@router.get("", response_model=list[ReportResponse])
async def list_reports(
    db: AsyncSession = Depends(get_db),
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(10, ge=0.1, le=500),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
) -> list[ReportResponse]:
    """List reports within radius of (lat, lng) using PostGIS ST_DWithin."""
    # Approximate: 1 degree ~ 111 km; ST_DWithin in degree units
    radius_deg = radius_km / 111.0
    point_wkt = WKTElement(f"POINT({lng} {lat})", srid=4326)
    stmt = (
        select(
            Report,
            func.ST_Y(Report.location).label("lat"),
            func.ST_X(Report.location).label("lng"),
        )
        .where(
            func.ST_DWithin(
                Report.location,
                point_wkt,
                radius_deg,
            )
        )
        .where(Report.status != "invalid")
        .order_by(Report.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    if status_filter:
        stmt = stmt.where(Report.status == status_filter)
    result = await db.execute(stmt)
    out = []
    for row in result.all():
        r: Report = row[0]
        row_lat, row_lng = _extract_coords(row)
        count_stmt = select(func.count(Media.id)).where(Media.report_id == r.id)
        count_result = await db.execute(count_stmt)
        media_count = count_result.scalar() or 0
        out.append(_report_to_response(r, media_count=media_count, lat=row_lat, lng=row_lng))
    return out


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
) -> ReportResponse:
    """Get a single report by ID, including media URLs. Returns report even if status is invalid."""
    stmt = (
        select(
            Report,
            func.ST_Y(Report.location).label("lat"),
            func.ST_X(Report.location).label("lng"),
        )
        .where(Report.id == report_id)
    )
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    report: Report = row[0]
    row_lat, row_lng = _extract_coords(row)

    # Fetch media items for this report
    media_stmt = select(Media).where(Media.report_id == report.id).order_by(Media.created_at)
    media_result = await db.execute(media_stmt)
    media_rows = media_result.scalars().all()
    media_items = [
        MediaItem(id=m.id, media_type=m.media_type, url=f"/media/{m.storage_key}")
        for m in media_rows
    ]

    return _report_to_response(
        report,
        media_count=len(media_items),
        media_items=media_items,
        lat=row_lat,
        lng=row_lng,
    )


@router.patch("/{report_id}", response_model=ReportResponse)
async def update_report(
    report_id: str,
    body: ReportUpdate,
    db: AsyncSession = Depends(get_db),
) -> ReportResponse:
    """Update report status (auth required in production)."""
    stmt = select(
        Report,
        func.ST_Y(Report.location).label("lat"),
        func.ST_X(Report.location).label("lng"),
    ).where(Report.id == report_id)
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    report: Report = row[0]
    row_lat, row_lng = _extract_coords(row)
    report.status = body.status
    await db.flush()
    await db.refresh(report)
    count_stmt = select(func.count(Media.id)).where(Media.report_id == report.id)
    count_result = await db.execute(count_stmt)
    media_count = count_result.scalar() or 0
    return _report_to_response(report, media_count=media_count, lat=row_lat, lng=row_lng)


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft-delete report (auth required in production)."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    report.status = "invalid"
    await db.flush()
