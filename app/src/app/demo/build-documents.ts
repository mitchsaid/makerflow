import "server-only";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import type { Workspace } from "@/lib/auth/dal";
import { demoContent, type DemoQuote } from "@/lib/demo/content";
import { getLocalePack } from "@/lib/locale";
import { moneyToInput } from "@/lib/money";
import type { ProductSummary } from "@/lib/products";
import { getProducts } from "@/lib/products/data";
import type { LineFormValues, QuoteFormValues } from "@/lib/quotes";
import { addDays, DEFAULT_VALID_DAYS, todayIn } from "@/lib/quotes/dates";
import { forOrganisation } from "@/lib/scope";
import { createClient } from "@/lib/supabase/server";
import { createJob, moveJob } from "../app/jobs/actions";
import { startInvoiceFromQuote } from "../app/invoices/draft-actions";
import { saveQuoteDraft } from "../app/quotes/actions";
import { recordOutcome } from "../app/quotes/outcome-actions";
import { sendQuote } from "../app/quotes/issue-actions";

/**
 * The sample quotes of a demo (docs/plans/demo-accounts.md, slice 2): a draft (so the margin shows), a sent quote, and an
 * accepted one that has a job in progress and an invoice draft. Each goes through the same server actions a maker's
 * taps do (save, send, record the answer, make the job, start the invoice), so the numbers, the frozen versions and
 * the costing are exactly what the app makes. A demo never has an issued invoice (those can never be deleted).
 */

/** The id a redirect points at (these actions finish a new document by redirecting to it). */
async function redirectedTo(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    if (isRedirectError(error)) {
      const id = /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(String((error as { digest?: unknown }).digest ?? ""))?.[1];
      if (id) return id;
    }
    throw error;
  }
  throw new Error("the action did not lead to a new document");
}

function lineOf(product: ProductSummary, item: DemoQuote["items"][number], index: number, style: ReturnType<typeof getLocalePack>["numberStyle"]): LineFormValues {
  const variation = item.variation ? product.variations.find((v) => v.name === item.variation) : undefined;
  if (item.variation && !variation) throw new Error(`demo quote names a variation that is not there: ${product.name} / ${item.variation}`);
  const extras = (item.extras ?? []).map((name) => {
    const extra = product.extras.find((x) => x.name === name);
    if (!extra) throw new Error(`demo quote names an extra that is not there: ${product.name} / ${name}`);
    return { groupId: "", group: "Extras", kind: "any" as const, valueId: extra.id, value: extra.name, text: "", amountCents: extra.priceCents };
  });
  return {
    key: `demo-${index}`,
    kind: product.kind,
    productId: product.id,
    name: product.name,
    description: product.description ?? "",
    quantity: String(item.quantity),
    unit: product.unit ?? "",
    unitPrice: moneyToInput(variation ? variation.priceCents : product.unitPriceCents, style),
    discountKind: "none",
    discountValue: "",
    vatStatus: product.vatStatus,
    variationId: variation?.id ?? "",
    variationLabel: variation ? (product.variationLabel ?? "") : "",
    variationName: variation?.name ?? "",
    options: extras,
  };
}

export async function buildDemoDocuments(workspace: Workspace): Promise<void> {
  if (!workspace.demo) throw new Error("the demo builder only runs on a demo business");
  const content = demoContent(workspace.demo.kind);
  const orgId = workspace.organisation.id;
  const locale = getLocalePack(workspace.profile.countryCode);
  const today = todayIn(locale.timeZone);
  const supabase = await createClient();

  // Once only: a business that has quotes is left alone.
  const { count } = await supabase.from("quotes").select("id", { count: "exact", head: true }).eq("organisation_id", orgId);
  if ((count ?? 0) > 0) return;

  const products = forOrganisation(await getProducts(), orgId);
  const { data: customerRows, error } = await supabase.from("customers").select("id, name").eq("organisation_id", orgId);
  if (error) throw new Error(`could not read the demo customers: ${error.message}`);
  const customerId = new Map((customerRows ?? []).map((c) => [c.name as string, c.id as string]));

  for (const q of content.quotes) {
    const customer = customerId.get(q.customer);
    if (!customer) throw new Error(`demo quote names a customer that is not there: ${q.customer}`);
    const issueDate = addDays(today, -q.daysAgo);
    const values: QuoteFormValues = {
      customerId: customer,
      issueDate,
      validUntil: addDays(issueDate, DEFAULT_VALID_DAYS),
      neededBy: "",
      lines: q.items.map((item, i) => {
        const product = products.find((p) => p.name === item.product);
        if (!product) throw new Error(`demo quote names a product that is not there: ${item.product}`);
        return lineOf(product, item, i, locale.numberStyle);
      }),
      fulfilment: "none",
      deliveryFee: "",
      deliveryAddress: "",
      discountKind: "none",
      discountValue: "",
      notes: "",
      title: q.title ?? "",
      description: "",
      signOff: "",
      paymentInstructions: "",
      showBankDetails: false,
      showPhotos: true,
      depositKind: "none",
      depositValue: "",
      balanceDue: "handover",
      balanceDueDate: "",
      balanceDueText: "",
      policies: [],
    };
    const quoteId = await redirectedTo(() => saveQuoteDraft(null, values));
    if (q.status === "draft") continue;

    const sent = await sendQuote(quoteId);
    if (sent.status !== "sent") throw new Error(`could not send a demo quote: ${sent.status === "error" ? sent.message : "problems"}`);
    if (q.status === "sent") continue;

    const answered = await recordOutcome(quoteId, "accepted", { on: today, how: "whatsapp", note: "Said yes on WhatsApp." });
    if (answered.status !== "done") throw new Error("could not record a demo quote's answer");

    const jobId = await redirectedTo(() => createJob(quoteId));
    const moved = await moveJob(jobId, "in_progress");
    if (moved.status === "error") throw new Error(`could not start a demo job: ${moved.message}`);
    // An invoice draft (never an issued invoice: those can never be deleted).
    await redirectedTo(() => startInvoiceFromQuote(quoteId));
  }
}
