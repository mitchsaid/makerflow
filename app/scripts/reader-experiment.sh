#!/usr/bin/env bash
# Runs the document reader over a folder of real quotes and invoices, once for each model, and writes a report beside them
# (docs/runbooks/document-reader.md). Only on your own computer: it calls the real AI service with your key and spends money.
#
#   ANTHROPIC_API_KEY=... pnpm reader:experiment ~/Documents/sample-quotes
#   READER_EXPERIMENT_MODELS=claude-haiku-5-5 ANTHROPIC_API_KEY=... pnpm reader:experiment <folder>
set -euo pipefail
folder="${1:-}"
if [ -z "$folder" ] || [ ! -d "$folder" ]; then
  echo "usage: ANTHROPIC_API_KEY=... pnpm reader:experiment <folder of quotes and invoices>" >&2
  exit 2
fi
if [ -n "${CI:-}" ] || [ -n "${VERCEL:-}" ]; then
  echo "the reader experiment only runs on a developer's own computer" >&2
  exit 2
fi
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "set ANTHROPIC_API_KEY first (and a spend limit on that account)" >&2
  exit 2
fi
here="$(cd "$(dirname "$0")/.." && pwd)"
cd "$here"
READER_EXPERIMENT_DIR="$(cd "$folder" && pwd)" exec pnpm exec vitest run --silent=false --config vitest.experiment.config.mts
