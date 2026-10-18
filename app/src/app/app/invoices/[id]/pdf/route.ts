import type { NextRequest } from "next/server";
import { requireOrganisation } from "@/lib/auth/dal";
import { getRenditions } from "@/lib/images/data";
import { findInvoice } from "@/lib/invoices/data";
import { owingCentsOf, paidCentsOf } from "@/lib/invoices/payments";
import { getLocalePack } from "@/lib/locale";
import { renderQuotePdf } from "@/lib/quotes/pdf/render";
import { themeFromStored } from "@/lib/quotes/themes";

/**
 * The invoice as a PDF, drawn from its stored document only (the same drawing code as a quote, with the invoice's words).
 * Only people in the business can see it. ?download=1 asks the browser to save it instead of showing it.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/app/invoices/[id]/pdf">) {
  const { id } = await ctx.params;
  const workspace = await requireOrganisation();
  const notFound = () => new Response("Invoice not found", { status: 404 });

  const invoice = await findInvoice(id);
  if (!invoice || invoice.organisationId !== workspace.organisation.id) return notFound();
  const snapshot = invoice.snapshot;

  // The pictures the document names (the product photos' small copies, the logo and the theme's background).
  const photoIds = snapshot.lines.flatMap((l) => (l.photoImageId ? [l.photoImageId] : []));
  const theme = themeFromStored(snapshot);
  const backgroundId = theme.background === "image" ? theme.backgroundImageId : null;
  const [photos, logos, backgrounds] = await Promise.all([
    getRenditions(photoIds, "thumb"),
    getRenditions(snapshot.logoImageId ? [snapshot.logoImageId] : [], "display"),
    getRenditions(backgroundId ? [backgroundId] : [], "display"),
  ]);
  const logo = snapshot.logoImageId ? (logos.get(snapshot.logoImageId) ?? null) : null;
  const background = backgroundId ? (backgrounds.get(backgroundId) ?? null) : null;

  let pdf: Buffer;
  try {
    const paidCents = paidCentsOf(invoice.payments);
    const words = getLocalePack(workspace.profile.countryCode).documents.invoice;
    pdf = await renderQuotePdf(snapshot, {
      images: photos,
      logo,
      background,
      payments: { paidCents, owingCents: owingCentsOf(invoice.grossCents, paidCents), labels: { paid: words.paidLabel, due: words.amountDueLabel } },
    });
  } catch (error) {
    console.error("could not draw the invoice PDF:", error);
    return new Response("The PDF could not be made. Try again in a moment.", { status: 500 });
  }
  const safeName = invoice.number.replace(/[^A-Za-z0-9._-]/g, "_");
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
