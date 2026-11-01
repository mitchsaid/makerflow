# The "are you a person?" check (Cloudflare Turnstile)

Why: anyone can start a demo (an anonymous sign-in) and ask for a sign-in email, so a script could fill the database or send a lot of email. The check makes that hard. It is **off until you set a key**, and the app works exactly as before without it.

## Switching it on (founder), in this order
1. **Cloudflare:** create a free Turnstile widget (Dashboard, Turnstile, Add widget) for your site's address. You get a **site key** (public) and a **secret key** (private; never in code, chat or GitHub).
2. **Vercel, Environment Variables:** add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` with the site key, and **redeploy**. The sign-in page and the demo choice now show the check.
3. **Only then, Supabase dashboard, Authentication, Attack Protection:** switch on CAPTCHA, choose Turnstile, paste the **secret key**.

**The order matters.** Once Supabase has the check on, it refuses every email sign-in and anonymous visit that arrives without a token. If you switch it on in Supabase before the site sends tokens (step 2), nobody can sign in until you fix it. To undo: switch CAPTCHA off in Supabase.

## What it does
- The sign-in page shows the check; the email button says to wait a moment if it has not finished. The token goes to Supabase with the email.
- Choosing a kind of maker for the demo shows the check, then starts the demo with the token.
- Google sign-in is not affected (it leaves the site).
- The check script loads from `challenges.cloudflare.com`; there is no other tracking.

## Testing
Unit tests check the token is passed on when there is one and left out when not. The browser tests run with the check off (they cannot load Cloudflare), so **the widget itself needs a look by hand** the first time: with the key set, open the sign-in page and the demo, see the check appear and the email send or the demo start. Cloudflare publishes test keys that always pass (`1x00000000000000000000AA`) and always fail (`2x00000000000000000000AB`); use the always-pass site key in a preview first.
