import type { NextRequest } from "next/server";
import { requireOrganisation } from "@/lib/auth/dal";
import { getRenditions } from "@/lib/images/data";
import { loadStatement } from "@/lib/statements/load";
import { renderStatementPdf } from "@/lib/statements/pdf/render";

/**
 * A customer's statement as a PDF, worked out from their invoices, payments and credit notes as they are now. Only
 * people in the business can see it. ?period= and ?owing=1 are the same choices as on the page; ?download=1 asks the
 * browser to save it instead of showing it.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/app/customers/[id]/statement/pdf">) {
  const { id } = await ctx.params;
  await requireOrganisation();
  const params = request.nextUrl.searchParams;

  let loaded;
  try {
    loaded = await loadStatement(id, { period: params.get("period"), owing: params.get("owing") });
  } catch {
    return new Response("Customer not found", { status: 404 });
  }

  const logos = await getRenditions(loaded.logoImageId ? [loaded.logoImageId] : [], "display");
  const logo = loaded.logoImageId ? (logos.get(loaded.logoImageId) ?? null) : null;

  let pdf: Buffer;
  try {
    pdf = await renderStatementPdf(loaded.document, { logo });
  } catch (error) {
    console.error("could not draw the statement PDF:", error);
    return new Response("The PDF could not be made. Try again in a moment.", { status: 500 });
  }
  const safeName = `Statement-${loaded.document.customer.name}-${loaded.today}`.replace(/[^A-Za-z0-9._-]/g, "_");
  const disposition = params.get("download") === "1" ? "attachment" : "inline";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${safeName}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
