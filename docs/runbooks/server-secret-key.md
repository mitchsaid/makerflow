# Giving the server its Supabase secret key

Sending a quote (and revising one) runs on our server with the Supabase **secret key**, which the browser never sees. Without it the app still works, but Send answers "Sending isn't switched on for this version of MakerFlow yet".

**Never paste the key into chat, code, a GitHub issue or a commit.** If it ever is, rotate it.

## Hosted dev (and later prod): Vercel
1. In the Supabase dashboard, open the project (dev: `makerflow-dev`), then **Project Settings > API Keys**.
2. Under **Secret keys**, copy the key that starts with `sb_secret_` (create one if there is none, name it "vercel-server").
3. In Vercel, open the MakerFlow project > **Settings > Environment Variables**.
4. Add a variable named `SUPABASE_SECRET_KEY`, paste the key as the value, tick only the environment that matches the project (Preview/Development for dev, Production for prod). Leave **Sensitive** on.
5. Redeploy (Deployments > the latest > Redeploy) so the server picks it up.
6. Test: send a quote on the app. It should lead to the sent quote; if it says sending isn't switched on, the variable is missing in that environment.

Dev and prod must use their own project's key, never each other's.

## Local
`pnpm env:local` writes the local stack's key into `app/.env.local` (the local stack's fixed demo key, not a secret). Browser tests need it.
