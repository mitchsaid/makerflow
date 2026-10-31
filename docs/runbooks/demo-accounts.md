# Demo accounts: switching them on, and keeping them tidy

The landing page's "Try it first" makes each visitor a private demo business (docs/plans/demo-accounts.md).

## To switch on (hosted)
1. **Supabase dashboard, the project's Authentication settings: allow anonymous sign-ins.** (Local development has it on in `supabase/config.toml`.) Without it, tapping a demo card says "Something went wrong starting the demo".
2. **Vercel, Environment Variables: `CRON_SECRET`** (a long random string, server only). Vercel's scheduler sends it as a bearer token to `/api/cron/demo-cleanup` once a day (`app/vercel.json`). Without it the route refuses everyone and the daily clean-up does nothing; expired demos are still unusable at once and are cleaned up a few at a time as new demos start.
3. Apply the migration (`Deploy database to dev`, later prod).
4. Before sharing the landing page widely, add bot protection (CAPTCHA) to anonymous sign-in: `docs/security-notes.md`, hardening item 1.

## Limits
- 300 live demos at once (`create_demo_organisation`); then the visitor is told it is busy. Supabase also limits anonymous sign-ins per address (30 an hour).
- A demo lasts 6 hours. The database sets that; "cleared in N hours" in the banner reads it.

## Looking after it
- Count live demos: `select count(*) from organisations where demo_expires_at > now();`
- Remove expired ones by hand: call the cleanup route with the secret (`curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/demo-cleanup`).
- A demo never has an issued invoice (they cannot be deleted); if one ever does, `delete_account` refuses (55007) and the demo is left, logged. Do not work around it.
