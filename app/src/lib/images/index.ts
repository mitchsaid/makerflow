/**
 * Pictures: product photos and the business logo. Plain data and limits, safe for the browser; the
 * server's picture-making is in ./process.ts. See docs/plans/quote-looks.md for the decisions.
 */

export type ImageKind = "product" | "logo";
export type ImageSize = "thumb" | "display";

export const IMAGE_KINDS: readonly ImageKind[] = ["product", "logo"];

/** What the browser sends: it shrinks the picture first (phone photos are far bigger than a host accepts). */
export const UPLOAD_MAX_BYTES = 4_000_000;
/** The largest picture the server will look at, however it got here. */
export const INPUT_MAX_BYTES = 8_000_000;

/** What the server keeps (the database refuses more: see migration 20261013100000). */
export const DISPLAY_MAX_BYTES = 700_000;
export const THUMB_MAX_BYTES = 150_000;

/** Sizes in pixels. A photo is shown square on a quote, so its thumbnail is cropped square. */
export const PRODUCT_DISPLAY_PX = 1200;
export const PRODUCT_THUMB_PX = 400;
export const LOGO_DISPLAY_PX = 600;
export const LOGO_THUMB_PX = 300;

/** The browser shrinks to this before uploading. */
export const CLIENT_PRODUCT_PX = 1600;
export const CLIENT_LOGO_PX = 1000;

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ACCEPT_ATTRIBUTE = "image/jpeg,image/png,image/webp";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isImageId = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

/** The address a picture is served from. */
export function imageUrl(id: string, size: ImageSize = "display"): string {
  return `/app/images/${id}${size === "thumb" ? "?size=thumb" : ""}`;
}

export type UploadResult = { ok: true; id: string } | { ok: false; error: string };

/** Plain messages for what can go wrong with a picture. */
export const IMAGE_ERRORS = {
  notAPicture: "That doesn't look like a picture we can use. Choose a JPEG, PNG or WebP photo.",
  tooBig: "That picture is too large to read. Try a smaller one.",
  tooSmall: "That picture is very small. Choose a larger one (at least 100 pixels across).",
  offline: "Couldn't upload it. Check your connection and try again.",
  generic: "Something went wrong with that picture. Please try another.",
  full: "You have reached the limit for stored pictures, so this one could not be added. Please get in touch and we will sort it out.",
} as const;
