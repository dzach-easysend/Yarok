# ירוק (Yarok)

Mobile and web app for reporting garbage found while trekking or biking. Reporters submit location + photos/video; consumers see reports on a map and get push notifications.

- **App**: React Native (Expo), TypeScript, Hebrew RTL. Single codebase for iOS, Android, and web. MapLibre GL for maps.
- **Backend**: FastAPI, PostgreSQL + PostGIS, Rye, Ruff. Async APIs, JWT auth, optional sign-up, anonymous device support.

## Repository layout

```
yarok/
  backend/         # FastAPI API + workers
  mobile/          # Expo app (React Native) — iOS, Android, Web
  mockups/         # HTML mockups (Hebrew UI)
  docs/            # Setup and project docs
  docker-compose.yml   # Postgres + PostGIS (yarok-db)
```

**Local setup:** See [docs/SETUP_LOCAL.md](docs/SETUP_LOCAL.md) for step-by-step (Docker for DB, backend, mobile, .env).

## Quick start

### Database (PostgreSQL + PostGIS)

From the **project root**:

```bash
docker compose up -d yarok-db
```

Use `DATABASE_URL=postgresql+asyncpg://yarok:yarok@localhost:5432/yarok` in the backend. PostGIS is enabled automatically. To stop: `docker compose down`.

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate   # or: rye sync
pip install -e ".[dev]"
cp .env.example .env   # set DATABASE_URL (see above), Redis, etc.
alembic upgrade head
uvicorn src.main:app --reload
```

- API: http://localhost:8000  
- Docs: http://localhost:8000/docs  

### App (iOS, Android, Web)

```bash
cd mobile
npm install
cp .env.example .env
```

Set `EXPO_PUBLIC_API_URL=http://127.0.0.1:8000` (simulator/emulator) or your Mac's IP for a physical device. When set, the app uses the backend for map search (geocoding), which avoids CORS on web. Then:

```bash
npx expo start --web              # Web (localhost:8081)
npx expo run:ios                  # iOS (requires prebuild)
npx expo run:android              # Android (requires prebuild)
```

**Note:** This app uses native map libraries that require a custom dev client. Expo Go is not supported for native builds. Run `npx expo prebuild --clean` before the first native build.

### Environment

- **Backend**: See `backend/.env.example` (PostgreSQL, Redis, S3, JWT keys, encryption key).
- **Mobile**: See `mobile/.env.example` (API URL).

## Development

### Backend (use the venv)

From the project root:

```bash
cd backend
source .venv/bin/activate
ruff check . && ruff format .
pytest
```

If you don’t have a venv yet: `python3 -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]"`.

### App

```bash
cd mobile
npm run lint
npm test
```

### Purge all reports

Permanently deletes every report and its associated media files from the database. Run from `backend/` with the venv active:

```bash
python scripts/purge_reports.py            # interactive confirmation
python scripts/purge_reports.py --force    # skip confirmation prompt
python scripts/purge_reports.py --dry-run  # show counts only, no changes
```

The script deletes local media files under `uploads/`, removes S3 objects if S3 is configured, then `TRUNCATE`s the `reports` table (cascading to `media`).

### E2E (backend + Expo web must be running)

```bash
cd mobile/tests/e2e
pip install -r requirements.txt
pytest
```

## Railway Deployment

The project deploys to Railway as three services within one project.

### Services

1. **yarok-db** -- Custom Docker image service using `postgis/postgis:16-3.4` (Railway has no managed PostGIS).
2. **yarok-api** -- FastAPI backend, built from `backend/Dockerfile`. Set the root directory to `backend/`.
3. **yarok-web** -- Expo web static export served by nginx, built from `mobile/Dockerfile`. Set the root directory to `mobile/`.

### Setup

1. Create a new Railway project.
2. Add a **Custom Docker Image** service for the database. Set the image to `postgis/postgis:16-3.4` and configure the environment variables below.
3. Add two **GitHub Repo** services (or "New Service > GitHub Repo") pointing to this repository -- one for `backend/` and one for `mobile/`. Set the root directory for each.
4. Configure environment variables per service (see below).
5. Generate a public domain for `yarok-api` and `yarok-web` in the Railway dashboard (Settings > Networking > Generate Domain).

### Environment Variables

**yarok-db**:

| Variable | Value |
|---|---|
| `POSTGRES_USER` | `yarok` |
| `POSTGRES_PASSWORD` | (generate a strong password) |
| `POSTGRES_DB` | `yarok` |

**yarok-api**:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://${{yarok-db.POSTGRES_USER}}:${{yarok-db.POSTGRES_PASSWORD}}@${{yarok-db.RAILWAY_PRIVATE_DOMAIN}}:5432/${{yarok-db.POSTGRES_DB}}` |
| `JWT_PRIVATE_KEY_PEM` | (generate RSA private key) |
| `JWT_PUBLIC_KEY_PEM` | (matching RSA public key) |
| `ENCRYPTION_KEY` | (generate a Fernet key) |
| `S3_ENDPOINT_URL` | (S3-compatible endpoint, recommended for persistent media) |
| `S3_BUCKET` | `yarok-media` |
| `S3_ACCESS_KEY` | (S3 access key) |
| `S3_SECRET_KEY` | (S3 secret key) |
| `REDIS_URL` | (optional -- add Railway Redis plugin and reference its URL) |

**yarok-web** (build argument):

| Variable | Value |
|---|---|
| `EXPO_PUBLIC_API_URL` | `${{yarok-api.RAILWAY_PUBLIC_DOMAIN}}` (set as a build arg, not runtime var) |

### Notes

- **Migrations** run automatically on each deploy via `start.sh` (`alembic upgrade head`).
- **Media storage**: Railway containers are ephemeral. Configure S3 environment variables for persistent media uploads. Without S3, uploaded files are lost on redeploy.
- **Health check**: The backend exposes `/health` and `railway.toml` configures Railway to use it.
- **PostGIS data**: The database volume persists across redeploys as long as the service is not deleted.

## License

Proprietary.
