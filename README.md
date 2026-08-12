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

## Deploy on Render (resume-ready live link)

No special code changes are required. Create **3 services** in the same region, then set env vars.

### 1) PostgreSQL

1. **New +** → **PostgreSQL**
2. Create it and wait until it is available
3. Open **Connections** → copy **External Database URL**  
   (must contain `.oregon-postgres.render.com` or similar)

### 2) Redis

1. **New +** → **Key Value** (Redis)
2. Same region as Postgres
3. Copy **Internal Redis URL** (or External if shown)

### 3) Web Service

1. **New +** → **Web Service** → connect your GitHub repo `URL-Shortner`
2. Settings:
   - **Runtime:** Node
   - **Build Command:** `npm install && npx prisma generate`
   - **Start Command:** `npm start`
3. Environment variables:

| Key | Value |
|-----|--------|
| `DATABASE_URL` | Postgres **External** URL from step 1 |
| `REDIS_URL` | Redis URL from step 2 |
| `BASE_URL` | Your site URL, e.g. `https://your-app.onrender.com` |
| `NODE_ENV` | `production` |

4. Deploy
5. Open the public URL Render gives you

### Smoke test before putting it on your resume

1. Open `/health` → should show postgres `up` (and redis `up` if Redis is set)
2. Create a short link → the result must start with your Render URL, **not** `localhost`
3. Open the short link → it should redirect
4. Look up stats with the short code → `Clicks` should increase

### Common mistakes

- Build Command must **not** be `npm start`
- `DATABASE_URL` must be the **External** URL (host includes `.render.com`)
- `BASE_URL` must be `https://your-app.onrender.com` (no trailing slash)
- Free Render apps sleep when idle; first request can take ~30–60s

## Intentionally deferred

- Auth / sessions / owned-link dashboards
- Automated tests
- Custom domains / QR codes

## Security note

Do not commit `.env` or hosted DB credentials. If a Render (or other) password was ever committed, rotate it in the provider dashboard.
