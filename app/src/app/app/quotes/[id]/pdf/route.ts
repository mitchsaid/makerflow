import type { NextRequest } from "next/server";
import { requireOrganisation } from "@/lib/auth/dal";
import { getRenditions } from "@/lib/images/data";
import { findStoredQuote } from "@/lib/quotes/data";
import { renderQuotePdf } from "@/lib/quotes/pdf/render";
import { prepareQuote } from "@/lib/quotes/prepare";

/**
 * The quote as a PDF. A draft gives a preview of what is saved, marked as a draft. A sent
 * quote gives the frozen document of its latest version (or the one asked for with
 * ?version=), drawn from the stored snapshot only. Only people in the business can see it.
 * ?download=1 asks the browser to save it instead of showing it.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/app/quotes/[id]/pdf">) {
  const { id } = await ctx.params;
  const workspace = await requireOrganisation();
  const notFound = () => new Response("Quote not found", { status: 404 });

  const stored = await findStoredQuote(id);
  if (!stored || stored.organisationId !== workspace.organisation.id) return notFound();

  const versionParam = request.nextUrl.searchParams.get("version");
  let snapshot;
  let draft = false;
  if (versionParam !== null) {
    if (!/^\d{1,4}$/.test(versionParam)) return notFound();
    snapshot = stored.versions.find((v) => v.version === Number(versionParam))?.snapshot;
  } else if (stored.status === "draft") {
    const prepared = await prepareQuote(id, workspace);
    if (!prepared.ok) {
      return new Response("This draft can't be shown yet. Open it and save it again.", { status: 422 });
    }
    snapshot = prepared.value.snapshot;
    draft = true;
  } else {
    snapshot = stored.versions[0]?.snapshot;
  }
  if (!snapshot) return notFound();

  // The pictures the snapshot names (the product photos' small copies, and the logo).
  const photoIds = snapshot.lines.flatMap((l) => (l.photoImageId ? [l.photoImageId] : []));
  const [photos, logos] = await Promise.all([
    getRenditions(photoIds, "thumb"),
    getRenditions(snapshot.logoImageId ? [snapshot.logoImageId] : [], "display"),
  ]);
  const logo = snapshot.logoImageId ? (logos.get(snapshot.logoImageId) ?? null) : null;

  let pdf: Buffer;
  try {
    pdf = await renderQuotePdf(snapshot, { draft, images: photos, logo });
  } catch (error) {
    // The preview shows its own message; nothing about the quote is lost.
    console.error("could not draw the quote PDF:", error);
    return new Response("The PDF could not be made. Check the text on the quote and try again.", { status: 500 });
  }
  const safeName = `${snapshot.number}${snapshot.version > 1 ? `-v${snapshot.version}` : ""}`.replace(
    /[^A-Za-z0-9._-]/g,
    "_",
  );
  const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${safeName}${draft ? "-draft" : ""}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
