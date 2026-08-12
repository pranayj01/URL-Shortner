# Shortlink

A learning-focused URL shortener built with Express, PostgreSQL (Prisma), and Redis.

## What it includes

- Create short links (Base62 from DB id or custom alias)
- Optional expiry
- Redirect with Redis read-through cache
- Click counting (async, non-blocking via Redis queue + worker)
- IP-based rate limiting before cache/database access
- Health check for Postgres + Redis
- Simple UI to create links and look up stats
- `User` model stub for future auth (links stay anonymous for now)

## Quick start (Docker)

```bash
docker compose up --build
```

Open http://localhost:3000

`npm start` / Docker start the API and the click-analytics worker together.

## Local development

1. Copy env: `cp .env.example .env`
2. Start Postgres + Redis (or use Compose services only):
   ```bash
   docker compose up postgres redis -d
   ```
3. Install and migrate:
   ```bash
   npm install
   npx prisma migrate deploy
   npm run dev
   ```

   `npm run dev` also starts the click worker. To run it alone: `npm run worker:clicks`

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/shorten` | Create short URL. Body: `{ originalUrl, customAlias?, expiresAt? }` |
| `GET` | `/api/urls/:code` | Stats: original URL, clicks, expiry |
| `GET` | `/:code` | Redirect to original URL |
| `GET` | `/health` | Liveness + dependency status |

### Example

```bash
curl -X POST http://localhost:3000/api/shorten \
  -H "Content-Type: application/json" \
  -d '{"originalUrl":"https://example.com","customAlias":"demo"}'
```

## Architecture notes

Redirect path:

```text
Request
 ↓
Rate Limiter (client IP)
 ↓
Redis Cache
 ↓
PostgreSQL
 ↓
302 redirect (clickCount updated asynchronously)
```

Click analytics is intentionally kept out of the critical redirect path:
redirects enqueue events into a Redis List, and a background worker persists them to PostgreSQL.

Rate limiting is IP-based only — it is not tied to a specific short code or URL path. The middleware runs before Redis or Postgres are contacted.

Create path:

```text
Request → Rate Limiter (IP) → validation → PostgreSQL
```

## Redirect benchmark (Phase 4)

Measured locally with [autocannon](https://github.com/mcollina/autocannon) against `GET /benchrun` (20 connections, 20 seconds, pipelining 10). Baseline run had `REDIS_URL` unset; Redis run warmed the cache first so redirects hit Redis instead of Postgres.

Reproduce:

```bash
npm run benchmark:redirect
```

| Metric | PostgreSQL | Redis |
| --- | ---: | ---: |
| Avg latency | 128.47 ms | 62.45 ms |
| p50 | 130 ms | 47 ms |
| p95 | 240 ms | 113 ms |
| p99 | 263 ms | 831 ms |
| Requests/sec | 1553.8 | 3096 |

Environment: Windows 11, Node 22, embedded PostgreSQL 18 + Memurai (via `redis-memory-server`), August 12, 2026.

## Fix Render deploy (do this in the dashboard)

The code cannot log into your Render account. These env/start settings are what actually unblock P1001 and analytics.

1. Open the **Postgres** service → **Info** → **Connections**.
2. Copy **External Database URL** (host must look like `dpg-….oregon-postgres.render.com`).
   - Do **not** use Internal Database URL (`dpg-….` with no `.render.com`). That is what caused `P1001`.
3. Open the **Web** service → **Environment**.
   - Set `DATABASE_URL` = that External URL.
   - Set `NODE_ENV` = `production`.
   - Optional: `REDIS_URL` if you have a Render Redis instance. Analytics still works without Redis.
4. Web service **Settings**:
   - If this is a **Docker** deploy: leave Start Command empty (the Dockerfile already runs `node src/start.js`).
   - If this is a **Node** deploy:
     - Build Command: `npm install && npx prisma generate`
     - Start Command: `npm start`
   - Do **not** run `prisma migrate deploy` in the **Build** command. Render’s build network cannot reach the database.
5. **Manual Deploy** → **Deploy latest commit**.
6. In logs you should see `Using database host: …render.com` then `Server running on port …` and `Click worker starting`.

If it still fails, the database may be paused or the password was rotated — copy a fresh External URL from the Postgres page.

## Intentionally deferred

- Auth / sessions / owned-link dashboards
- Automated tests
- Custom domains / QR codes

## Security note

Do not commit `.env` or hosted DB credentials. If a Render (or other) password was ever committed, rotate it in the provider dashboard.
