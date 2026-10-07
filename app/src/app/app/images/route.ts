import { requireOrganisation } from "@/lib/auth/dal";
import { insertImage } from "@/lib/images/data";
import { IMAGE_ERRORS, IMAGE_KINDS, INPUT_MAX_BYTES, type ImageKind } from "@/lib/images";
import { processImage } from "@/lib/images/process";

/**
 * Upload a picture: a product photo or the business logo. The server makes the two small copies it
 * keeps (see lib/images/process.ts) and answers with the new picture's id; nothing is attached to
 * anything yet, the caller does that when the person saves.
 */
export async function POST(request: Request) {
  const { organisation } = await requireOrganisation();
  const json = (body: unknown, status: number) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: IMAGE_ERRORS.tooBig }, 413);
  }
  const kind = form.get("kind");
  const file = form.get("file");
  if (typeof kind !== "string" || !IMAGE_KINDS.includes(kind as ImageKind) || !(file instanceof File)) {
    return json({ ok: false, error: IMAGE_ERRORS.generic }, 400);
  }
  if (file.size > INPUT_MAX_BYTES) return json({ ok: false, error: IMAGE_ERRORS.tooBig }, 413);

  const processed = await processImage(Buffer.from(await file.arrayBuffer()), kind as ImageKind);
  if (!processed.ok) return json({ ok: false, error: processed.error }, 422);

  try {
    const id = await insertImage(organisation.id, kind as ImageKind, processed.value);
    return json({ ok: true, id }, 201);
  } catch (error) {
    console.error("could not save a picture:", (error as Error).message);
    return json({ ok: false, error: IMAGE_ERRORS.generic }, 500);
  }
}
