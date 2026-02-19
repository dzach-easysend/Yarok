"""Debug endpoints for production troubleshooting (e.g. client log ingestion for Railway)."""

import logging
import sys
from typing import Any, Optional

from fastapi import APIRouter, Request, status
from pydantic import BaseModel, Field

from src.config import settings

router = APIRouter(prefix="/debug", tags=["debug"])
logger = logging.getLogger(__name__)


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
async def client_log(payload: ClientLogPayload, request: Request) -> None:
    """Accept a log entry from the client and write it to server stdout.

    When DEBUG_CLIENT_LOGS=true, the backend logs each payload with a [CLIENT]
    prefix so you can filter in Railway (Deploy Logs). Disabled by default.
    """
    if not settings.debug_client_logs:
        return

    extra = {
        "message": payload.message,
        "level": payload.level,
        "data": payload.data or {},
        "session_id": payload.session_id,
        "ts": payload.timestamp,
        "path": request.url.path,
    }
    log_msg = (
        f"[CLIENT] {payload.level.upper()} {payload.message}"
        + (f" | {payload.data}" if payload.data else "")
    )
    if payload.level == "error":
        logger.error(log_msg, extra=extra)
    elif payload.level == "warn":
        logger.warning(log_msg, extra=extra)
    else:
        logger.info(log_msg, extra=extra)
    # Guarantee line appears in Railway Deploy Logs (stdout is always captured)
    print(log_msg, flush=True, file=sys.stdout)
