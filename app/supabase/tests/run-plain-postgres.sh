#!/usr/bin/env bash
# Applies the migrations and runs the SQL tests against a PLAIN Postgres
# database, using the auth shim. For sandboxes without Docker.
# In CI and on a normal machine, prefer the real stack: `pnpm supabase test db`
# or `supabase start` plus these same test files.
#
# Usage: DATABASE_URL=postgres://user@host/scratch_db ./run-plain-postgres.sh
# The target database must be a disposable scratch database.
set -euo pipefail

: "${DATABASE_URL:?set DATABASE_URL to a disposable scratch database}"

here="$(cd "$(dirname "$0")" && pwd)"
supabase_dir="$(dirname "$here")"
psql_run() { psql -v ON_ERROR_STOP=1 -q "$DATABASE_URL" "$@"; }

psql_run -f "$here/shim/auth_shim.sql"

for f in "$supabase_dir"/migrations/*.sql; do
  echo "applying $(basename "$f")"
  psql_run -f "$f"
done

for f in "$here"/*.test.sql; do
  echo "running $(basename "$f")"
  psql_run -f "$f"
done
