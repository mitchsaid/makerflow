#!/usr/bin/env bash
# Runs the SQL tests against the real local Supabase stack (see `pnpm db:start`).
# The URL below is the local stack's fixed demo credential, not a secret.
set -euo pipefail
url="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
here="$(cd "$(dirname "$0")" && pwd)"
for f in "$here"/*.test.sql; do
  echo "running $(basename "$f")"
  psql -v ON_ERROR_STOP=1 -q "$url" -f "$f"
done
