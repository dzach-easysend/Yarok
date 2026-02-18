# Local machine setup (Yarok)

Run backend and the Expo app (iOS, Android, Web) on your Mac. Use **simulator/emulator** with `127.0.0.1:8000`, or **physical device** with your Mac’s IP.

All paths are relative to the **project root** `yarok/` (the folder that contains `backend/`, `mobile/`, `docs/`).

**Later on AWS:** Docker locally matches how you’ll deploy (same image to ECS/App Runner, RDS for Postgres).

---

## 1. Install Docker (Mac)

1. Install **Docker Desktop**: https://docs.docker.com/desktop/install/mac-install/
2. Open Docker Desktop and wait until it’s running (whale icon in the menu bar).
3. In a terminal, confirm: `docker --version` and `docker compose version`.

---

## 2. PostgreSQL + PostGIS (Docker)

**Run from:** project root `yarok/`.

Start the database (PostGIS is enabled automatically on first run):

```bash
docker compose up -d yarok-db
```

Wait a few seconds, then check it’s up:

```bash
docker compose ps
```

On **Apple Silicon (M1/M2/M3)** you may see a platform warning (`linux/amd64` vs `arm64`). That’s normal: Docker runs the image via Rosetta. The DB works; you can ignore the warning.

**DATABASE_URL** for the backend (step 3): `postgresql+asyncpg://yarok:yarok@localhost:5432/yarok`

To stop later: `docker compose down`. Data is kept in a volume; next `docker compose up -d yarok-db` reuses it.

---

## 3. Backend (on your Mac)

**Run from:** project root `yarok/`, then backend commands from `yarok/backend/`.

```bash
cd backend

python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

cp .env.example .env
```

Edit `backend/.env`. Set at least:

- **DATABASE_URL:** `postgresql+asyncpg://yarok:yarok@localhost:5432/yarok`

Then:

```bash
alembic upgrade head
uvicorn src.main:app --reload
```

- API: http://127.0.0.1:8000  
- Docs: http://127.0.0.1:8000/docs  

---

## 4. Mobile (Expo)

**Run from:** project root `yarok/`, then `yarok/mobile/`.

```bash
cd mobile
npm install
cp .env.example .env
```

Edit `mobile/.env`: `EXPO_PUBLIC_API_URL=http://127.0.0.1:8000` (or your Mac’s IP for a physical device).

```bash
npx expo start --web                    # Web (localhost:8081)
npx expo run:ios                        # iOS (requires prebuild)
npx expo run:android                    # Android (requires prebuild)
```

**Note:** This app uses `@maplibre/maplibre-react-native` which requires a custom dev client. Expo Go is not supported. For native builds, run `npx expo prebuild --clean` first.

For the **Android emulator**, set up the Android SDK below.

---

## 4.1 Android SDK (for Android emulator)

Expo needs the Android SDK and `adb` to launch the emulator. Easiest on Mac: install **Android Studio**, then point your shell at the SDK.

1. **Install Android Studio**  
   https://developer.android.com/studio  
   Download, install, open it.

2. **Install SDK + emulator**  
   In Android Studio: **More Actions** → **Virtual Device Manager** (or **Tools** → **Device Manager**). Create a device if none exists (e.g. Pixel 6, API 34). That step installs the SDK and system image.

3. **Set ANDROID_HOME**  
   Default SDK location on Mac: `~/Library/Android/sdk`.  
   Add to `~/.zshrc` (or `~/.bash_profile`):

   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   export PATH=$PATH:$ANDROID_HOME/emulator
   ```

   Then run `source ~/.zshrc` (or open a new terminal).

4. **Check**  
   `echo $ANDROID_HOME` should print the path; `adb version` should run.

5. **Run Expo**  
   Start the emulator from Android Studio (Virtual Device Manager → play button) or leave it closed and run `npx expo start`, then press **a** — Expo will try to launch the emulator and install the app.

If the emulator uses a different network (e.g. `10.0.2.2` for host), use `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000` in `mobile/.env` so the app on the emulator can reach your backend on the host.

---

## 5. Quick check

1. Backend: http://127.0.0.1:8000/docs → `GET /health` → `{"status":"ok"}`.
2. App: open map tab; it should call the API (list may be empty).

---

## 5.1 Running tests

**Backend** — from `yarok/backend/` with the venv activated:

```bash
cd backend
source .venv/bin/activate
pytest
```

If `pytest` is not found, the venv is not active; run `source .venv/bin/activate` from the `backend/` directory. If you don’t have a venv, run `python3 -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]"` from `backend/`.

**Mobile** — from `yarok/mobile/`:

```bash
cd mobile
npm test
```

**E2E** — start backend and Expo web first, then from `yarok/mobile/tests/e2e/`:

```bash
pip install -r requirements.txt
pytest
```

---

## 6. Optional: other ways to run Postgres

### Homebrew (Mac, no Docker)

If you see **“/opt/homebrew is not writable”**, fix permissions once (you’ll be asked for your Mac password):

```bash
sudo chown -R $(whoami) /opt/homebrew
chmod u+w /opt/homebrew
```

Then install and start Postgres + PostGIS (run **brew**, not “rew”):

```bash
brew install postgresql@16 postgis
```

After that finishes:

```bash
brew services start postgresql@16
createdb yarok
psql yarok -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

Postgres will use your Mac login user (no password by default). **DATABASE_URL** for backend (step 3): `postgresql+asyncpg://YOUR_MAC_USERNAME@localhost:5432/yarok` (replace with `whoami`).

### Postgres.app (no Homebrew, no sudo)

If you prefer not to fix Homebrew or use sudo, use [Postgres.app](https://postgresapp.com/):

1. Download and open Postgres.app; start the server (drag to Applications if needed).
2. Open the “Initialize” or “Create server” step if shown, then open **psql** from the menu (or install the optional “Command Line Tools” from the app).
3. In a terminal (with `psql` on your PATH):  
   `createuser -s postgres` (if needed), then  
   `createdb yarok`, then  
   `psql yarok -c "CREATE EXTENSION IF NOT EXISTS postgis;"`  
   (Postgres.app 2.x includes PostGIS; if the extension is missing, use Homebrew or Docker for PostGIS.)
4. **DATABASE_URL:** `postgresql+asyncpg://YOUR_MAC_USERNAME@localhost:5432/yarok` (often port **5432**; check the Postgres.app port).

### Single `docker run` (no compose)

If you prefer one-off container instead of compose:

```bash
docker run -d --name yarok-db \
  -e POSTGRES_USER=yarok -e POSTGRES_PASSWORD=yarok -e POSTGRES_DB=yarok \
  -p 5432:5432 postgis/postgis:16-3.4
docker exec -it yarok-db psql -U yarok -d yarok -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

**DATABASE_URL:** `postgresql+asyncpg://yarok:yarok@localhost:5432/yarok`.

---

## 7. Optional: Redis (later)

For background jobs (e.g. push notifications) you’ll need Redis. Local:

```bash
brew install redis && brew services start redis
# REDIS_URL=redis://localhost:6379/0 already in .env
```

No Redis is required for the basic local setup above.
