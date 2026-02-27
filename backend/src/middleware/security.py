"""CORS, rate limiting, and security headers."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from src.config import settings

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.rate_limit_reads_per_minute}/minute"],
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add common security headers to every response."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


def setup_middleware(app: FastAPI) -> None:
    """Add CORS, security headers, and any global middleware."""
    app.add_middleware(SecurityHeadersMiddleware)
    # allow_credentials must be False when allow_origins contains "*".
    # Bearer token auth (Authorization header) does not require credentials=True.
    use_wildcard = settings.cors_origins == ["*"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=not use_wildcard,
        allow_methods=["*"],
        allow_headers=["*"],
    )
