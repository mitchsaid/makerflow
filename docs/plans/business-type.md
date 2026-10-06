# Plan: "What do you make?" (business type that tailors the examples)

Status: **decisions confirmed by the founder 2026-10-06; plan awaiting approval. Nothing built.** Touches the database (one new column on `business_profiles`), so it needs human review. Fits into `docs/plans/onboarding.md` as its first screen after the business name.

## Why
The policy examples (and the terms and unit suggestions) are either too generic to help or, if made specific, too long to scan. One answer about what the maker makes lets us put the examples that fit first, without hiding the others.

## Decisions (founder, 2026-10-06, all the recommended options)
1. **One optional screen after the business name**, with Skip. If skipped, a dismissable prompt asks again on the policies page. Always changeable in the Business profile. It will later merge with the planned "Where shall we start?" screen.
2. **Pick any that apply.** A baker who also teaches workshops picks both; their examples are combined, most relevant first.
3. **First version changes three things, all already fed from the country pack or generic lists:** the policy examples, the terms starters and the unit suggestions. Sign-off suggestions and empty-state examples come later.

## What the maker sees
- **Onboarding, after the business name:** "What do you make or sell?" A set of tick-able types (below), "Something else", and Skip for now. Plain line under it: **"We use this to show examples that fit your business, and nothing else. You can change it any time."** After answering, nothing else changes in the flow (it goes on to Home as today).
- **Policies page:** "Examples for you" first (those that fit their types), then "More examples" (the rest, never hidden). A short line says which types they are showing ("Showing examples for baking and workshops. Change"). With no type, the list is today's.
- **Quote builder and Business profile wording:** the terms starters and unit suggestions are ordered the same way (matching ones first, the rest still there).
- **Business profile:** a "What you make" section (owners and admins), the same ticks.
- **Skipped?** A dismissable card on the policies page: "Make the examples fit your business", with the ticks. Dismissing is remembered (the existing `prompt_dismissals` table).

## The types (proposed, universal; edit freely)
Food and baking · Jewellery and accessories · Clothing and sewing · Flowers and plants · Candles, soap and beauty · Ceramics, wood and leather · Art, prints and photography · Workshops and classes · Something else.
The list and its labels are plain code (`lib/business-types.ts`): they are not country-specific. The example wording per type is country-specific and lives in the locale pack.

## How the tailoring works
- Each pack example (and each terms starter) lists the types it fits, or none (fits everyone). A maker's list of types ranks them: matching first, then the rest in their usual order. Nothing is removed.
- New type-specific examples for South Africa in the first version (about six, drafted only from consumer-law points already read in `docs/locales/za/consumer-policies.md`; anything beyond that is marked unverified): food (storage and serving; collection and delivery), jewellery (resizing and care; engraving), clothing (measurements and alterations), flowers (seasonal substitutions), candles and soap (safe use). **A South African legal adviser must check these with the rest.**
- Units: reorder, and add a few (tier, bunch, stem, person, sheet).

## Data
- `business_profiles.business_types text[]`, **null = never asked, empty = asked and skipped, otherwise the chosen type keys** (`'other'` for "Something else"). Checked in the database for at most 10 entries and a small total size; the list of valid keys is checked by the app (so adding a type needs no migration). Same row-level security as the rest of the profile: members read, owners and admins change; new column grant for update. Loaded with the workspace in the existing query, so no page gets slower.
- No change to who can see what; the answer is a fact about the business, visible to its members, **never used for marketing, and not sent anywhere**.

## Flow change
After `createBusiness` the maker goes to the type screen (`/onboarding/type`), then to Home. Nobody is trapped: closing the tab before answering is the same as skipping (null is treated like empty). No redirect guard is added to protected pages. The browser-test sign-up helper presses Skip on the new screen.

## Tests
Unit: ranking and the types validator (unknown keys refused, duplicates removed, none allowed). SQL: column grant, size limit, member cannot change, null versus empty, `session_required` unchanged. Browser: pick types and see the order change; skip and see the prompt, dismiss it; change in the Business profile; the sign-up flow with and without an answer. Accessibility case for the new screen and the profile section. `pnpm perf` unchanged.

## Not built
Sign-off suggestions and empty-state examples by type; policies pre-ticked by type; "Where shall we start?" (still `docs/plans/onboarding.md`); a free-text "tell us what you make"; anything that uses the answer outside the app.

## Unverified / watch
- How people will answer: the screen says what the answer does, and the policies page shows the effect ("Showing examples for ..."). Look at what people pick once there is real use.
- The type list is a first guess; it should be tuned with real makers.
