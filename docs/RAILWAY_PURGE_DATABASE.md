# Delete all records from the Yarok database on Railway

You can **delete only reports (and their media)** via the admin API or the purge script, or **wipe everything** (reports, media, users, etc.) with SQL.

---

## Option 1 (recommended): Admin API — purge reports over HTTP

No database URL on your machine, no TCP Proxy, no scripts. One secret in Railway and one `curl` (or browser) call.

### Step 1: Set the admin secret on Railway

1. Open your **Railway** project → **yarok-api** → **Variables**.
2. Add a variable: **`ADMIN_SECRET`** = a long random string (e.g. generate with `openssl rand -hex 24`).  
   Keep this secret; you’ll use it in the next step.

3. Redeploy **yarok-api** so the new variable is applied.

### Step 2: Call the purge endpoint

From your **local machine** (or anywhere):

**Dry run (count only, no changes):**
```bash
curl -X GET "https://yarok-api-production.up.railway.app/api/v1/admin/purge-reports" \
  -H "X-Admin-Secret: YOUR_ADMIN_SECRET"
```

**Actually purge all reports and media:**
```bash
curl -X POST "https://yarok-api-production.up.railway.app/api/v1/admin/purge-reports" \
  -H "X-Admin-Secret: YOUR_ADMIN_SECRET"
```

Replace `yarok-api-production.up.railway.app` with your actual yarok-api URL if different, and `YOUR_ADMIN_SECRET` with the value you set in Step 1.

- **GET** returns current counts only (no deletion).
- **POST** deletes all reports and their media (DB + local/S3), then returns a summary.

If `ADMIN_SECRET` is not set on the server, the endpoints return 503 (admin disabled). Wrong or missing header returns 403.

---

## Option 2: Purge script (local run against Railway DB)

Use the backend’s purge script, pointed at your **Railway** database. Requires exposing the DB (e.g. TCP Proxy) and using the DB URL locally.

### Step 1: Get the database URL from Railway

1. Open your **Railway** project.
2. Click **yarok-api** → **Variables** (or the postgis service).
3. Find **`DATABASE_URL`**. The API uses `postgis.railway.internal`, which is **not** reachable from your laptop. You need a **public** host and port:
   - Go to **postgis** → **Settings** → **Public Networking** → **"+ TCP Proxy"**.
   - Note the **host** and **port** Railway shows.
4. Build the URL: `postgresql+asyncpg://USER:PASSWORD@TCP_PROXY_HOST:TCP_PROXY_PORT/yarok`  
   (User/password from postgis Variables; database name is usually `yarok`.)

### Step 2: Run the purge script locally

```bash
cd backend
source .venv/bin/activate
export DATABASE_URL='postgresql+asyncpg://...'   # your Railway URL with TCP Proxy host:port
python scripts/purge_reports.py --force
```

All **reports** and **media** rows on that database are deleted. **Users** are kept.

---

## Option 3: Delete everything (reports, media, users, subscriptions, etc.)

This removes all data from the main Yarok tables on Railway.

1. Connect to the Railway Postgres (e.g. TCP Proxy + Variables, or Railway’s data tools if available).
2. Run:

```sql
TRUNCATE TABLE notification_log, subscriptions, media, reports, users
RESTART IDENTITY CASCADE;
```

Tables and schema stay; only data is removed.

---

## Summary

| Goal                         | What to do                                                                 |
|-----------------------------|----------------------------------------------------------------------------|
| Delete only reports & media | **Option 1**: set `ADMIN_SECRET` on yarok-api, then `curl` POST to `/api/v1/admin/purge-reports` with `X-Admin-Secret`. |
| Same, via script            | **Option 2**: TCP Proxy + `DATABASE_URL`, run `purge_reports.py --force` locally. |
| Delete everything           | **Option 3**: connect to Railway DB and run the `TRUNCATE ...` SQL above.  |

Always double-check you’re targeting the **Railway** database (Option 2) or the **production** API URL (Option 1), not local.
