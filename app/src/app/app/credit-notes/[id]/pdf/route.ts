import type { NextRequest } from "next/server";
import { requireOrganisation } from "@/lib/auth/dal";
import { findCreditNote } from "@/lib/credit-notes/data";
import { getRenditions } from "@/lib/images/data";
import { renderQuotePdf } from "@/lib/quotes/pdf/render";
import { themeFromStored } from "@/lib/quotes/themes";

/**
 * The credit note as a PDF, drawn from its stored document only (the same drawing code as a quote and an invoice, with
 * the credit note's words). Only people in the business can see it. ?download=1 asks the browser to save it.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/app/credit-notes/[id]/pdf">) {
  const { id } = await ctx.params;
  const workspace = await requireOrganisation();
  const notFound = () => new Response("Credit note not found", { status: 404 });

  const note = await findCreditNote(id);
  if (!note || note.organisationId !== workspace.organisation.id) return notFound();
  const snapshot = note.snapshot;

  // The logo and the theme's background picture.
  const theme = themeFromStored(snapshot);
  const backgroundId = theme.background === "image" ? theme.backgroundImageId : null;
  const [logos, backgrounds] = await Promise.all([
    getRenditions(snapshot.logoImageId ? [snapshot.logoImageId] : [], "display"),
    getRenditions(backgroundId ? [backgroundId] : [], "display"),
  ]);
  const logo = snapshot.logoImageId ? (logos.get(snapshot.logoImageId) ?? null) : null;
  const background = backgroundId ? (backgrounds.get(backgroundId) ?? null) : null;

  let pdf: Buffer;
  try {
    pdf = await renderQuotePdf(snapshot, { logo, background });
  } catch (error) {
    console.error("could not draw the credit note PDF:", error);
    return new Response("The PDF could not be made. Try again in a moment.", { status: 500 });
  }
  const safeName = note.number.replace(/[^A-Za-z0-9._-]/g, "_");
  const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${safeName}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
