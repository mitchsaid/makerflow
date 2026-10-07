"use client";

import {
  ACCEPTED_TYPES,
  CLIENT_LOGO_PX,
  CLIENT_PRODUCT_PX,
  IMAGE_ERRORS,
  UPLOAD_MAX_BYTES,
  type ImageKind,
  type UploadResult,
} from "./index";

/**
 * Sending a picture from the browser. Phone photos are 4 to 8 MB and a host may refuse a request
 * over about 4.5 MB, so a big picture is shrunk here first (the camera's rotation applied). The
 * server still makes the final copies and decides what it accepts.
 */

const KEEP_AS_IS_BYTES = 1_500_000;

/** The picture decoded for drawing, with the camera's rotation applied. */
async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void } | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close() };
  } catch {
    // An older browser may not accept that option: an <img> element applies the rotation itself.
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, done: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

async function shrink(file: File, kind: ImageKind): Promise<Blob> {
  const max = kind === "logo" ? CLIENT_LOGO_PX : CLIENT_PRODUCT_PX;
  const decoded = await decode(file);
  if (!decoded) {
    // This browser can't read it (or it isn't a picture): send it as it is and let the server say.
    if (file.size > UPLOAD_MAX_BYTES) throw new Error(IMAGE_ERRORS.tooBig);
    return file;
  }
  const scale = Math.min(1, max / Math.max(decoded.width, decoded.height));
  if (scale === 1 && file.size <= KEEP_AS_IS_BYTES && (ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    decoded.done();
    return file;
  }
  const width = Math.max(1, Math.round(decoded.width * scale));
  const height = Math.max(1, Math.round(decoded.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    decoded.done();
    if (file.size > UPLOAD_MAX_BYTES) throw new Error(IMAGE_ERRORS.tooBig);
    return file;
  }
  // A logo that can have a see-through background (PNG or WebP) keeps it, as a PNG; a photo goes on
  // white as a JPEG.
  const asPng = kind === "logo" && (file.type === "image/png" || file.type === "image/webp");
  if (!asPng) {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(decoded.source, 0, 0, width, height);
  decoded.done();
  for (const quality of [0.9, 0.8, 0.7]) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, asPng ? "image/png" : "image/jpeg", quality),
    );
    if (blob && blob.size <= UPLOAD_MAX_BYTES) return blob;
    if (asPng) break;
  }
  throw new Error(IMAGE_ERRORS.tooBig);
}

/** Shrinks (if needed) and uploads a picture. Never throws: the result says what to tell the person. */
export async function uploadImage(file: File, kind: ImageKind): Promise<UploadResult> {
  let body: Blob;
  try {
    body = await shrink(file, kind);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : IMAGE_ERRORS.generic };
  }
  const form = new FormData();
  form.set("kind", kind);
  form.set("file", body, file.name || "picture");
  try {
    const response = await fetch("/app/images", { method: "POST", body: form });
    const data = (await response.json().catch(() => null)) as UploadResult | null;
    if (data && data.ok === true && typeof data.id === "string") return { ok: true, id: data.id };
    if (data && data.ok === false && typeof data.error === "string") return data;
    return { ok: false, error: IMAGE_ERRORS.generic };
  } catch {
    return { ok: false, error: IMAGE_ERRORS.offline };
  }
}
