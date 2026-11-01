# The document reader ("Coming from another tool?")

What it is: a maker uploads one recent quote or invoice (a PDF, or a photo or screenshot), an AI service reads it, and the Business profile form comes up with what was found already filled in, to check and save. Items found go to the product import's check. Built in `docs/plans/import-onboarding.md`, slice 2.

It is **off until a key is set**, like Google sign-in. With no key the onboarding step and the Business profile button are not there and nothing else changes.

## Switching it on (founder)
1. Create an API key at the AI provider's console (Anthropic), for a project used only for MakerFlow. **Set a monthly spend limit on that account first.** The app also limits itself (below), but the account limit is the real cap.
2. Add it in Vercel, Settings, Environment Variables, as `ANTHROPIC_API_KEY` (server only: no `NEXT_PUBLIC_` prefix). Optional: `READER_MODEL` to use another model than the default.
3. Redeploy. Never put the key in the repository, a chat or a document.

## What it does and does not do
- The file is checked by its first bytes (PDF, PNG, JPEG, WebP), at most 4 MB (phone photos are shrunk in the browser first), sent once to the AI service, and **not stored** by MakerFlow. Nothing about the document or the answer is logged; only a failure's reason is.
- The answer is untrusted text. It is cut down to a fixed shape; each value is kept only if the Business profile form's own checks accept it (a VAT number must pass the country's check, a province must be one of the country's). It can only fill in a form; saving is the ordinary save.
- The business's own name is never overwritten, and what the maker has already saved is never replaced.
- Customer details on the document are not asked for. The screen says plainly that the document goes to the AI provider.
- Only owners and admins can use it (they are the ones who can change the business details).

## Limits (in the database: `document_reads`, migration `20261201100000`)
Each read is counted **before** it is made, so a failed read still counts: at most 5 an hour for one person and 20 a day for one business. Past that the maker is told to try later or fill the details in by hand. Change the numbers in the migration's trigger (a new migration).

## To settle before real makers use it
- The provider's data-handling terms, and our privacy policy and POPIA wording (the privacy policy page is still to be written). **Needs the founder.**
- Accuracy and cost on real documents: nothing here has run against the real service. Run the experiment in `docs/plans/onboarding.md` ("Extraction experiment") with real sample documents, then decide whether a cheaper model will do.
- How long a read takes on Vercel's Hobby plan (the page asks for up to 60 seconds).

## Running the experiment (on your own computer)
Settles which model to use, and how far to trust the reader, with your makers' real documents.
1. Put 10 or so real quotes and invoices (PDF, or a photo or screenshot) in a folder **outside the repository**. Never commit them.
2. Optional, for accuracy: beside any document add `<same name>.expected.json` with just what you want checked, for example `{ "businessName": "Sweet Crumbs", "business": { "phone": "082 555 0101", "city": "Cape Town", "vatNumber": "4123456789" }, "items": [ { "name": "Chocolate cake", "priceCents": 45000 } ] }`. Without it you still get what was found, to check by eye.
3. Run `ANTHROPIC_API_KEY=... pnpm reader:experiment <folder>` (from `app/`). It runs every document through **Sonnet 5.5 and Haiku 5.5** (change with `READER_EXPERIMENT_MODELS=claude-haiku-5-5,claude-opus-5-5`) and writes `reader-experiment-report.md` in the folder: time, cost, fields right and items found, side by side, and every wrong field. It refuses to run in CI or on a server, and **it spends real money** (about a cent a document on Sonnet), so set a spend limit first.
4. If Haiku gets the same fields right, set `READER_MODEL=claude-haiku-5-5` in Vercel. If it drops fields or confuses the seller with the customer, keep Sonnet. The cost figures use cached prices: check the provider's price page.

## Testing
The browser tests start a stand-in service (`e2e/fake-reader.mjs`) and point the app at it with `ANTHROPIC_BASE_URL`; a document containing BUSY, NOTHING or GARBAGE makes it answer that way. Unit tests (`lib/reader`) cover the file check, the cleaning of the answer, the request that is sent and each way the service can fail.
