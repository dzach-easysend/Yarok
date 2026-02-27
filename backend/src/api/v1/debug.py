"""Debug endpoints for production troubleshooting (e.g. client log ingestion for Railway)."""

import logging
import sys
from typing import Any, Optional

from fastapi import APIRouter, Request, status
from pydantic import BaseModel, Field

from src.config import settings
from src.middleware.security import limiter

router = APIRouter(prefix="/debug", tags=["debug"])
logger = logging.getLogger(__name__)

_MAX_MESSAGE_LEN = 200
_MAX_DATA_VALUE_LEN = 500


@router.get(
    "/event",
    status_code=status.HTTP_200_OK,
    summary="Client event beacon (always logged)",
)
@limiter.limit(f"{settings.rate_limit_debug_per_minute}/minute")
async def debug_event(request: Request, e: str = "") -> dict[str, str]:
    """Log a client event so it appears in Railway API logs (HTTP line + [EVENT] line).

    No env flag required. Client calls GET /api/v1/debug/event?e=create_success (etc.)
    to leave a visible trail of user actions (create, status update, screen mount, etc.).
    """
    event_name = (e or "unknown").strip()[:_MAX_MESSAGE_LEN] or "empty"
    log_line = f"[EVENT] {event_name}"
    print(log_line, flush=True, file=sys.stdout)
    logger.info(log_line)
    return {"event": event_name}


class ClientLogPayload(BaseModel):
    """Payload from the mobile/web client for server-side log visibility."""

    level: str = Field(default="info", description="info, warn, error")
    message: str = Field(..., description="Short event description")
    data: Optional[dict[str, Any]] = Field(default=None, description="Structured context")
    session_id: Optional[str] = Field(default=None, alias="sessionId")
    timestamp: Optional[int] = Field(default=None, description="Client timestamp ms")

    model_config = {"populate_by_name": True}


@router.post(
    "/client-log",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Ingest client log (Railway debugging)",
)
@limiter.limit(f"{settings.rate_limit_debug_per_minute}/minute")
async def client_log(payload: ClientLogPayload, request: Request) -> None:
    """Accept a log entry from the client and write it to server stdout.

    When DEBUG_CLIENT_LOGS=true, the backend logs each payload with a [CLIENT]
    prefix so you can filter in Railway (Deploy Logs). Disabled by default.
    """
    if not settings.debug_client_logs:
        return

    # Truncate message and data values to prevent log flooding
    message = payload.message[:_MAX_MESSAGE_LEN]
    safe_data: Optional[dict[str, Any]] = None
    if payload.data:
        safe_data = {
            k: (str(v)[:_MAX_DATA_VALUE_LEN] if isinstance(v, str) else v)
            for k, v in list(payload.data.items())[:20]
        }

    extra = {
        "message": message,
        "level": payload.level,
        "data": safe_data or {},
        "session_id": payload.session_id,
        "ts": payload.timestamp,
        "path": request.url.path,
    }
    log_msg = f"[CLIENT] {payload.level.upper()} {message}" + (
        f" | {safe_data}" if safe_data else ""
    )
    if payload.level == "error":
        logger.error(log_msg, extra=extra)
    elif payload.level == "warn":
        logger.warning(log_msg, extra=extra)
    else:
        logger.info(log_msg, extra=extra)
    # Guarantee line appears in Railway Deploy Logs (stdout is always captured)
    print(log_msg, flush=True, file=sys.stdout)
