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
2. The token is read locally with `getClaims()` (no network call) to know which rows to ask for, and the session check (`session_is_active()`, a database function) runs **in parallel** with the data query, so ending a session elsewhere locks the app on the next request at no extra waiting. A first version trusted the token alone; the founder rejected the up-to-an-hour delay after sign-out. See `docs/security-notes.md`.
3. `app/vercel.json` pins functions to `dub1` (Dublin), next to Supabase eu-west-1. If the host plan rejects this, set it in Vercel under Settings, Functions.
4. The tapped tab lights up immediately (`useLinkStatus`), and each tab page has a loading skeleton.
5. Tabs do not shift when selected (same font weight; the selected marker is absolutely positioned). Covered by an e2e test.

## Measured (local rig, `pnpm perf`, Home to Settings and back, phone viewport)
Simulated: phone to server 190 ms (South Africa to Europe); server to database 8 ms (same region) or 90 ms (US function, Irish database; phone to server 280 ms).

| | Server to Supabase calls per click | Same region (8 ms) | Far region (90 ms) |
|---|---|---|---|
| Before | 5 to 6 in series | 238 ms | 547 ms |
| After (skeleton removed) | 2 in parallel | 235 ms | 325 ms |

The "same region" row is dominated by the simulated phone-to-server distance, so the gain there is small; the gain is large when the function and database are far apart or the database is slow. Real devices and real hosting must still be checked on a phone.

## Loading skeletons: kept (founder decision)
A skeleton plus the instantly lit tab gives feedback after about 55 ms. The cost, measured on the rig: React holds the real page back for up to roughly 300 ms after showing any loading fallback, so the real content lands later than it would without a skeleton (about 0.35 to 0.8 s versus 0.24 to 0.33 s on the rig; the rig's timing is noisy). The founder judged the better perceived responsiveness worth it. Revisit if content timings matter more than feedback, or once prefetching/caching (option B) means the fallback rarely shows. The table above was measured without skeletons.

## Rule (also in CLAUDE.md)
Every protected page makes one query for its main data (plus the parallel session check) and is checked with `pnpm perf` before release. Add a screen to `scripts/perf/measure.mjs` when it becomes a main tab.

## Still to do
- PWA: manifest, icons, installability, then a service worker for the app shell (separate slice).
- Founder to confirm the deployed function region in Vercel and the `?_rsc` request timing in the browser Network tab on the live dev site.
- Option B (client cache) when the quote screens are built.
