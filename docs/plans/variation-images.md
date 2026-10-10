# Plan: a picture for each variation choice

Status: **built 2026-10-10** (founder request: "variations should have an option for their own image"). Changes the database (two nullable columns and `save_product`): needs human review.

## What the maker sees
- On the product form, every choice of a variation has a small square button before its name: an image icon, or the picture once chosen. Pressing it picks a file (uploaded at once, like the product photo); with a picture, pressing it replaces it and a **Remove picture** button appears beside the price.
- This is the same for the variation that sets the price (Small, Medium, Large) and for the choices of the other variations (flavour, colour).
- The layout of a choice is two short lines (picture, name, remove; then the price), so it stays usable at phone width.
- Saving waits for pictures that are still uploading ("Wait for the pictures to finish uploading, then save.").

## On a quote
- The item sheet shows the choice's picture small beside it in the list of choices.
- The item's photo on the quote (when the quote shows photos) is the picture of the chosen variation; if that has none, the first chosen choice that has one; otherwise the product's photo. It is decided when the quote is previewed or sent, and a sent version keeps the picture it was sent with (pictures are never changed or deleted under their id).
- The saved quote item does not store the choice's picture: it is looked up from the product when the document is made, as the product photo is.

## Data (migration `20261026100000_variation_images.sql`)
- `product_variations.image_id` and `product_option_values.image_id`: nullable, composite same-business foreign keys to `images` (a business can never point at another's picture), column grants for insert and update.
- `save_product` (same signature) takes `image_id` on each variation and each choice: `null` or `""` removes it, a missing key leaves the picture as it is (an older app still open on a phone changes nothing). The picture is matched to its row by place in the list, so new rows work.
- Pictures count towards the business's 600-picture cap (see `images.test.sql`); nothing is deleted.

## Tests
SQL: `variation_images.test.sql` (kept without the key, follows its place, null and "" remove it, another business's picture is refused for both kinds). Unit: parsing and payload of `imageId` for variations and choices; the snapshot chooses variation, then choice, then product. Browser: choose, refuse a non-picture, keep after saving, shown beside the choice on a quote, remove; the same for a flavour choice; accessibility walk covers the new rows.

## Not built
A bigger picture of the chosen variation on the quote item row; pictures on extras; a gallery for a product.
