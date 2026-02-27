"""Reports CRUD and geo-query endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from geoalchemy2 import WKTElement
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.database import get_db
from src.middleware.security import limiter
from src.models.media import Media
from src.models.report import Report
from src.models.user import User
from src.schemas.report import MediaItem, ReportCreate, ReportResponse, ReportUpdate
from src.services.auth import decode_token
from src.storage import media_url

router = APIRouter(prefix="/reports", tags=["reports"])

_ANONYMOUS_DISPLAY = "ירוק"


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------


async def get_optional_user_id(
    authorization: Optional[str] = Header(None),
) -> Optional[str]:
    """Extract user_id (JWT sub) from Bearer token; returns None if absent/invalid."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    payload = decode_token(authorization[7:])
    if not payload:
        return None
    return payload.get("sub")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _extract_coords(row) -> tuple[float, float]:
    """Extract (lat, lng) from a SQLAlchemy row with labeled ST_Y/ST_X columns."""
    return float(row.lat or 0), float(row.lng or 0)


def is_owner(report: Report, current_user_id: Optional[str]) -> bool:
    """Return True if current_user_id matches the report author's user_id."""
    if not current_user_id:
        return False
    return str(report.user_id) == current_user_id


def _report_to_response(
    r: Report,
    *,
    media_count: int = 0,
    media_items: Optional[list[MediaItem]] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    view_count: Optional[int] = None,
    is_mine: bool = False,
    author_display: Optional[str] = None,
) -> ReportResponse:
    """Build API response from a report row.

    When lat/lng are not provided explicitly (via ST_X/ST_Y in the SELECT),
    falls back to geometry .x/.y attributes (used by test mocks).
    """
    if lat is None or lng is None:
        geom = r.location
        if geom is not None and hasattr(geom, "x") and hasattr(geom, "y"):
            lat, lng = float(geom.y), float(geom.x)
        else:
            lat, lng = 0.0, 0.0
    vc = view_count if view_count is not None else getattr(r, "view_count", 0) or 0
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
        view_count=vc,
        is_mine=is_mine,
        author_display=author_display,
    )


async def _load_author_display(user_id: Optional[str], db: AsyncSession) -> Optional[str]:
    """Load display name for a user_id; returns None for anonymous reports."""
    if not user_id:
        return None
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return None
    return user.display_name or _ANONYMOUS_DISPLAY


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(f"{settings.rate_limit_reports_per_hour}/hour")
async def create_report(
    request: Request,
    body: ReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user_id: Optional[str] = Depends(get_optional_user_id),
) -> ReportResponse:
    """Create a new report; sets user_id from JWT if authenticated."""
    point = WKTElement(f"POINT({body.lng} {body.lat})", srid=4326)
    report = Report(
        user_id=current_user_id,
        location=point,
        description=body.description,
        contact_info=body.contact_info,
        status="open",
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)
    return _report_to_response(report, lat=body.lat, lng=body.lng, is_mine=bool(current_user_id))


@router.get("", response_model=list[ReportResponse])
async def list_reports(
    db: AsyncSession = Depends(get_db),
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(10, ge=0.1, le=500),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    mine: bool = Query(False),
    current_user_id: Optional[str] = Depends(get_optional_user_id),
) -> list[ReportResponse]:
    """List reports within radius of (lat, lng) using PostGIS ST_DWithin.

    Pass mine=true to return only the authenticated user's own reports (requires auth).
    """
    if mine and not current_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to filter by ownership",
        )

    radius_deg = radius_km / 111.0  # ~1 degree = 111 km
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
    if mine:
        stmt = stmt.where(Report.user_id == current_user_id)

    result = await db.execute(stmt)
    rows = result.all()

    # Batch-load author display names for all unique user_ids in one query
    user_ids = {row[0].user_id for row in rows if row[0].user_id}
    users_map: dict[str, User] = {}
    if user_ids:
        users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
        users_map = {u.id: u for u in users_result.scalars().all()}

    out = []
    for row in rows:
        r: Report = row[0]
        row_lat, row_lng = _extract_coords(row)
        count_stmt = select(func.count(Media.id)).where(Media.report_id == r.id)
        count_result = await db.execute(count_stmt)
        media_count = count_result.scalar() or 0

        report_is_mine = current_user_id is not None and str(r.user_id) == current_user_id
        if r.user_id:
            user = users_map.get(str(r.user_id))
            author_display = (user.display_name or _ANONYMOUS_DISPLAY) if user else None
        else:
            author_display = None

        out.append(
            _report_to_response(
                r,
                media_count=media_count,
                lat=row_lat,
                lng=row_lng,
                is_mine=report_is_mine,
                author_display=author_display,
            )
        )
    return out


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    current_user_id: Optional[str] = Depends(get_optional_user_id),
) -> ReportResponse:
    """Get a single report by ID, including media URLs. Returns report even if status is invalid."""
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

    media_stmt = select(Media).where(Media.report_id == report.id).order_by(Media.created_at)
    media_result = await db.execute(media_stmt)
    media_rows = media_result.scalars().all()
    media_items = [
        MediaItem(id=m.id, media_type=m.media_type, url=media_url(m.storage_key))
        for m in media_rows
    ]

    # Increment view count on each fetch (MVP; scale with report_views log table if needed)
    report.view_count = (report.view_count or 0) + 1
    await db.flush()

    report_is_mine = is_owner(report, current_user_id)
    author_display = await _load_author_display(report.user_id, db)

    return _report_to_response(
        report,
        media_count=len(media_items),
        media_items=media_items,
        lat=row_lat,
        lng=row_lng,
        view_count=report.view_count,
        is_mine=report_is_mine,
        author_display=author_display,
    )


@router.patch("/{report_id}", response_model=ReportResponse)
async def update_report(
    report_id: str,
    body: ReportUpdate,
    db: AsyncSession = Depends(get_db),
    current_user_id: Optional[str] = Depends(get_optional_user_id),
) -> ReportResponse:
    """Update report fields.

    status is allowed for all users.
    description and contact_info require ownership (403 if not owner).
    """
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

    # Owner-only fields: description and contact_info
    if body.description is not None or body.contact_info is not None:
        if not is_owner(report, current_user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the report owner can edit this field",
            )
        if body.description is not None:
            report.description = body.description
        if body.contact_info is not None:
            report.contact_info = body.contact_info

    if body.status is not None:
        report.status = body.status

    await db.flush()
    await db.refresh(report)
    count_stmt = select(func.count(Media.id)).where(Media.report_id == report.id)
    count_result = await db.execute(count_stmt)
    media_count = count_result.scalar() or 0
    return _report_to_response(
        report,
        media_count=media_count,
        lat=row_lat,
        lng=row_lng,
        is_mine=is_owner(report, current_user_id),
    )


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    current_user_id: Optional[str] = Depends(get_optional_user_id),
) -> None:
    """Soft-delete report (owner only)."""
    if not current_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    if not is_owner(report, current_user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the report owner can delete this report",
        )
    report.status = "invalid"
    await db.flush()
