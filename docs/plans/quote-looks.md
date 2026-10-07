# Plan: how quotes look (pictures, then designs)

Status: **approved in outline 2026-10-07**. Slice 1 (pictures) built; slice 2 (designs) next. Founder's brief: "finish quotes as a whole: quote design templates, product images on quotes"; photos first planned for the database, then moved to Supabase Storage the same day (ADR 0007); "5 design themes, made up of customizable components. Look at the prototype for inspiration. We can work through this more. Beautiful quotes that look custom-branded are a major differentiator. Makers care about aesthetics."

Two slices, each its own PR with its own migration (needs human review):

1. **Pictures:** one photo per product, a logo for the business, both shown on quotes.
2. **Designs:** five themes built from components, a brand colour, a design chosen per quote with a business default, and a live preview.

Reference for the look (not code to copy): `prototype/src/data/quoteTemplates.ts` (seven presets built from fonts, colours, banner, table header, row and total-box styles) and `prototype/src/components/TemplateCustomizerModal.tsx` (presets, fonts, colours, layout, table tabs).

---

## Slice 1: pictures

### What the maker sees
- **Product photo:** the Photo "coming soon" card on the product form becomes real. Take or choose a picture; it is cropped square and shown on the form. Replace or remove it. Services have no photo (as before).
- **On the quote:** a small square thumbnail beside each item that is a product with a photo, on the PDF and on the on-screen document. A **Show product photos** switch on each quote (on by default). Items without a photo, one-off items and services show no thumbnail, and the text lines up the same either way.
- **Logo:** a **Logo** card on the Quotes and invoices page (how documents look is there, not in the Business profile; see CLAUDE.md). Upload, replace, remove. It prints at the top of the quote, beside the business name.
- Plain errors: a file that is not a picture, or too large to read, says what to do; the previous picture is kept.

### Decisions
1. **Stored as files in Supabase Storage, with a record in the database** (founder, 2026-10-07: first agreed to the database "if quality isn't too compromised", then asked whether storage was inevitable; it is, so it was changed before anything shipped; ADR 0007). Each upload is turned into two small renditions: a **display** copy (up to 1200 px on the long side, JPEG quality 85, about 150 to 250 KB), kept for bigger views that are coming (a product page, hosted quotes) and not shown anywhere yet, and a **thumbnail** (400 px square crop, quality 85, about 25 KB) for quotes. 400 px is more than a quote's ~1 inch thumbnail needs, even at print resolution. Logos keep their shape (not cropped), and keep transparency (PNG) up to 600 px. The files are in a private bucket and the `images` table records each one.
2. **Images are never changed or deleted.** A replaced or removed photo only stops being pointed at. A sent quote's frozen snapshot records the image ids it used, so it keeps its pictures forever. (Orphans are small; a clean-up can come later.)
3. **Resize in two places.** The browser shrinks the picture to 1600 px before uploading (phone photos are 4 to 8 MB and the host rejects bodies over 4.5 MB); the server then makes the final renditions with `sharp`, applies the camera's rotation, strips location and other metadata, and only accepts what it can really decode as JPEG, PNG or WebP.
4. **Access:** members of the business can read and add images (row-level security, `session_required`); nobody can change or delete one. Pictures are served by an authenticated route, `/app/images/[id]`, with long-lived private caching (an image never changes under its id). Hosted quotes (later) will add a signed link for customers.
5. **One picture per product for now.** More pictures, variations with their own pictures and per-line "hide this picture" come with variations.

