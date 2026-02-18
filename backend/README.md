# Yarok Backend

FastAPI + PostgreSQL (PostGIS) + Redis (arq). Rye for deps, Ruff for lint.

## Setup

```bash
# From repo root
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
# Edit .env: DATABASE_URL, REDIS_URL, etc.
```

## Database

PostgreSQL with PostGIS extension:

```bash
# Create DB and enable PostGIS (e.g. locally)
createdb yarok
psql yarok -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# Run migrations (with venv active)
alembic upgrade head
```

## Run

```bash
# With venv active
uvicorn src.main:app --reload
```

- API: http://localhost:8000
- Docs: http://localhost:8000/docs

## API

- **Health:** `GET /health`
- **Geocode (proxy):** `GET /api/v1/geocode?q=<address>` — proxies to OpenStreetMap Nominatim; returns `{ "lat", "lng" }` or 404. Used by the app for map search (avoids CORS on web).

## Tests

Run with the venv active (so `pytest` is on your PATH):

```bash
cd backend
source .venv/bin/activate
pytest
```

Optional: `pytest -v` for verbose, `pytest tests/test_geocode.py` for one file.

## Lint

```bash
# With venv active
ruff check . && ruff format .
```
