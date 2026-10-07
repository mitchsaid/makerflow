import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "../supabase/server";
import { BUCKET, isImageId, looksLikeImage, pathFor, type ImageKind, type ImageSize } from "./index";
import type { ProcessedImage } from "./process";

/**
 * Picture reads and writes, all under the signed-in person's own access. A picture is a record in
 * the `images` table (which business, what kind, its size) plus two files in the private "pictures"
 * bucket; row-level security and the bucket's rules let members of a business read and add its
 * pictures and nobody change or delete one (see migration 20261013100000). Nothing here uses the
 * server key, so it works wherever the app can sign people in.
 */

export type Rendition = { contentType: "image/jpeg" | "image/png"; bytes: Buffer };

type Row = { id: string; organisation_id: string; content_type: Rendition["contentType"] };

/** One picture's bytes, or null for a bad id or one this person cannot see. */
export async function getRendition(id: string, size: ImageSize): Promise<Rendition | null> {
  if (!isImageId(id)) return null;
  const found = await getRenditions([id], size);
  return found.get(id) ?? null;
}

/**
 * Several pictures at once (for drawing a quote). Missing or unreadable ones, and anything whose
 * bytes are not really the picture type it claims, are left out rather than failing the page.
 */
export async function getRenditions(ids: readonly string[], size: ImageSize): Promise<Map<string, Rendition>> {
  const wanted = [...new Set(ids.filter(isImageId))];
  const found = new Map<string, Rendition>();
  if (wanted.length === 0) return found;
  const supabase = await createClient();
  const { data, error } = await supabase.from("images").select("id, organisation_id, content_type").in("id", wanted);
  if (error) throw new Error(`Could not load pictures: ${error.message}`);

  await Promise.all(
    ((data ?? []) as Row[]).map(async (row) => {
      const { data: blob, error: downloadError } = await supabase.storage
        .from(BUCKET)
        .download(pathFor(row.organisation_id, row.id, size));
      if (downloadError || !blob) return;
      const bytes = Buffer.from(await blob.arrayBuffer());
      if (looksLikeImage(bytes, row.content_type)) found.set(row.id, { contentType: row.content_type, bytes });
    }),
  );
  return found;
}

/**
 * Saves a processed picture for the business and returns its id. The record is made first (it
 * checks the person belongs to the business and that the business is under its limit), then the two
 * files. If a file fails the id is never handed out, so nothing can point at an incomplete picture;
 * the record that was made stays, unused.
 */
export async function insertImage(organisationId: string, kind: ImageKind, image: ProcessedImage): Promise<string> {
  const supabase = await createClient();
  const id = randomUUID();
  const { error } = await supabase.from("images").insert({
    id,
    organisation_id: organisationId,
    kind,
    content_type: image.contentType,
    width: image.width,
    height: image.height,
    display_bytes: image.display.length,
    thumb_bytes: image.thumb.length,
  });
  if (error?.code === "54000") throw Object.assign(new Error("picture limit reached"), { code: "54000" });
  if (error) throw new Error(`Could not save the picture: ${error.message}`);

  for (const [size, bytes] of [
    ["display", image.display],
    ["thumb", image.thumb],
  ] as const) {
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(pathFor(organisationId, id, size), bytes, { contentType: image.contentType, upsert: false });
    if (uploadError) throw new Error(`Could not store the picture: ${uploadError.message}`);
  }
  return id;
}