### Database
- `images` (organisation_id, kind `product` or `logo`, content type, pixel size, the byte size of each file, created_by, created_at). Insert and select for members, no update or delete. Size checks (display 700 KB at most, thumbnail 150 KB at most) and a cap of 600 pictures per business (nothing is deleted, so without a cap one account could fill storage).
- The private `pictures` bucket (JPEG and PNG, 700 KB per file), with rules on `storage.objects`: members of the business read its files; a file can only be added for a picture record that exists for that business, at exactly `<business>/<picture>/display` or `/thumb`; nothing can be updated or deleted.
- `products.photo_image_id`, `business_profiles.logo_image_id` (composite foreign keys with the organisation, so a business can never point at another's image).
- `quotes.show_photos boolean not null default true`; `save_quote_draft` replaced to carry it (a payload without it keeps the draft's value).

### App
- `lib/images`: validation and the sharp pipeline (server only), the id and size rules.
- `POST /app/images` route (multipart), `GET /app/images/[id]`.
- Product form: photo field (client resize, upload, preview, replace, remove). Product list shows a small photo when there is one.
- Quote snapshot: each line may carry `photoImageId`; the snapshot's business carries `logoImageId`; the document code loads those renditions and the PDF draws them.
- Quotes and invoices page: the Logo card.

### Tests
Unit (pipeline on real sample images: rotation, size, metadata stripped, transparency kept, rejects non-images and huge files), SQL (members only, immutable, same-business references), browser (upload a product photo and a logo; photo on the quote; switch off; sent quote keeps it after the product's photo changes), accessibility.

---

## Slice 2: designs

### What the maker sees
- **Five designs**, each a complete look, in the Design section of the preview and as the default under Quotes and invoices:
  1. **Classic** (today's: clean, black on white)
  2. **Modern**: lots of air, one thin accent line, small capitals
  3. **Warm**: cream paper, serif headings, soft accent
  4. **Bold**: a solid brand-colour header band with reversed text, strong totals
  5. **Soft**: rounded, light tinted blocks, friendly
- **Make it yours**, on top of any design (each is a component, changed on its own): the **brand colour** (swatches plus any colour), the **heading font** (sans or serif; more later), whether the header is plain, a top bar or a full band, the table heading style, the totals style, and the corner roundness. Changing one never breaks the others. "Reset to the design's own look" is one tap.
- **Live preview** (the PDF drawn on screen, as today) updates as they pick. The choice is per quote, with a **business default** that new quotes start with.
- The logo from slice 1 appears in each design's header.

### Decisions
1. **A design is a named set of component choices plus colours** (like the prototype's template styles, held as data), not five separate layouts. The renderer reads a resolved theme: header style, table header style, row style, totals style, fonts, colours, roundness, spacing. Adding a sixth design later is adding data.
2. **A sent quote freezes the resolved theme** (all the values, not just a name), so changing the business's brand colour or the design's definition never alters a quote already sent. Today's snapshots without a theme are drawn as Classic, exactly as they were.
3. **Fonts that ship in the PDF:** Noto Sans (have) and Noto Serif (new, open licence), regular and bold, covering the same South African letters. A display or script face can come later if makers ask.
4. **Accessible colour is the maker's brand, but legible is our job:** when the brand colour is too light for text or for white text on it, the design uses a darker shade for text and chooses black or white for text on the colour automatically.
5. **Where it lives:** the default design, brand colour and component choices are set under **Quotes and invoices, Look** (owners and admins); each quote can pick a different design in its Design section. Invoices will reuse the same theme.

### Database
- `business_profiles`: `brand_color`, `default_design`, `design_options` (jsonb, validated), with owner/admin update grants. `quotes.design`, `quotes.design_options`. `save_quote_draft` carries them.

### Tests
Unit (theme resolution, contrast rules, each design renders, an old snapshot still renders as Classic, a frozen theme is unaffected by later changes), browser (pick a design, change colour, see the preview change, send, change the brand colour, the sent version is unchanged), accessibility.

---

## Not in these slices
Per-line hiding of a photo, several photos per product, product photos in the item picker (a later nicety), customer-facing hosted quotes, emailing, user-uploaded fonts, drag-and-drop layout editing, saving "my own named theme" (the prototype's custom templates; the business default plus per-quote options covers it for now).
