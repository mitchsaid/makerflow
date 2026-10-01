# ADR 0002: Navigation speed and the PWA feel

Status: accepted (founder asked whether sluggish navigation is tuning or architecture, 2026-10-01)

## Context
Moving between Home and Settings felt like loading a web page (about 3 seconds on the hosted dev app). Each click made 5 to 6 sequential calls from the server to Supabase (two auth checks plus several data queries). The browser, the Vercel function and the database may also be on different continents: users in South Africa, Supabase in Ireland, Vercel's default function region in the US.

## Decision
**It is latency to tune, not a wrong architecture.** Next.js plus Supabase is kept. We tune now (option A), and add client-side caching only where a screen needs it (option B).

Options considered:
- **A. Tune the server-rendered app (done now).** One database call per page, local token check, function region beside the database.
- **B. Add a client data cache with optimistic updates (planned for the quote screens).** Pages show cached data instantly, then refresh; saves feel instant.
- **C. Single-page app.** Rejected for now: loses server rendering for the landing page and future public hosted quotes.
- **D. Offline-first with a local database.** Rejected for now: large complexity (sync, conflicts). Revisit if makers need to work without signal.

## What was done
1. `getWorkspace()` in `app/src/lib/auth/dal.ts` loads membership, organisation, business profile and dismissed prompts in **one** query (was 4 to 5).
2. The signed-in user is read with `getClaims()` (token checked locally against the project's public keys) instead of `getUser()` (a network call on every use). See `docs/security-notes.md` for the trade-off.
3. `app/vercel.json` pins functions to `dub1` (Dublin), next to Supabase eu-west-1. If the host plan rejects this, set it in Vercel under Settings, Functions.
4. The tapped tab lights up immediately (`useLinkStatus`).

## Measured (local rig, `pnpm perf`, Home to Settings and back, phone viewport)
Simulated: phone to server 190 ms (South Africa to Europe); server to database 8 ms (same region) or 90 ms (US function, Irish database; phone to server 280 ms).

| | Database calls per click | Same region (8 ms) | Far region (90 ms) |
|---|---|---|---|
| Before | 5 to 6 | 238 ms | 547 ms |
| After | 1 | 235 ms | 325 ms |

The "same region" row is dominated by the simulated phone-to-server distance, so the gain there is small; the gain is large when the function and database are far apart or the database is slow. Real devices and real hosting must still be checked on a phone.

## Tried and rejected: loading skeletons
A `loading.tsx` skeleton showed after about 55 ms, but React then holds the real page back for up to roughly 300 ms after showing any loading fallback. Content arrived at 650 to 740 ms instead of 235 to 325 ms. Removed. Revisit if pages become slow enough that a skeleton clearly helps (rule of thumb: only when content takes more than about 500 ms).

## Rule (also in CLAUDE.md)
Every protected page makes at most one database call for its main data and is checked with `pnpm perf` before release. Add a screen to `scripts/perf/measure.mjs` when it becomes a main tab.

## Still to do
- PWA: manifest, icons, installability, then a service worker for the app shell (separate slice).
- Founder to confirm the deployed function region in Vercel and the `?_rsc` request timing in the browser Network tab on the live dev site.
- Option B (client cache) when the quote screens are built.
