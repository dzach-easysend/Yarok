# Yarok — Claude Code Instructions

## Project Overview
ירוק (Yarok) is a mobile and web app for reporting garbage found while trekking or biking. Reporters submit location + photos/video; consumers see reports on a map and get push notifications.

## Tech Stack
- **App**: React Native (Expo), TypeScript, Hebrew RTL. Single codebase for iOS, Android, and web. MapLibre GL for maps (native + web).
- **Backend**: FastAPI, PostgreSQL + PostGIS, Rye, Ruff. Async APIs, JWT auth, optional sign-up, anonymous device support.
- **Database**: PostgreSQL + PostGIS (Docker via `docker-compose.yml`)
- **Tooling**: Alembic (migrations), Ruff (linting/formatting), pytest, Playwright (E2E tests)

## Project Layout & Conventions
- Two top-level apps: `backend/`, `mobile/` — each self-contained with its own deps and env files.
- **Backend** entrypoint: `backend/src/main.py`. Migrations via Alembic. Lint/format with Ruff.
- **Mobile** is an Expo (React Native) app targeting iOS, Android, and web. TypeScript. Hebrew RTL.
  - Maps use platform-specific components: `components/map/MapView.tsx` (native via @maplibre/maplibre-react-native) and `components/map/MapView.web.tsx` (web via react-map-gl + maplibre-gl).
  - Native dev requires custom dev client (`npx expo prebuild`). Web dev uses `npx expo start --web`.
- **Database**: PostgreSQL + PostGIS, managed via `docker-compose.yml` at project root.
- **Docs & mockups**: `docs/` (setup guides), `mockups/` (Hebrew UI mockups).
- Env templates: `backend/.env.example`, `mobile/.env.example`. Never commit `.env` files.

## Commands

### Database
```bash
docker compose up -d yarok-db          # Start PostgreSQL + PostGIS
docker compose down                     # Stop database
```

### Backend
```bash
cd backend
source .venv/bin/activate               # Activate venv (or: rye sync)
alembic upgrade head                    # Run migrations
uvicorn src.main:app --reload           # Start dev server (localhost:8000)
rye run ruff check . && rye run ruff format .   # Lint & format
rye run pytest                          # Run backend tests
```

### Mobile (iOS, Android, Web)
```bash
cd mobile
npm install
npx expo start                          # Start Expo dev server (native)
npx expo start --web                    # Start Expo web (localhost:8081)
npx expo run:ios                        # Build & run on iOS (requires prebuild)
npx expo run:android                    # Build & run on Android (requires prebuild)
npm run lint                            # Lint
npm test                                # Run unit tests
```

### E2E Tests (Playwright)
```bash
cd mobile/tests/e2e
pip install -r requirements.txt
pytest                                  # Requires backend + Expo web server running
```

---

## Critical Rules

### 1. Test Suite Must Stay Current
- Every code change MUST include corresponding test updates
- New tools or endpoints require new tests in the same commit
- Modified behavior requires updated tests — never leave stale tests behind
- Never skip or disable tests to work around failures
- Backend tests: `cd backend && rye run pytest`
- Mobile tests: `cd mobile && npm test`
- E2E tests: `cd mobile/tests/e2e && pytest` (requires backend + Expo web running)

### 2. README.md Must Stay Current
- Any change to tools, configuration, setup steps, or project structure MUST be reflected in README.md
- If you add, remove, rename, or change API endpoints, update the docs
- Keep the Project Structure tree accurate
- Keep usage examples and configuration instructions working

### 3. Pre-Commit Verification
- Before every commit, run all relevant test suites:
  - Backend: `cd backend && rye run ruff check . && rye run ruff format . && rye run pytest`
  - Mobile: `cd mobile && npm run lint && npm test`
- Ensure the database is running (`docker compose up -d yarok-db`) before running backend tests

---

## React Native / Expo Router Platform Gotchas

### `pointerEvents` (Expo SDK 52 / React Native 0.76+)
`pointerEvents` must be set as a **style property**, not a View prop. Using it as a prop (`<View pointerEvents="none">`) is silently ignored in RN 0.76+, causing overlays to intercept all touches even when you think they won't.
```tsx
// ✗ Wrong — silently ignored in RN 0.76+
<View pointerEvents="none" style={styles.overlay}>

// ✓ Correct
<View style={[styles.overlay, { pointerEvents: "none" }]}>
```

