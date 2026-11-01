# Plan: the "are you a person?" check for sign-in and the demo (off until keys are set)

Status: **built 2026-11-01, off until a key is set.** Founder, 2026-11-01: "OK do those" (item 5). It is hardening item 1 in `docs/security-notes.md`, and the thing the demo needs before its link is shared widely.

## Prototype read
No prototype counterpart.

## What the maker or visitor sees
Nothing, until the founder sets the keys. Then: a small Cloudflare Turnstile check on the sign-in page and when choosing a demo. It usually passes without any tapping. Steps and the safe order to switch it on: `docs/runbooks/captcha.md`.

## Decisions
1. **Supabase's own CAPTCHA protection, not a check of our own.** A check only in our server action would not stop a script calling Supabase's sign-in endpoints directly with the public key. So the check is switched on in Supabase and the app sends the token.
2. **It covers email sign-in and the demo together**, because Supabase's setting applies to both. Switching it on without tokens would lock everyone out, so the runbook gives the order (site first, then Supabase).
3. **Cloudflare Turnstile**, the free option with the least friction. The provider is Supabase's choice list (Turnstile or hCaptcha); changing it later means changing one component.
4. **Off with no key**: with `NEXT_PUBLIC_TURNSTILE_SITE_KEY` unset nothing renders and no token is sent, so the browser tests and local development are unchanged.

## Interactions reused
| What the screen needs | Existing interaction | Reused as is, with a mode, or new (and why) |
| --- | --- | --- |
| The check on a form | none | New component `components/turnstile.tsx` (a third-party widget has no equivalent) |
| A "wait a moment" message | `p role="status"` | As is |

Inputs by kind: none.

## Tests
Unit: the sign-in action passes the token when given and not when empty; `startDemo` passes it to the anonymous sign-in, asks a signed-in maker first, says plainly when anonymous sign-ins are off or the demos are full. Not tested by machine: the widget itself (it loads from Cloudflare); the runbook says how to look at it with Cloudflare's always-pass test key.

## Missed from the prototype
(none)
