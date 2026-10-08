import "server-only";
import sharp, { type OutputInfo } from "sharp";
import {
  DISPLAY_MAX_BYTES,
  IMAGE_ERRORS,
  BACKGROUND_DISPLAY_HEIGHT_PX,
  BACKGROUND_DISPLAY_WIDTH_PX,
  BACKGROUND_THUMB_PX,
  INPUT_MAX_BYTES,
  LOGO_DISPLAY_PX,
  LOGO_THUMB_PX,
  PRODUCT_DISPLAY_PX,
  PRODUCT_THUMB_PX,
  THUMB_MAX_BYTES,
  type ImageKind,
} from "./index";

/**
 * Turns an uploaded picture into the two small copies we keep, and nothing else: the original is
 * never stored. Only JPEG, PNG and WebP are accepted, judged by what the bytes really are and not
 * by what the browser says. The camera's rotation is applied, and location and other hidden
 * details are dropped. A product photo becomes a JPEG (display copy, and a square thumbnail); a
 * logo keeps its shape and any see-through background, as a PNG.
 */

export type ProcessedImage = {
  contentType: "image/jpeg" | "image/png";
  width: number;
  height: number;
  display: Buffer;
  thumb: Buffer;
};

/** A wide wordmark can be thin, so only the longer side has to be a decent size. */
const MIN_LONG_SIDE = 100;
const MIN_SHORT_SIDE = 40;
/** Refuse absurd pixel counts before decoding them (a tiny file can describe a gigantic picture). */
const MAX_INPUT_PIXELS = 60_000_000;
const FORMATS = new Set(["jpeg", "png", "webp"]);

export async function processImage(
  input: Buffer,
  kind: ImageKind,
): Promise<{ ok: true; value: ProcessedImage } | { ok: false; error: string }> {
  if (input.length === 0) return { ok: false, error: IMAGE_ERRORS.notAPicture };
  if (input.length > INPUT_MAX_BYTES) return { ok: false, error: IMAGE_ERRORS.tooBig };

  try {
    const base = () => sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
    const meta = await base().metadata();
    if (!meta.format || !FORMATS.has(meta.format) || (meta.pages ?? 1) > 1) {
      return { ok: false, error: IMAGE_ERRORS.notAPicture };
    }
    // Rotated pictures report their stored size; the shown size swaps for the sideways orientations.
    const sideways = (meta.orientation ?? 1) >= 5;
    const w = sideways ? meta.height : meta.width;
    const h = sideways ? meta.width : meta.height;
    if (!w || !h || Math.max(w, h) < MIN_LONG_SIDE || Math.min(w, h) < MIN_SHORT_SIDE) return { ok: false, error: IMAGE_ERRORS.tooSmall };

    if (kind === "logo") {
      const make = async (px: number, palette: boolean) =>
        base()
          .rotate()
          .resize({ width: px, height: px, fit: "inside", withoutEnlargement: true })
          .png(palette ? { palette: true, quality: 85, compressionLevel: 9 } : { compressionLevel: 9 })
          .toBuffer({ resolveWithObject: true });
      let display = await make(LOGO_DISPLAY_PX, false);
      if (display.data.length > DISPLAY_MAX_BYTES) display = await make(LOGO_DISPLAY_PX, true);
      const thumb = await base()
        .rotate()
        .resize({ width: LOGO_THUMB_PX, height: LOGO_THUMB_PX, fit: "inside", withoutEnlargement: true })
        .png({ palette: true, quality: 90, compressionLevel: 9 })
        .toBuffer();
      if (display.data.length > DISPLAY_MAX_BYTES || thumb.length > THUMB_MAX_BYTES) {
        return { ok: false, error: IMAGE_ERRORS.tooBig };
      }
      return {
        ok: true,
        value: {
          contentType: "image/png",
          width: display.info.width,
          height: display.info.height,
          display: display.data,
          thumb,
        },
      };
    }

    // A product photo: white behind anything see-through, JPEG at the best quality that fits.
    const flat = () => base().rotate().flatten({ background: "#ffffff" });

    if (kind === "background") {
      // Fills a page, so it keeps its own shape (fitted inside an A4 page's size); the thumbnail is the whole picture, small.
      let page: { data: Buffer; info: OutputInfo } | null = null;
      for (const quality of [78, 70, 60, 50]) {
        page = await flat()
          .resize({ width: BACKGROUND_DISPLAY_WIDTH_PX, height: BACKGROUND_DISPLAY_HEIGHT_PX, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality, mozjpeg: true })
          .toBuffer({ resolveWithObject: true });
        if (page.data.length <= DISPLAY_MAX_BYTES) break;
      }
      if (!page || page.data.length > DISPLAY_MAX_BYTES) return { ok: false, error: IMAGE_ERRORS.tooBig };
      const small = await flat()
        .resize({ width: BACKGROUND_THUMB_PX, height: BACKGROUND_THUMB_PX, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer();
      if (small.length > THUMB_MAX_BYTES) return { ok: false, error: IMAGE_ERRORS.tooBig };
      return {
        ok: true,
        value: { contentType: "image/jpeg", width: page.info.width, height: page.info.height, display: page.data, thumb: small },
      };
    }
    let display: { data: Buffer; info: OutputInfo } | null = null;
    for (const quality of [85, 78, 70, 60]) {
      display = await flat()
        .resize({ width: PRODUCT_DISPLAY_PX, height: PRODUCT_DISPLAY_PX, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });
      if (display.data.length <= DISPLAY_MAX_BYTES) break;
    }
    if (!display || display.data.length > DISPLAY_MAX_BYTES) return { ok: false, error: IMAGE_ERRORS.tooBig };

    const thumb = await flat()
      .resize({ width: PRODUCT_THUMB_PX, height: PRODUCT_THUMB_PX, fit: "cover", position: "centre" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    if (thumb.length > THUMB_MAX_BYTES) return { ok: false, error: IMAGE_ERRORS.tooBig };

    return {
      ok: true,
      value: {
        contentType: "image/jpeg",
        width: display.info.width,
        height: display.info.height,
        display: display.data,
        thumb,
      },
    };
  } catch {
    // Not decodable (corrupt, truncated, or something else in disguise).
    return { ok: false, error: IMAGE_ERRORS.notAPicture };
  }
}
