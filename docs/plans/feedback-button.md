# Plan: a "Send feedback" button

Status: **built 2026-10-31.** Founder, 2026-10-31, on getting ready to test with real makers: "Add the feedback button." Changes the database (one new table): **needs human review** (migration `20261130100000_feedback.sql`).

## Prototype read
No prototype counterpart. A search of `prototype/src` for feedback found no screen or state that collects words from the person using the app. Nothing to keep, change or drop.

## What the maker sees
- A row on the **More** tab, **Send feedback** ("Something not working, or an idea? Tell us."), and, on wider screens (which have no More tab), an entry at the foot of the sidebar. Both open the same sheet.
- The sheet is short: **It's about** (*Something isn't working*, *An idea*, *Something else*), **Your message** (what happened, or what would help; say which screen if you can), a tick **You can email me about this** (on), and **Send feedback**.
- The button stays pressable. With nothing typed it says at the field and in a summary what to do ("Tell us what happened or what would help, even in a few words."). Typed words are never lost: closing the sheet before sending keeps them.
- Sent: "Thank you. We read every message." (and "We may email you if we have a question", when the tick was on), then **Done**. The next one starts empty.
- Nothing about it is read back to the maker, and it never appears in a document.

## What is kept
The words and the kind; the **page** they were on (a path like `/app/quotes/…`, nothing typed); the **screen size** and **browser** they were using (so "it looked wrong" can be found); who (their account) and which business; when. Their **email address** only when the tick was on (it is their account address, never a typed one).

## Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new |
| --- | --- | --- |
| A place for it | The **More** tab's list, and the desktop sidebar | One more row / entry |
| A short form in a sheet | `Sheet` as in *Add a way to pay* | As is |
| Asking for words | `TextAreaField`, `SelectField`, a tick, `FormSummary` and `FormErrorScope` (ADR 0005) | As is |

Inputs by kind: a long text (the message), a choice of three (the kind), a tick.

## Decisions (with a recommendation)
1. **Write-only for the app.** A member can add feedback for their own business, as themselves; nobody can read, change or delete it through the app (no select, update or delete grant). *Recommended*: a person's words and email never leak through a row-level-security mistake, and the people who run MakerFlow read it in the Supabase dashboard or with the service key (`docs/runbooks/reading-feedback.md`).
2. **At most 10 an hour per person** (a trigger), so a stuck button or a script cannot fill the table.
3. **The email is the account's, and only when ticked.** A typed address could be someone else's.
4. **Not built:** a screenshot, a notification when feedback arrives (there is no sending domain yet), a page that lists it inside the app, and a reply from the app. Reading the table is enough for the first testers.

## Data (migration `20261130100000_feedback.sql`)
`feedback (id, organisation_id, user_id, kind, message, page, user_agent, viewport, contact_email, created_at)` with checks on every text length and the viewport's shape; row-level security with one insert policy (`is_org_member(organisation_id) and user_id = auth.uid()`) and the restrictive `session_required` policy; column grants for insert only; the rate limit trigger. `user_id` clears if the account goes (the message stays) and a trigger then clears the email address with it; the business going removes it. Tests: `feedback.test.sql`.

## Tests
- Unit: parsing (`feedback.test.ts`).
- SQL: own feedback in; as someone else, for another business, empty, too long, a bad viewport or kind refused; nothing readable, changeable or deletable; the hourly limit; another person's limit their own.
- Browser: `e2e/feedback.spec.ts` (More, the sheet, the empty problem, the kind and tick, sent, the next one empty; closing keeps what was typed), and an accessibility case (the row, the sheet, a problem, sent).
