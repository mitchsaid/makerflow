# ADR 0007: Pictures are kept in the database, as two small copies

Status: accepted 2026-10-07 (founder: "fine with this if quality isn't too compromised"). Plan: `docs/plans/quote-looks.md`.

## Context
Quotes now show a small photo beside each product and the business's logo. Pictures need somewhere to live, be readable by the server that draws the PDF, and never change once a quote has been sent with them. Supabase offers file storage with a CDN, but its storage service is not part of the local stack and the tests, so using it means more moving parts for the same result at this size.

## Decision
- Each upload becomes two renditions made by the server with `sharp`: a **display** copy (a product photo up to 1200 px on the long side as a JPEG at quality 85; a logo up to 600 px as a PNG, keeping transparency) and a **thumbnail** (a 400 px square crop for a photo; 300 px for a logo). The original is never stored. The rotation from the camera is applied and location and other hidden details are dropped. A 400 px thumbnail is far more than the roughly one-inch square it is printed at, so quote quality does not suffer.
- They are stored as `bytea` in an `images` table (migration `20261013100000`), with size checks (display at most 700 KB, thumbnail at most 150 KB), a check that the bytes really start like the JPEG or PNG they claim (so nothing else can be stored through the API), and a cap of 600 pictures per business (nothing is deleted, so without a cap one account could fill the database). A typical photo is 150 to 250 KB for the display copy and about 25 KB for the thumbnail. Today only the thumbnail is shown (the quote and the lists use it); the display copy is kept for the bigger views that are coming (a product page, hosted quotes), so it is storage ahead of use.
- **Images are immutable and never deleted.** Members of the business can read and add them; nobody can update or delete one. A product's or the business's pointer to a picture is replaced or cleared, and the picture itself stays, because a sent quote's frozen snapshot names the picture ids it used.
- The browser shrinks a picture to 1600 px before sending it (phone photos are 4 to 8 MB and the host refuses bodies over about 4.5 MB). The server only accepts what it can decode as JPEG, PNG or WebP, judged by the bytes and not the file name (so SVG, which can carry scripts, and GIF are refused).
- Pictures are served by an authenticated route, `/app/images/[id]`, with long private caching (an id never changes), `nosniff` and a locked-down content security policy.

## Consequences
- Backups and the database grow by the size of the pictures (at maker scale, hundreds of pictures, tens of megabytes). If that ever stops being comfortable, the table moves to file storage without changing the app: everything goes through `lib/images`.
- Orphaned pictures (uploaded and never attached, or replaced) stay. They are small; a clean-up that removes pictures no product, logo or snapshot refers to can come later.
- Hosted quotes (customers opening a link) will need a signed link for pictures, since the route today is for people in the business.
