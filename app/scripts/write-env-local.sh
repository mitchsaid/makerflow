#!/usr/bin/env bash
# Writes app/.env.local from the RUNNING local Supabase stack (`pnpm stack:start`).
# The values are the local stack's fixed demo credentials, not secrets.
# Refuses to overwrite a .env.local that points somewhere else unless --force is given.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env.local && "${1:-}" != "--force" ]]; then
  current="$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2- || true)"
  case "$current" in
    ""|http://127.0.0.1:*|http://localhost:*) ;;
    *) echo "app/.env.local points at $current, not the local stack. Re-run with --force to overwrite." >&2; exit 1 ;;
  esac
fi

status="$(pnpm --silent exec supabase status -o env)"
get() { printf '%s\n' "$status" | grep -E "^$1=" | head -1 | cut -d= -f2- | tr -d '"'; }
api="$(get API_URL)"; key="$(get PUBLISHABLE_KEY)"; mail="$(get MAILPIT_URL)"

if [[ -z "$api" || -z "$key" ]]; then
  echo "Could not read the local stack's settings. Is it running? Try: pnpm stack:start" >&2
  exit 1
fi

cat > .env.local <<ENV
NEXT_PUBLIC_SUPABASE_URL=$api
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$key
# Local mailbox: magic-link emails land here (open it in a browser). Also used by the browser tests.
LOCAL_MAILPIT_URL=${mail:-http://127.0.0.1:54324}
ENV
echo "Wrote app/.env.local for the local stack ($api)."
echo "Email inbox for sign-in links: ${mail:-http://127.0.0.1:54324}"