### Map overlays need explicit `zIndex`
The MapLibre GL canvas intercepts all pointer events at the CSS root level. Any absolutely-positioned View rendered over the map (buttons, search bars, bottom sheets) **must** have an explicit `zIndex` (e.g. `1000`) or touches will fall through to the map canvas instead of the overlay element. See `index.tsx` search bar (`zIndex: 1000`) as the reference pattern.

### Never navigate between modals with `router.back()` or `router.dismiss()`
Expo Router (React Navigation) cannot POP a screen that was pushed from within a modal. Both `router.back()` and `router.dismiss()` will throw `GO_BACK` / `POP` unhandled action errors. **Never push a new route from inside a modal to implement a sub-flow.** Instead, render the sub-screen as an absolutely-positioned overlay (`position: absolute, top/left/right/bottom: 0, zIndex: 9999`) within the same component tree. See `LocationPickerOverlay.tsx` as the reference pattern.

### Expo Router web unmounts screens on navigation
On web, `router.push()` causes the current screen to **unmount** (SPA navigation). Any async continuations (`await somePromise()`) attached to the old component instance are lost when the screen remounts. Never use a promise bridge to pass data back from a child route. Use `useFocusEffect` + module-level store, or (better) avoid navigation entirely with an in-tree overlay.

### `MapView` center prop only sets the initial position — use `key` to force updates
`react-map-gl` (used in `MapView.web.tsx`) reads `center` via `initialViewState`, which is consumed **once on mount and never again**. Passing a new `center` prop to an already-mounted MapView has no visual effect — the map tile stays frozen at the original position. Whenever a MapView must reflect a new coordinate (e.g. after the user picks a location), force a remount by keying on the coordinates:
```tsx
<MapView
  key={`${location.lat},${location.lng}`}
  center={location}
  zoom={15}
  ...
/>
```
This applies to any static/preview map whose center needs to update after initial render.

### `StatusBar` style on light backgrounds
Use `<StatusBar style="dark" />` when the app background is light — `"dark"` means dark-colored status bar icons (clock, battery, signal), which are readable on white/light-gray backgrounds. `"light"` is for dark backgrounds.

---

## Common Mistakes to Avoid
- Do not make any guesswork with API. Always read full API documentation thoroughly and search for working code examples before making any modification related to external API access
- Do NOT hardcode API keys — always use environment variables via `.env`
- Always start backend and frontend servers before tests, so that the test suite can actually execute
- Hebrew RTL: test UI on all platforms for correct text direction and layout
- PostGIS: ensure spatial queries use proper geometry types and indexes
- Alembic: never manually edit the database schema — always create migrations
- Map components: never import `@maplibre/maplibre-react-native` in `.web.tsx` files or vice versa
- Expo web production builds: `metro.config.js` must set `keep_classnames: true` and `keep_fnames: true` in `minifierConfig` — without this, `expo-modules-core`'s `registerWebModule` crashes because the minifier strips class names
- MapLibre on web: `@maplibre/maplibre-react-native` must be excluded from web bundles via `metro.config.js` resolver (`{ type: "empty" }`). It has no web implementation
- Railway deployment: backend uses `start.sh` to run `alembic upgrade head` before uvicorn. Railway injects `$PORT` at runtime — never hardcode the port in the Dockerfile CMD
- By default, in RTL languages: Don't left-align or center-align headlines or any other text unless directly asked for that. Bu default all text should align to the right with RTL languages (e.g. Hebrew)
- Tab bar icons MUST always have visible text labels — never render icon-only tabs. Every `Tabs.Screen` must have a `title` prop and the tab bar must have sufficient `height` (≥ 68px) to display both icon and label without clipping
- Never duplicate existing UI components — before adding any new UI element (search box, button, input, modal, etc.), search the codebase for an existing implementation of that element and reuse or extend it. Adding a second instance of an already-present component (e.g. a second search bar on the map screen) is always wrong
