#!/usr/bin/env bash
# Navigation speed check. Builds the app, starts it against the local Supabase stack
# through a proxy that adds artificial delay, then times Home, Quotes, Customers and More clicks in a
# phone-sized browser. Run from app/ with the local stack up:  pnpm perf [db_ms] [phone_ms] [label]
#   db_ms     delay added to every server -> Supabase call (default 8: same region; 90: far away)
#   phone_ms  delay between phone and server (default 190: South Africa -> Europe)
# Needs a Chromium for Playwright; set CHROMIUM_PATH if it is not found automatically.
set -uo pipefail
DB="${1:-8}"; RTT="${2:-190}"; LABEL="${3:-navigation}"; S="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399
DELAY_MS=$DB node "$S/latency-proxy.mjs" > "$TMP/proxy.log" 2>&1 & PROXY=$!
pnpm build > "$TMP/build.log" 2>&1 || { echo "BUILD FAILED"; tail -20 "$TMP/build.log"; kill $PROXY; exit 1; }
pnpm exec next start -p 3000 > "$TMP/server.log" 2>&1 & SERVER=$!
for _ in $(seq 1 40); do curl -s -o /dev/null http://localhost:3000 && break; sleep 0.5; done
cp "$S/measure.mjs" ./perf.tmp.mjs
echo "== $LABEL  (server to database: ${DB} ms per call, phone to server: ${RTT} ms)"
USER_RTT=$RTT timeout 300 node ./perf.tmp.mjs
STATUS=$?
rm -f ./perf.tmp.mjs
kill $SERVER $PROXY 2>/dev/null; wait 2>/dev/null
exit $STATUS
