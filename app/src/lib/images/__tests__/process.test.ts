import { describe, expect, it, vi } from "vitest";

// The server-only guard is for the bundler, not for tests.
vi.mock("server-only", () => ({}));

import sharp from "sharp";
import { DISPLAY_MAX_BYTES, IMAGE_ERRORS, THUMB_MAX_BYTES } from "../index";
import { processImage } from "../process";

/** A noisy picture (so it doesn't compress to nothing) of the given size and format. */
async function picture(
  width: number,
  height: number,
  format: "jpeg" | "png" | "webp" = "jpeg",
  options: { alpha?: boolean; orientation?: number } = {},
) {
  const channels = options.alpha ? 4 : 3;
  const raw = Buffer.alloc(width * height * channels);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 7919 + ((i >> 5) * 104729)) & 255;
  if (options.alpha) for (let i = 3; i < raw.length; i += 4) raw[i] = (i >> 8) % 2 === 0 ? 255 : 0;
  let image = sharp(raw, { raw: { width, height, channels } });
  if (options.orientation) image = image.withMetadata({ orientation: options.orientation });
  return image.toFormat(format).toBuffer();
}

describe("a product photo", () => {
  it("becomes a display copy and a square thumbnail, both JPEG and within the limits", async () => {
    const result = await processImage(await picture(3000, 2000), "product");
    if (!result.ok) throw new Error(result.error);
    const { value } = result;
    expect(value.contentType).toBe("image/jpeg");
    expect(value.display.length).toBeLessThanOrEqual(DISPLAY_MAX_BYTES);
    expect(value.thumb.length).toBeLessThanOrEqual(THUMB_MAX_BYTES);
    const display = await sharp(value.display).metadata();
    expect(display.format).toBe("jpeg");
    expect(Math.max(display.width!, display.height!)).toBe(1200);
    expect(display.width! / display.height!).toBeCloseTo(1.5, 1);
    expect([value.width, value.height]).toEqual([display.width, display.height]);
    const thumb = await sharp(value.thumb).metadata();
    expect([thumb.width, thumb.height]).toEqual([400, 400]);
  });

  it("never makes a small picture bigger", async () => {
    const result = await processImage(await picture(500, 300), "product");
    if (!result.ok) throw new Error(result.error);
    expect([result.value.width, result.value.height]).toEqual([500, 300]);
  });

  it("applies the camera's rotation and keeps no hidden details", async () => {
    // Orientation 6: stored sideways, shown turned a quarter.
    const result = await processImage(await picture(800, 400, "jpeg", { orientation: 6 }), "product");
    if (!result.ok) throw new Error(result.error);
    expect([result.value.width, result.value.height]).toEqual([400, 800]);
    const meta = await sharp(result.value.display).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
  });

  it("puts white behind a see-through picture", async () => {
    const result = await processImage(await picture(300, 300, "png", { alpha: true }), "product");
    if (!result.ok) throw new Error(result.error);
    expect(result.value.contentType).toBe("image/jpeg");
    expect((await sharp(result.value.thumb).metadata()).hasAlpha).toBe(false);
  });

  it("takes PNG and WebP too", async () => {
    for (const format of ["png", "webp"] as const) {
      const result = await processImage(await picture(600, 600, format), "product");
      expect(result.ok, format).toBe(true);
    }
  });
});

describe("a logo", () => {
  it("keeps its shape and its see-through background, as a PNG", async () => {
    const result = await processImage(await picture(1500, 500, "png", { alpha: true }), "logo");
    if (!result.ok) throw new Error(result.error);
    const { value } = result;
    expect(value.contentType).toBe("image/png");
    const display = await sharp(value.display).metadata();
    expect(display.format).toBe("png");
    expect(display.hasAlpha).toBe(true);
    expect([display.width, display.height]).toEqual([600, 200]);
    expect(value.display.length).toBeLessThanOrEqual(DISPLAY_MAX_BYTES);
    expect(value.thumb.length).toBeLessThanOrEqual(THUMB_MAX_BYTES);
    expect((await sharp(value.thumb).metadata()).width).toBe(300);
  });
});

describe("what is refused", () => {
  it("says so plainly for something that is not a picture", async () => {
    const result = await processImage(Buffer.from("this is not a picture"), "product");
    expect(result).toEqual({ ok: false, error: IMAGE_ERRORS.notAPicture });
    expect(await processImage(Buffer.alloc(0), "product")).toEqual({ ok: false, error: IMAGE_ERRORS.notAPicture });
  });

  it("goes by the bytes, not by what the file is called", async () => {
    // An SVG (which can carry scripts) or a GIF is refused even if it is sent as an image.
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200"/></svg>');
    expect(await processImage(svg, "product")).toEqual({ ok: false, error: IMAGE_ERRORS.notAPicture });
    const gif = await sharp(Buffer.alloc(200 * 200 * 3, 128), { raw: { width: 200, height: 200, channels: 3 } }).gif().toBuffer();
    expect(await processImage(gif, "product")).toEqual({ ok: false, error: IMAGE_ERRORS.notAPicture });
  });

  it("refuses a truncated picture", async () => {
    const whole = await picture(800, 800);
    const result = await processImage(whole.subarray(0, Math.floor(whole.length / 3)), "product");
    expect(result.ok).toBe(false);
  });

  it("refuses a picture that is too small to look good, and one that is too big to handle", async () => {
    expect(await processImage(await picture(60, 60), "product")).toEqual({ ok: false, error: IMAGE_ERRORS.tooSmall });
    expect(await processImage(Buffer.alloc(8_000_001), "product")).toEqual({ ok: false, error: IMAGE_ERRORS.tooBig });
  });
});
