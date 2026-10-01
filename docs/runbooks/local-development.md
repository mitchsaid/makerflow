# Runbook: working locally (fast loop)

Goal: see every change in your browser within a second, run the quick checks yourself, and push only when happy. CI then runs the full suite once, on the pull request.

## One-time setup (macOS)
1. **Docker:** install Docker Desktop (or OrbStack, which is lighter). Start it. The local database and auth run in containers.
2. **Node 22 and pnpm:** install Node 22 (for example with `fnm` or `nvm`), then run `corepack enable` so `pnpm` is available.
3. **Get the code:** `git clone https://github.com/mitchsaid/makerflow.git`, then `cd makerflow/app && pnpm install`.
4. **Browser tests (optional locally):** `pnpm exec playwright install chromium`.
5. **Claude Code on your machine:** install Claude Code (CLI, desktop app or editor extension, per the current Claude Code docs) and open it in the `makerflow` folder. Then edits happen on your machine and show up live.

## Starting up each day
```bash
cd makerflow/app
pnpm stack:start      # local database, sign-in, API and mailbox (first run downloads images, later runs ~20s)
pnpm env:local        # writes app/.env.local for the local stack (safe: refuses to overwrite a hosted one)
pnpm dev              # the app at http://localhost:3000, reloads as you save
```
Sign-in emails never leave your machine. Open **http://127.0.0.1:54324** (the local mailbox) to find the sign-in link.
For a phone-sized preview use your browser's device mode (Chrome: DevTools, then the phone icon).

## The loop
| Step | Command | Time | When |
|---|---|---|---|
| See the change | save the file, look at the browser | instant | constantly |
| Quick checks | `pnpm check` (lint, types, unit tests) | ~30s | before each commit |
| One journey | `pnpm test:e2e -g "part of the test name"` | ~10-30s | when the change touches that flow |
| Database rules | `pnpm db:test` | seconds | after any migration |
| Everything | `pnpm test:e2e` | ~40s | before opening the pull request |

Then: commit, push the branch (Vercel builds a preview in about a minute, no CI yet), open a pull request (CI runs the full suite once, about 4 minutes), merge. If you changed the database, run **Actions, Deploy database to dev** after merging.

## Handy
- `pnpm db:reset` wipes the **local** database and re-applies every migration (a clean slate).
- `pnpm stack:stop` stops the containers when you are done.
- The local stack's keys are fixed demo credentials, not secrets. Never copy hosted keys into `.env.local` unless you mean to point your local app at that hosted project.

## Troubleshooting
- "Cannot connect to the Docker daemon": start Docker Desktop.
- "port already allocated" or the app does not start: something else is using 3000 or 54321-54324. Stop it, or run `pnpm stack:stop` and start again.
- Sign-in link says expired: links work once; request a new one and use the newest email in the local mailbox.
