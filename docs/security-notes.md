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
4. **Custom email sender.** Supabase's built-in sender is rate-limited and not for real launch volume. Use a proper provider with SPF/DKIM set up so magic links land in inboxes.
5. **Google sign-in** is built but untested against a real Google project. Verify the redirect URLs on both hosted projects.
6. **Account deletion and orphaned businesses.** Deleting a login currently removes its memberships and can leave an organisation with no owner. Decide the rule (tax records must be kept) before building account deletion.
7. **Backups.** Free-tier Supabase has none. Nightly dump job is planned. Upgrade prod before real invoices.
8. **POPIA.** Data is stored in the EU. Confirm cross-border transfer position and privacy-policy wording with a South African legal adviser.
9. **Security headers and Content-Security-Policy** are not configured yet.
10. **Secrets handling.** Only the publishable key is ever used in the app. The Supabase secret key and database passwords must live only in hosting and CI secret stores. Rotate anything that is ever pasted into a chat or committed.
11. **Dependency and secret scanning** in GitHub (Dependabot, secret scanning, push protection) are not yet switched on. Founder to enable in repository settings.
