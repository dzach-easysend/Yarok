"""FastAPI application entry."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from src.api.v1 import auth, media, reports
from src.api.v1 import geocode as geocode_router
from src.config import settings
from src.middleware.security import limiter, setup_middleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown (e.g. Redis, arq)."""
    yield


app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    lifespan=lifespan,
)

setup_middleware(app)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(media.router, prefix="/api/v1")
app.include_router(geocode_router.router, prefix="/api/v1")

# Mount local media uploads as static files
_upload_dir = Path(settings.media_upload_dir)
if not _upload_dir.is_absolute():
    _upload_dir = Path(__file__).resolve().parents[1] / _upload_dir
_upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(_upload_dir)), name="media")


@app.get("/")
async def root():
    """Redirect to API docs."""
    return RedirectResponse(url="/docs")


@app.get("/health")
async def health():
    """Health check."""
    return {"status": "ok"}
