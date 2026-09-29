# Runbook: connect the app to the hosted dev project

Project: `makerflow-dev` (ref `mbbfjhjzhilathupnxdb`, EU region). Do this for `makerflow-prod` only after dev works and the migration has been reviewed.

Never paste keys, tokens or passwords into a chat or commit them. They go into GitHub and Vercel secret settings only.

## 1. Put the database in place (GitHub secrets, then a manual run)
1. Supabase: Account (avatar) > **Access Tokens** > generate a token named `github-deploy-dev`. Copy it once.
2. Supabase: the dev project's **database password** (the one saved when it was created; reset it in Project Settings > Database if lost).
3. GitHub: repo **Settings > Environments > New environment** named `dev`. Add two **environment secrets**:
   - `SUPABASE_ACCESS_TOKEN` = the token from step 1
   - `SUPABASE_DB_PASSWORD` = the password from step 2
4. GitHub: **Actions > Deploy database to dev > Run workflow**. The "Show what would change" step lists what will be applied. The migration creates the tenancy tables and security rules.
5. Check: Supabase dashboard > Table Editor shows `organisations`, `memberships`, `profiles`, and Authentication > Policies shows the rules.

## 2. Configure sign-in on the dev project (dashboard)
Authentication settings on the hosted project must match `app/supabase/config.toml`:
1. **URL Configuration**
   - Site URL: the stable URL of the deployed dev app (the Vercel project's main `.vercel.app` address, from step 3). Until it exists, use `http://localhost:3000`.
   - Redirect URLs: add that same URL with `/**`, plus `http://localhost:3000/**`.
   - The sign-in email builds its link from the Site URL. Per-branch preview URLs will therefore send links to the stable dev address, not the preview. Test sign-in on the stable address.
2. **Email Templates**: set both templates to the files in `app/supabase/templates/`:
   - "Confirm signup" = `confirmation.html` (link has `type=signup`)
   - "Magic Link" = `magic_link.html` (link has `type=email`)
   New users get the first, returning users the second. Both links point at `/auth/confirm`.
3. **Sign In / Providers > Email**: keep "Confirm email" on (matches local config). Leave Google off until it is configured.
4. Email sending: the built-in sender is heavily rate-limited. Fine for a few test sign-ins. Set up a proper sender before real testers.

## 3. Deploy the app on Vercel
1. Vercel: **Add New > Project**, import the GitHub repo.
2. **Root Directory: `app`**. Framework should auto-detect as Next.js.
3. Environment variables (apply to Production, Preview and Development for now; Production switches to the prod project later):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://mbbfjhjzhilathupnxdb.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = the dev project's **publishable** key (Project Settings > API Keys). Never the secret key.
4. Deploy. Copy the stable project URL back into step 2.1.
5. Vercel's free Hobby plan is for non-commercial use. Check its terms before charging anyone.

## 4. Check it worked
On the stable dev URL, on a phone: sign up with your email, open the email link (try opening it in a different browser than the one you asked from), name a business, see the workspace, sign out, sign in again.

## Known limits
- Google sign-in not yet configured or tested.
- CAPTCHA not yet added (see `docs/security-notes.md`).
- This workflow has not yet run against a real project.
