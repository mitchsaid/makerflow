# Plan: discard a revision

Status: **built 2026-10-08** (founder: "Yes", to doing discard a revision and line VAT next). The migration `20261017100000_discard_revision.sql` needs human review: a replaced and a new service-role-only function that change a quote's status and version, and new columns on the activity log.

## What the maker sees
- On a quote being revised (version 2 or later, a draft), a **Discard this revision** button under the quote, with one line saying what it does. It asks first ("Everything you've changed since version 1 was sent is dropped, and this goes back to version 1. This can't be undone.") with **Yes, discard the changes** and **Keep editing**.
- After a yes the quote is **Sent** again at the earlier version, exactly as it was sent: the items, prices, wording, policies, deposit and dates. The activity log says "Revision discarded: back to version 1". Revising again starts version 2 again from what was sent.
- The sent versions are never touched. The quote number does not change. Nothing is sent to the customer.
- A revision begun before this existed (only on the dev site) has no kept copy and does not show the button.

## How it works
- The draft's rows are the same rows that were sent, so editing overwrites them. When a quote is revised, the server saves the quote as it stands (the form values it already knows how to save) with the "revised" entry in the activity log (`quote_events.base`, up to 200 KB, only on a `revised` event). `has_base` says one was kept, so pages do not read the copy itself.
- **Discard** (server action `discardRevision`): the person's own session proves the quote is theirs and reads the copy; the copy is saved over the draft with the ordinary draft save (checked and priced like any save; a product that has since been removed leaves a one-off item); then `discard_quote_revision` (service role only, like `send_quote`, `revise_quote` and `record_quote_outcome`) moves the quote back to `sent` at the earlier version and logs `discarded` at the dropped version. If the restore fails nothing is discarded and the revision is still there.
- Not restored: the look (theme) chosen during the revision stays as it is on the draft. It does not change the sent version, which is frozen, and the next revision starts from it.

## Tests
SQL (`quote_discard_revision.test.sql`): signed-in users and anon cannot call it; a first draft and a sent quote cannot be discarded; the copy is kept on the revised event only; another business cannot discard; the version and status go back, the sent version stays, the event is logged; discarding twice is refused; the next revision is version 2 again; the log is members-only. Browser: revise, change, ask, keep editing, discard, the totals are the sent ones, revise again. Accessibility: the question.
