#!/usr/bin/env bash
# One-time (and safe to re-run) setup for working on MakerFlow on your own computer.
# It checks what you need, installs the project's dependencies, starts the local
# database and writes app/.env.local. Run it from anywhere inside the repo:
#   ./scripts/setup-local.sh
# Options: --skip-browsers (don't download the test browser), --no-check (skip the final checks)
set -euo pipefail

skip_browsers=0; run_check=1
for arg in "$@"; do
  case "$arg" in
    --skip-browsers) skip_browsers=1 ;;
    --no-check) run_check=0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

step() { printf '\n==> %s\n' "$*"; }
fail() { printf '\nSTOP: %s\n' "$*" >&2; exit 1; }

cd "$(dirname "$0")/../app"

step "1/5 Checking your tools"
command -v git >/dev/null || fail "git is missing. On a Mac, run: xcode-select --install"

if ! docker info >/dev/null 2>&1; then
  fail "Docker isn't running. Open Docker Desktop, wait until it says it is running, then run this script again."
fi
echo "Docker: running"

command -v node >/dev/null || fail "Node.js is missing. Install Node 22, for example: brew install node@22"
node_major="$(node -p 'process.versions.node.split(".")[0]')"
[ "$node_major" -ge 22 ] || fail "Node $node_major is too old; this project needs Node 22 or newer. For example: brew install node@22"
echo "Node: $(node -v)"

if ! command -v pnpm >/dev/null; then
  corepack enable >/dev/null 2>&1 || true
fi
command -v pnpm >/dev/null || fail "pnpm is missing. Install it, for example: brew install pnpm"
echo "pnpm: $(pnpm -v)"

step "2/5 Installing the project's dependencies"
pnpm install --frozen-lockfile

step "3/5 Browser for the automated tests"
if [ "$skip_browsers" -eq 1 ]; then
  echo "Skipped (--skip-browsers)."
else
  pnpm exec playwright install chromium
fi

step "4/5 Starting the local database, sign-in and mailbox (the first time downloads a lot; later it is quick)"
pnpm stack:start
pnpm env:local

step "5/5 Quick checks"
if [ "$run_check" -eq 1 ]; then
  pnpm check
else
  echo "Skipped (--no-check)."
fi

cat <<'DONE'

All set.

Start the app any time with:
  cd app
  pnpm local

Then open http://localhost:3000 in your browser.
Sign-in emails never leave your computer: open http://127.0.0.1:54324 to read them.
DONE
