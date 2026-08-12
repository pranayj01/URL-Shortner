#!/usr/bin/env bash
# One-time (idempotent) setup for the url-shortener Cloud Agent environment.
# Installs the system services the app depends on (PostgreSQL + Redis) and the
# Node dependencies / generated Prisma client. Runs after checkout; must terminate.
set -euo pipefail

export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:password@localhost:5432/mydb}"

# 1. System services: PostgreSQL 16 + Redis. Guard so this is a no-op when the
#    base image (or a snapshot) already provides them.
if ! command -v pg_ctlcluster >/dev/null 2>&1 || ! command -v redis-server >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    postgresql postgresql-contrib redis-server
fi

# 2. Node dependencies.
npm install

# 3. Generate the Prisma client (no database connection required).
npx prisma generate

echo "Install complete: system services present, node_modules and Prisma client ready."
