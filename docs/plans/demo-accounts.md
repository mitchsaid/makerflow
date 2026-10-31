# Plan: public demo accounts ("Try the demo" on the landing page)

Status: **slice 1 built 2026-10-31** (a private demo business per visitor with the sample business, logo, customers, materials and costed products; banner, start over, expiry and clean-up). **Slice 2 built the same day** (three sample quotes per demo: a draft that shows the margin, a sent one and an accepted one with a job in progress and an invoice draft). Founder, 2026-10-31: "After this build the demo accounts." Requirement and decisions: `docs/product-brief.md`, section 4a (private sandbox per visitor, several demos one per kind of maker, each with a logo). **Needs human review**: anonymous sign-in, a new security-definer function and new columns that decide what a business may do (migration `20261202100000_demo_accounts.sql`).

## Where things stand
The landing page had an inactive "Try the demo (coming soon)". Nothing sends email and nothing takes a payment yet, so "demos never send real email or take real payments" holds today without a block; it must be kept when either is built (the check is `workspace.demo`).

## Prototype read
No prototype counterpart. The prototype is a single-user demo with its own sample data in state (`prototype/src/`), which is exactly what the project rules forbid copying; the brief's section 4a is the requirement. (Searched the prototype for sample or seed data: its `useAppState.ts` initial state is demo content for the AI Studio screen, not a feature.)

## What the visitor sees
1. **Landing page: a "Try the demo" button** beside "Get started". It opens a sheet (the app's own `ActionSheet`: from the bottom on a phone, a dialog on a bigger screen) asking which kind of maker is closest: Baker, Woodworker, Seamstress or Ceramicist, each with a line about what they make. No sign-up.
2. Tap one: "Setting up the baker…" for a few seconds, then **Home of a demo business** with a strip across the top: "Demo: Baker. Try anything; it is cleared in 6 hours." with **Start the demo over** and **Start your own**.
3. Everything works as in a real business, with sample content: business details and a made-up logo, five customers, materials, and products with variations, extras and what they cost to make (so the margin shows).
4. **Start the demo over** throws the demo away and builds a fresh one of the same kind. **Start your own** signs out and goes to sign-up.
5. After 6 hours the demo is over: the next page goes to the landing page with "Your demo has ended."
6. A maker who is signed in in this browser and taps a demo is asked first: a browser holds one sign-in, so the demo would sign them out here (their business and data are untouched; they sign in again with their email link). "Sign out and try the demo", or Cancel; a private window works too.
7. In a demo: no account to delete (an anonymous visitor has no email), and no document reader (it is paid).

## Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new (and why) |
| --- | --- | --- |
| Four choices on the landing page | `Button` cards in a list (the app's outline buttons) | As is |
| A strip with two actions | `Button` | New banner component: nothing like a persistent strip exists; it is a plain region with two buttons |
| Sample data | the app's own tables and `save_product_layers`, as the visitor | As is: the builder writes through the same paths a maker uses |
| Logo | `processImage` + `insertImage` (the usual logo path) | As is |
| Message "demo ended" | `Alert` | As is |

Inputs by kind: none (choices only).

## Decisions (with a recommendation)
1. **A private sandbox per visitor** (founder's decision), made with Supabase **anonymous sign-in**: the visitor is a real signed-in user with no email, owner of one business flagged `demo_kind` with `demo_expires_at` (6 hours). *Recommended: nothing else is needed to keep demos apart: row-level security already isolates businesses.*
2. **Only an anonymous visitor can make a demo** (`create_demo_organisation` checks the token's `is_anonymous` claim), so a real business can never be flagged as a demo (which would make it deletable by the clean-up) and a maker cannot get a free sandbox beside their account.
3. **The builder runs as the visitor**, not with the server key, through the same tables and functions as the app; it refuses to run on a business that is not a demo and runs once. Sample content lives apart from product paths (`lib/demo/content.ts`).
4. **Four kinds, not five** (baker, woodworker, seamstress, ceramicist). A printer needs quantity prices and a heavier setup; easy to add (one content block).
5. **No issued invoices in a demo.** An issued invoice is never deleted and a business that has one cannot be deleted (the immutability rule), so a demo with one could not be cleaned up. Slice 2 shows an invoice **draft** (mutable, deletable) instead. *Do not "fix" this by making demo invoices deletable: that would put a hole in the invoice immutability.*
6. **Clean-up:** a daily scheduled route (`/api/cron/demo-cleanup`, needs `CRON_SECRET`) plus a few at each new demo start, using the same `delete_account` as the Settings page, then the anonymous sign-in. The scheduler runs once a day on the free plan, so demos live up to a day past expiry, but an expired demo is unusable at once (the app checks the expiry on every page).
7. **Limits against abuse:** at most 300 live demos (the database refuses more, errcode 54000, shown as "busy"); Supabase's own limit on anonymous sign-ins per address (30 an hour, in `config.toml`). **Not done: bot protection (CAPTCHA)** (needs Turnstile keys from the founder; `docs/security-notes.md`, hardening item 1). Do this before the landing page link is shared widely.
8. **Start over** = delete this demo and make a new one (not "reset rows"), so there is one code path for building.

## Data
`organisations.demo_kind`, `demo_expires_at` (both set or both empty; readable by members; not writable through the app); `create_demo_organisation(kind, name)` (anonymous visitors only). No new table. **Needs human review** (see Status). Tests: `supabase/tests/demo_accounts.test.sql`.

## Slices
1. **Built:** the above, with the sample business, logo, customers, materials and costed products.
2. **Built:** a draft quote with the margin showing, a sent quote, and an accepted quote with its job in progress and an invoice draft, per kind. Each goes through the same server actions a maker's taps do (save, send, record the answer, make the job, start the invoice), called by the builder as the visitor, so numbers, frozen versions and costing are exactly the app's; the server key is used only where the app itself uses it (sending, making a job).
3. **Later:** a printer demo; CAPTCHA; "turn this demo into my account" (link an email to the anonymous user, keeping what they did).

## Tests
- Unit: kinds, words, time left; every demo's content satisfies the same rules the forms enforce (phone, email, VAT number, province, postal code, units, cost lines in a matching unit, whole-cent prices, variations' lowest price).
- SQL: only anonymous visitors, flags set and not changeable, a real person cannot, signed-out role cannot, a second call returns the same demo, the cap.
- Browser (`e2e/demo.spec.ts`): pick a kind and land with content, banner, logo, no account to delete and no reader; start over; a signed-in maker is refused; an expired demo is over; the clean-up route needs its secret and removes it. Accessibility: the landing page with the picker and after "ended", and a demo's Home, products and materials.

## Questions for the founder
- Turn on **anonymous sign-ins** in the hosted Supabase project (Authentication, Sign In / Providers) and set `CRON_SECRET` in Vercel. Without the first the demo cards say "something went wrong"; without the second the daily clean-up is off (demos still expire and are cleaned up as new ones start).
- CAPTCHA keys (Cloudflare Turnstile) before sharing the link widely.

## Not planned yet
Letting a visitor keep their demo as a real account.

## Missed from the prototype
(none; no counterpart)
