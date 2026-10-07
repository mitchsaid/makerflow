# ADR 0007: Pictures live in Supabase Storage, as two small copies, with a record in the database

Status: accepted 2026-10-07, revised the same day. Plan: `docs/plans/quote-looks.md`.

The first version of this decision kept the pictures themselves in Postgres (as `bytea`), which was simplest to build and test. The founder questioned it ("isn't it inevitable they'll need to be on Supabase eventually?"). It is: hosted quotes will need to serve pictures to customers who are not signed in, pictures will multiply (several per product, variations, a Shopify import), and file storage is built for that and is far cheaper per gigabyte. Nothing had been deployed, so the change was made before merging. The file name of this ADR is kept so that links to it still work.

## Decision
- Each upload becomes two renditions made by the server with `sharp`: a **display** copy (a product photo up to 1200 px on the long side as a JPEG at quality 85; a logo up to 600 px as a PNG, keeping transparency) and a **thumbnail** (a 400 px square crop for a photo; 300 px for a logo). The original is never stored. The camera's rotation is applied and location and other hidden details are dropped. A 400 px thumbnail is far more than the roughly one-inch square it is printed at, so quote quality does not suffer.
- The two files go in a private storage bucket, `pictures`, at `<business id>/<picture id>/display` and `<business id>/<picture id>/thumb`. The bucket accepts only JPEG and PNG and files up to 700 KB.
- Each picture also has a record in an `images` table (migration `20261013100000`): its business, kind, content type, size and the byte size of each file. Products and the business's profile point at this record (composite foreign keys, so a business can never point at another's picture). The record, not the file, is what everything refers to.
- **Pictures are immutable and never deleted.** A sent quote's frozen snapshot names the picture ids it used. Members of a business can read and add pictures; nobody can update or delete a record or a file (no such policies exist on the table or on the bucket). Replacing or removing a photo only changes what a product points at.
- **The bucket's rules** (policies on `storage.objects`): reading needs membership of the business named in the path; adding a file needs a record for exactly that business and picture, and the name must match the pattern exactly (so at most two files per record); a revoked session can do nothing there. Records are capped at 600 per business, because nothing is deleted.
- The server uploads and reads with the signed-in person's own session, so nothing here needs the server key.
- The browser shrinks a picture to 1600 px before sending it (phone photos are 4 to 8 MB and the host refuses bodies over about 4.5 MB). The server only accepts what it can decode as JPEG, PNG or WebP, judged by the bytes and not the file name (so SVG, which can carry scripts, and GIF are refused). When a quote is drawn, any file whose bytes are not really the type it claims is left out rather than breaking the PDF.
- Pictures are served by an authenticated route, `/app/images/[id]`, with long private caching (an id never changes), `nosniff` and a locked-down content security policy. Hosted quotes (later) will use signed links to the files.

## Consequences
- The local and CI stacks now run the storage service, which makes them a little heavier.
- Drawing a quote fetches its pictures from storage (a few small files) instead of reading rows.
- Orphans stay: a record whose upload failed, or a picture that was replaced. They are small; a clean-up that removes pictures no product, logo or snapshot refers to can come later.
- Today only the thumbnail is shown. The display copy is kept for the bigger views that are coming (a product page, hosted quotes).
- If the pictures ever need to move again (another provider, a CDN in front), everything goes through `lib/images`.
