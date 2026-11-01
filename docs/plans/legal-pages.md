# Plan: privacy policy and terms of use (a draft, for review)

Status: **built 2026-11-01 as a draft; needs the founder's and a lawyer's review before real makers use it.** Founder, 2026-11-01: "OK do those" (item 2 of the five). The document reader (a maker's document goes to an outside AI service) and the demo (an anonymous sign-in) both need something plain to point at, and POPIA expects it.

## Prototype read
No prototype counterpart. The prototype has no privacy or terms page (searched `prototype/src` and `prototype/index.html` for privacy, terms, POPIA and consent: nothing).

## What the maker sees
- **`/privacy` and `/terms`**: public, readable on a phone, in plain language, each with a note at the top that it is a draft not yet checked by a lawyer, and a link to the other.
- **Linked from:** the landing page (a quiet "Privacy · Terms" line), the sign-in page ("By continuing you agree to the terms and the privacy policy"), the More tab ("Privacy and terms") and the document reader's screen ("How it is handled", straight to that section).
- **What the privacy page says** is checked against the product: what is kept (account, business, work, feedback, a count of reader uses), no analytics or tracking cookies, the three outside services and where they are (Supabase in the EU, Vercel in Dublin, Anthropic in the US and only if the reader is used), that an uploaded document is not stored by us, that a demo is deleted after about six hours, how long things are kept and what deleting an account does, POPIA rights and the Information Regulator, and the two roles (we are the responsible party for the account; the maker is for their customers' details and we are the operator).
- **The terms** cover: using the service while it is early, the account, that everything the maker enters stays theirs, what the maker is responsible for (what they send customers; this is **not** tax, legal or accounting advice; acceptable use), the demo, "as is" with a limit of responsibility that leaves Consumer Protection Act rights alone, ending, and South African law.

## Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new (and why) |
| --- | --- | --- |
| A note at the top | `Alert` | As is |
| A list of services | cards like the More rows | As is (same card look) |
| Links | `Link` | As is |

Inputs by kind: none.

## Decisions (with a recommendation)
1. **A draft, and says so.** The wording is mine, grounded in what the app does; it is not legal advice. *Recommended: have it checked by a South African lawyer before launch*, and remove the note then (one line in `components/legal-page.tsx`).
2. **The words live in `lib/legal/`** (data, not scattered in screens), with a unit test that checks the claims against the code: the three services are the ones the app uses, there is no analytics library (the day one is added, this fails and the policy must change), and the reader's "not stored" claim is there.
3. **The contact address is a setting** (`NEXT_PUBLIC_LEGAL_CONTACT_EMAIL`); until it is set the page says it will be added and points to Send feedback. **Needs the founder.**
4. **Not done here (need the founder):** the legal entity's name and registration number, the Information Officer's details (POPIA requires one to be registered), and the cookie banner question (none is needed while only sign-in cookies are used).

## Tests
Unit (`lib/legal`): sections well formed; the services named are the ones used; no analytics library; the claims about the reader and the demo; the contact setting. Browser: both pages load signed out with their sections and the draft note; the links from the landing page, sign-in page, More tab and the reader. Accessibility: both pages (light and dark).

## Missed from the prototype
(none)
