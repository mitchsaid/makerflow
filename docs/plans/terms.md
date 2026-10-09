# Plan: one "Terms" (policies and the terms box merged)

Status: **agreed with the founder 2026-10-09** ("Yes, do that": one concept called Terms, titles optional). Replaces the split in `quote-wording.md` (a free-text Terms box) and `quote-policies.md` (a library of titled policies). The migration moves data and needs human review.

## Why
Since the fixed policy headings went (2026-10-06) a policy is "a title and some wording", which is what a term is. Both said similar things (a "changes" starter line and a "changes" example policy), and the document showed them together ("Terms and policies", then "Other terms" in small print). The split only made sense to us.

## What the maker sees
- **Quotes and invoices > Terms** (the library, was "Quote policies"): each term has an optional title, its wording, and "include on new quotes". Examples to start from (the locale pack's policy examples plus the old one-tap lines such as "Please allow [2 weeks] to make your order"), the business's own kinds first. Owners and admins change the library; everyone can use it.
- **On a quote, one "Terms" section** (was "Policies" plus the Terms box): the library as ticks (those marked "include on new quotes" start ticked; an untitled one is named by its wording), each editable for this quote, and **"Add a term just for this quote"** for a one-off (an optional title and its wording) that isn't saved to the library. **"Save a new term"** (to the library, in a sheet) stays for owners and admins.
- **On the document, one "Terms" section:** each term under its title, or as a plain paragraph when it has none, in the same readable size. Versions sent before keep exactly what they showed ("Terms and policies" and "Other terms"): they are frozen.
- The Terms box under Quote wording, and the per-quote Terms box, are gone.

## Names
On screen everything is "Terms". In the code and the database a term keeps its older name, a policy: the `policies` table, `quotes.policies`, `lib/policies`, and the library's address `/app/documents/policies`. Renaming those would touch every file and old link for no change the maker sees.

## Data (migration `20261023100000_terms.sql`)
- The library keeps its table name (`policies`) and the quote its column (`quotes.policies`): only the words on screen change. A term's `title` becomes optional (null or 1 to 80 characters); wording up to 4000 characters (was 2000, the Terms box allowed 4000) and 80 lines.
- **Moves:** each business's default terms text becomes an untitled library term, included on new quotes, last in the list; each quote's own terms text (drafts and sent rows alike: a sent row is the copy a revision starts from) becomes an untitled term at the end of that quote's terms. Then `quotes.terms` and `business_profiles.default_terms` are dropped, and `save_quote_draft` is replaced without them.
- Up to 20 terms on a quote (was 12 policies), since the old box is now one of them.
- Moving the text does not change a quote's "last changed" time (lists sort by it, and sending checks it).
- Snapshots keep their `terms` field for old versions; new versions don't write it, and freeze the heading "Terms" (`wording.termsHeading`, from the locale pack). A version without that heading is drawn as before.
- An older app still open on a phone may send the old Terms box with a draft: the server adds it as an untitled term at the end, so nothing typed is lost. The same happens when discarding a revision started before the change (its stored copy has the old box).

## Tests
Unit: optional titles, the longer wording, one-off terms, the payload; the document with titled and untitled terms and an old snapshot with "Other terms". SQL: the moves (a default, a draft and a sent row), the optional title, the dropped columns. Browser: the library (add with and without a title), a quote with library and one-off terms, the document. Accessibility: the library and the quote's Terms section.
