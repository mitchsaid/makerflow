import "server-only";
import { createClient } from "../supabase/server";
import { isImageId, type ImageKind, type ImageSize } from "./index";
import type { ProcessedImage } from "./process";

/**
 * Picture reads and writes, all under the signed-in person's own access: row-level security lets
 * members of a business read and add its pictures and nobody change or delete one. The database
 * sends bytes as hex text ("\x00ff..."), which is why they are converted here.
 */

export type Rendition = { contentType: "image/jpeg" | "image/png"; bytes: Buffer };

const fromHex = (value: string) => Buffer.from(value.startsWith("\\x") ? value.slice(2) : value, "hex");
const toHex = (bytes: Buffer) => `\\x${bytes.toString("hex")}`;

type Row = { id: string; content_type: Rendition["contentType"]; display?: string; thumb?: string };

/** One picture's bytes, or null for a bad id or one this person cannot see. */
export async function getRendition(id: string, size: ImageSize): Promise<Rendition | null> {
  if (!isImageId(id)) return null;
  const found = await getRenditions([id], size);
  return found.get(id) ?? null;
}

/** Several pictures at once (for drawing a quote). Missing or unreadable ids are left out. */
export async function getRenditions(ids: readonly string[], size: ImageSize): Promise<Map<string, Rendition>> {
  const wanted = [...new Set(ids.filter(isImageId))];
  const found = new Map<string, Rendition>();
  if (wanted.length === 0) return found;
  const supabase = await createClient();
  const { data, error } = await supabase.from("images").select(`id, content_type, ${size}`).in("id", wanted);
  if (error) throw new Error(`Could not load pictures: ${error.message}`);
  for (const row of (data ?? []) as unknown as Row[]) {
    const bytes = row[size];
    if (bytes) found.set(row.id, { contentType: row.content_type, bytes: fromHex(bytes) });
  }
  return found;
}

/** Saves a processed picture for the business and returns its id. */
export async function insertImage(organisationId: string, kind: ImageKind, image: ProcessedImage): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("images")
    .insert({
      organisation_id: organisationId,
      kind,
      content_type: image.contentType,
      width: image.width,
      height: image.height,
      display: toHex(image.display),
      thumb: toHex(image.thumb),
    })
    .select("id")
    .single();
  if (error?.code === "54000") throw Object.assign(new Error("picture limit reached"), { code: "54000" });
  if (error || !data) throw new Error(`Could not save the picture: ${error?.message ?? "no row"}`);
  return data.id as string;
}
