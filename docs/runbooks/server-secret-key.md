# Giving the server its Supabase secret key

Everything that changes a quote's or job's state runs on our server with the Supabase **secret key**, which the browser never sees: sending, revising and discarding a revision, recording the customer's answer, creating a job (from a quote or by hand) and moving a job along. Without the key the rest of the app still works (you can browse and edit drafts), but those actions answer "MakerFlow's server key isn't set on this site yet, so nothing was changed. Whoever runs the site needs to add SUPABASE_SECRET_KEY", and nothing is changed.

**Never paste the key into chat, code, a GitHub issue or a commit.** If it ever is, rotate it.

## Hosted dev (and later prod): Vercel
1. In the Supabase dashboard, open the project (dev: `makerflow-dev`), then **Project Settings > API Keys**.
2. Under **Secret keys**, copy the key that starts with `sb_secret_` (create one if there is none, name it "vercel-server").
3. In Vercel, open the MakerFlow project > **Settings > Environment Variables**.
4. Add a variable named `SUPABASE_SECRET_KEY`, paste the key as the value, tick only the environment that matches the project (Preview/Development for dev, Production for prod). Leave **Sensitive** on.
5. Redeploy (Deployments > the latest > Redeploy) so the server picks it up.
6. Test: create a job, or send a quote, on the app. If it still says the server key isn't set, the variable is missing in the environment that site uses, or the redeploy did not happen.

Dev and prod must use their own project's key, never each other's.

## Local
`pnpm env:local` writes the local stack's key into `app/.env.local` (the local stack's fixed demo key, not a secret). Browser tests need it.
