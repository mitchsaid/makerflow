import type { NextRequest } from "next/server";
import { requireOrganisation } from "@/lib/auth/dal";
import { asDraftCopy } from "@/lib/invoices/draft-copy";
import { findInvoiceDraft } from "@/lib/invoices/draft-data";
import { pdfImagesFor } from "@/lib/invoices/pdf-images";
import { prepareInvoiceDraft } from "@/lib/invoices/prepare-draft";
import { getLocalePack } from "@/lib/locale";
import { renderQuotePdf } from "@/lib/quotes/pdf/render";

/**
 * An invoice draft as a PDF copy (docs/plans/invoice-preview.md, slice 4): drawn from the kept draft the way the preview is,
 * with no number and a line that says it is a draft. It is for checking or showing for approval; the invoice that is sent
 * is the numbered one, made when the draft is marked as issued. Only people in the business can see it.
 * ?download=1 asks the browser to save it instead of showing it.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/app/invoices/drafts/[id]/pdf">) {
  const { id } = await ctx.params;
  const workspace = await requireOrganisation();
  const notFound = () => new Response("Invoice draft not found", { status: 404 });

  const draft = await findInvoiceDraft(id);
  if (!draft || draft.organisationId !== workspace.organisation.id || !draft.form) return notFound();
  const prepared = await prepareInvoiceDraft(draft.form, workspace, draft.quoteNumber ? { number: draft.quoteNumber } : null, draft.theme);
  if (!prepared.ok) return new Response("This draft isn't complete enough to make a copy. Open it and finish it first.", { status: 409 });

  let pdf: Buffer;
  try {
    const snapshot = asDraftCopy(prepared.value.snapshot, getLocalePack(workspace.profile.countryCode));
    const { images, logo, background } = await pdfImagesFor(snapshot);
    pdf = await renderQuotePdf(snapshot, { images, logo, background });
  } catch (error) {
    console.error("could not draw the invoice draft PDF:", error);
    return new Response("The PDF could not be made. Try again in a moment.", { status: 500 });
  }
  const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="Invoice-draft.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
