# Delete all records from the Yarok database on Railway

You can either **delete only reports (and their media)** or **wipe everything** (reports, media, users, etc.).

---

## Option 1: Delete all reports and media (keep users)

Use the backend’s purge script, pointed at your **Railway** database.

### Step 1: Get the database URL from Railway

1. Open your **Railway** project.
2. Click the **yarok-api** service (or **yarok-db** if you prefer).
3. Go to the **Variables** tab.
4. Find **`DATABASE_URL`**. Click to reveal, then **copy** the value.  
   It usually looks like:  
   `postgres://yarok:xxxxx@containers-us-west-xxx.railway.app:5432/railway`

### Step 2: Use the correct URL format for the script

The script needs an **async** Postgres URL. Change the start of the URL:

- **From:** `postgres://`
- **To:** `postgresql+asyncpg://`

So if Railway gave you:
`postgres://yarok:secret@host:5432/railway`  
use:
`postgresql+asyncpg://yarok:secret@host:5432/railway`

(Only the `postgres://` → `postgresql+asyncpg://` part changes; the rest stays the same.)

### Step 3: Run the purge script on your computer

1. Open a terminal on your **local machine** (where the Yarok repo is).
2. Go to the backend folder and activate the virtual environment:
   ```bash
   cd backend
   source .venv/bin/activate
   ```
   (On Windows: `.venv\Scripts\activate`.)

3. Set the Railway database URL (paste your modified URL in place of `YOUR_URL_HERE`):
   ```bash
   export DATABASE_URL='postgresql+asyncpg://YOUR_URL_HERE'
   ```
   Example:
   ```bash
   export DATABASE_URL='postgresql+asyncpg://yarok:abc123@containers-us-west-99.railway.app:5432/railway'
   ```

4. Run the purge script (no confirmation prompt):
   ```bash
   python scripts/purge_reports.py --force
   ```

5. You should see lines like “Reports in database: X”, “Purging database rows…”, “Purge complete.”  
   All **reports** and **media** rows on the Railway database are now deleted. **Users** are kept.

---

## Option 2: Delete everything (reports, media, users, subscriptions, etc.)

This removes all data from the main Yarok tables on Railway.

### Step 1: Connect to the Railway database

- Either use **Railway’s “Connect”** (or “Data” / “Query”) in the dashboard for your **yarok-db** (or Postgres) service,  
- Or use a SQL client (e.g. **psql**, TablePlus, DBeaver) with the same **DATABASE_URL** you use for yarok-api.  
  If the client only accepts `postgres://`, use that; the script needed `postgresql+asyncpg://` for Python.

### Step 2: Run this SQL once

Run the following in a single go (it truncates all main app tables and resets sequences):

```sql
TRUNCATE TABLE notification_log, subscriptions, media, reports, users
RESTART IDENTITY CASCADE;
```

After this, all records in those tables on Railway are gone. Tables and schema stay; only data is removed.

---

## Summary

| Goal                         | What to do                                                                 |
|-----------------------------|----------------------------------------------------------------------------|
| Delete only reports & media | Use **Option 1**: get `DATABASE_URL` from Railway, fix URL, run `purge_reports.py --force` locally. |
| Delete everything           | Use **Option 2**: connect to the Railway DB and run the `TRUNCATE ...` SQL above. |

Always double-check you’re using the **Railway** database URL (and not your local one) before running the script or SQL.
