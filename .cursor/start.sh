#!/usr/bin/env bash
# Per-boot startup for the url-shortener Cloud Agent environment.
# Brings up PostgreSQL and Redis, provisions the database, and applies
# Prisma migrations. Safe to run repeatedly (idempotent).
set -euo pipefail

export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:password@localhost:5432/mydb}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"

PG_VERSION="16"

# 1. Ensure system packages exist (only installs on a cold VM without a snapshot).
if ! command -v pg_ctlcluster >/dev/null 2>&1 || ! command -v redis-server >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    postgresql postgresql-contrib redis-server
fi

# 2. Start PostgreSQL if it is not already accepting connections.
if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  sudo pg_ctlcluster "$PG_VERSION" main start || true
fi

# Wait until PostgreSQL is ready.
for _ in $(seq 1 30); do
  if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# 3. Provision the role password and application database (idempotent).
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER USER postgres WITH PASSWORD 'password';"
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='mydb'" | grep -q 1; then
  sudo -u postgres createdb mydb
fi

# 4. Start Redis if it is not already running.
if ! redis-cli ping >/dev/null 2>&1; then
  sudo redis-server --daemonize yes
fi

# 5. Apply database migrations.
npx prisma migrate deploy

echo "Environment ready: PostgreSQL + Redis up, migrations applied."
