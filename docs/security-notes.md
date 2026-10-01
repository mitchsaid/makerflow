# Security notes and pre-launch checklist

Living list. Add to it whenever a security-relevant decision or gap comes up.

## Reviewed so far
- Row-level security and privileges for organisations, memberships, profiles (`app/supabase/migrations/`), with tests that were mutation-checked.
- Sign-in: magic link (token verified server-side, works across browsers), redirect targets restricted to in-site paths (tested), protected pages check the user in the page itself and not only in the proxy, sign-in responses do not reveal whether an email is registered, no secrets in the repo (scanned before commit).

Not yet reviewed by a human: all of the above. Auth, RLS and migrations need the founder's (or a security reviewer's) sign-off before real customer data goes in.

## Known gaps to close before public launch
1. **Bot protection on sign-in.** Anyone can make the app send a sign-in email to any address. Supabase rate-limits this, but add a CAPTCHA (for example Cloudflare Turnstile) so the form cannot be used for email bombing. Also needed for the public demo sandbox.
2. **Email link prefetching.** Some email scanners open links automatically, which uses up the one-time token and the user sees "expired". If this shows up with real users, add an intermediate "Confirm sign-in" button page.
3. **Hosted Supabase settings must match local config.** Site URL, redirect allow-list, the magic-link email template (`app/supabase/templates/magic_link.html`, which builds the link from the Site URL) and the Google provider are project settings. Set them on dev and prod deliberately, and apply from config files where possible. A wrong Site URL sends users to the wrong host.
4. **Custom email sender (needed for two reasons).** Supabase's built-in sender is rate-limited and not for real launch volume, and Supabase only allows custom email templates once custom SMTP is configured. Until then the default emails are used, and their links only work in the same browser that requested them (the app shows a helpful message otherwise). Set up a proper provider with SPF/DKIM on a domain we own, then switch to our templates so links work across browsers and devices.
5. **Google sign-in** is built but untested against a real Google project. Verify the redirect URLs on both hosted projects.
6. **Account deletion and orphaned businesses.** Deleting a login currently removes its memberships and can leave an organisation with no owner. Decide the rule (tax records must be kept) before building account deletion.
7. **Backups.** Free-tier Supabase has none. Nightly dump job is planned. Upgrade prod before real invoices.
8. **POPIA.** Data is stored in the EU. Confirm cross-border transfer position and privacy-policy wording with a South African legal adviser.
9. **Security headers and Content-Security-Policy** are not configured yet.
10. **Secrets handling.** Only the publishable key is ever used in the app. The Supabase secret key and database passwords must live only in hosting and CI secret stores. Rotate anything that is ever pasted into a chat or committed.
11. **Dependency and secret scanning** in GitHub (Dependabot, secret scanning, push protection) are not yet switched on. Founder to enable in repository settings.
12. **Sign-out takes effect immediately, but only for pages and actions, not for the raw token.** A sign-in token (JWT) stays valid for about an hour even after its session is ended. The app therefore calls `public.session_is_active()` (migration `20261001090000_session_check.sql`) on every protected page and action, in parallel with the page's data query; if the session is gone (signed out on another device, user removed, expired) the request is treated as signed out. Tested in `session_check.test.sql` and the e2e test "signing out on one device locks every other device". Supabase's own `getUser()` was checked and does NOT detect an ended session in the local stack, so it is not relied on for this. Remaining gap: someone holding a stolen token could still call the database API directly (not through the app) until it expires. If that matters, shorten the token lifetime in project settings and/or make the row-level-security helpers (`is_org_member`, `has_org_role`) also require `session_is_active()`. Decide before real customer data goes in.
