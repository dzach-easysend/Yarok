"""Admin endpoints (e.g. purge reports). Protected by X-Admin-Secret when ADMIN_SECRET is set."""

import hmac
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from src.config import settings
from src.services.purge import run_purge

router = APIRouter(prefix="/admin", tags=["admin"])


async def require_admin_secret(
    x_admin_secret: Annotated[Optional[str], Header(alias="X-Admin-Secret")] = None,
) -> None:
    """Dependency: raise if admin endpoints are disabled or the secret does not match."""
    if not settings.admin_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin endpoints are disabled (ADMIN_SECRET not set).",
        )
    if not hmac.compare_digest(x_admin_secret or "", settings.admin_secret or ""):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing X-Admin-Secret header.",
        )


@router.get(
    "/purge-reports",
    status_code=status.HTTP_200_OK,
    summary="Count reports and media (dry run)",
)
async def admin_purge_reports_dry_run(
    _: None = Depends(require_admin_secret),
) -> dict:
    """Return report and media counts (no deletion). Requires X-Admin-Secret header."""
    return await run_purge(dry_run=True)


@router.post(
    "/purge-reports",
    status_code=status.HTTP_200_OK,
    summary="Purge all reports and media",
)
async def admin_purge_reports(
    _: None = Depends(require_admin_secret),
    dry_run: Annotated[
        bool, Query(description="If true, only return counts; do not delete.")
    ] = False,
) -> dict:
    """Delete all reports and their media (DB + local/S3). Requires X-Admin-Secret header."""
    return await run_purge(dry_run=dry_run)
