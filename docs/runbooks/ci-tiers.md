# What CI runs, and how to keep small changes quick

Written 2026-10-15 after the founder pointed out that every small change paid the same ~20 minutes. Thin slices stay;
the fixed cost per pull request is what shrinks.

## What runs on a pull request

| Check (required) | Runs when | Notes |
|---|---|---|
| Lint, typecheck, build | always | Lint, typecheck, unit tests (this includes the docs guard tests) and a production build. A few minutes. |
| Migrations and security tests | the change touches `app/supabase/` or `.github/` | Skipped otherwise. A skipped required job counts as passed. |
| Browser tests (real local Supabase) | anything other than `docs/` or a `.md` file changed | Four shards run in parallel (`Browser tests shard n/4`); the check with the required name only reports their combined result. |

On `main` everything runs. A newer push to the same pull request cancels the older run.

The browser tests are shared out test by test (`fullyParallel` in CI), not file by file, so the long accessibility walks do not
sit on one shard. This depends on every test signing up its own person. Keep it that way: a test that needs another test to
have run first will fail here, intermittently.

## Locally, before pushing

Do not run the whole browser suite for a small change (about 25 minutes). Run the checks that can catch the change:

1. `pnpm check` (lint, typecheck, unit tests; ~2 minutes).
2. The specs for the screens you touched: `pnpm exec playwright test e2e/<file>.spec.ts --project=mobile`. A change to a shared
   component (the sheet, a form field) means the specs of every screen that uses it, plus `e2e/accessibility.spec.ts`.
3. Let CI run the rest.

## Which lane a change goes in

- **Full lane** (full CI and the review agent): auth, row-level security, money and tax, migrations, deletion, anything that
  changes what is stored or sent. Same as always.
- **Rough lane** (agreed with the founder, 2026-10-15): a new or reworked *interaction* whose shape is still a guess, such as a
  form flow. It goes to dev early with real behaviour but less hardening (focus handling, rare edge cases, a thin set of tests),
  marked as rough in the plan. The founder tries it; hardening follows in a second pull request once the shape is agreed.
  Never used for money, auth or RLS. The accessibility walk must still pass for any new screen.
- **Polish batch**: small wording and visual fixes are collected into one pull request instead of one each.

## Ideas not done yet

- Serving a production build to the browser tests instead of `pnpm dev` (no on-demand compiling). Faster per test, but it is a
  change to how the tests run, so it needs its own look.
- Mapping changed files to the specs that matter, to run only those on a pull request and the full suite after merge.
