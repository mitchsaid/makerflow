import "server-only";
import type { Workspace } from "../auth/dal";
import { getLocalePack, vatSettingsFor } from "../locale";
import { createClient } from "../supabase/server";
import { parseQuote, type ParsedQuote } from "./index";
import { todayIn } from "./dates";
import { getThemes } from "./theme-data";
import { chooseTheme, resolveTheme } from "./themes";
import { findStoredQuote, type StoredQuote } from "./data";
import { depositAmounts } from "./deposit";
import { toFormValues } from "./form-values";
import { sendProblems, type SendProblem } from "./send-checks";
import { buildQuoteSnapshot, type QuoteSnapshot } from "./snapshot";

/**
 * Everything the server needs to preview or send a quote, worked out the same way every time:
 * the stored draft is read under the signed-in person's own access (row-level security), parsed
 * strictly, totalled with the money code, and turned into the snapshot the document is drawn
 * from. Checking, previewing and sending all start here, so they cannot disagree.
 */

export type PreparedQuote = {
  stored: StoredQuote;
  parsed: ParsedQuote;
  snapshot: QuoteSnapshot;
  problems: SendProblem[];
  customerName: string | null;
  currencyCode: string;
};

export async function prepareQuote(
  quoteId: string,
  workspace: Workspace,
  /** The quote, when the caller has just read it, so it is not read twice. */
  alreadyRead?: StoredQuote,
): Promise<{ ok: true; value: PreparedQuote } | { ok: false; reason: "not-found" | "unreadable" }> {
  const stored = alreadyRead ?? (await findStoredQuote(quoteId));
  // Another business of the same person is not this workspace's quote.
  if (!stored || stored.organisationId !== workspace.organisation.id) return { ok: false, reason: "not-found" };

  const { organisation, profile } = workspace;
  const locale = getLocalePack(profile.countryCode);
  const vat = vatSettingsFor(profile, locale);
  const parsed = parseQuote(toFormValues(stored, locale.numberStyle), vat);
  if (!parsed.ok) return { ok: false, reason: "unreadable" };

  const customer = stored.customer;
  // The customer must belong to this business (the database already guarantees it; belt and braces).
  const ownCustomer = customer && customer.organisationId === organisation.id ? customer : null;

  // The photos of the products on the quote, as they are now (frozen into the snapshot when it is sent).
  const productIds = [...new Set(parsed.quote.lines.flatMap((l) => (l.productId ? [l.productId] : [])))];
  const productPhotos = new Map<string, string>();
  if (productIds.length > 0 && parsed.quote.showPhotos !== false) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("id, photo_image_id")
      .eq("organisation_id", organisation.id)
      .in("id", productIds);
    // Never carry on without the photos: a quote sent now would be frozen without them for good.
    if (error) throw new Error(`Could not load the products' photos: ${error.message}`);
    for (const row of (data ?? []) as { id: string; photo_image_id: string | null }[]) {
      if (row.photo_image_id) productPhotos.set(row.id, row.photo_image_id);
    }
  }

  // The theme: the quote's own pick, else Classic (the themes are read once per request, shared with the page).
  const saved = await getThemes();
  const chosen = chooseTheme({ id: stored.themeId, starter: stored.themeStarter }, saved);

  const snapshot = buildQuoteSnapshot({
    quote: parsed.quote,
    number: stored.number,
    version: stored.version,
    business: { name: organisation.name, ...profile },
    customer: ownCustomer,
    countryCode: profile.countryCode,
    currencyCode: profile.currencyCode,
    vat,
    locale,
    bank: workspace.bankDetails,
    productPhotos,
    theme: resolveTheme(chosen.spec, chosen.name),
  });
  const depositNow = parsed.quote.deposit ? depositAmounts(parsed.quote.totals.grossCents, parsed.quote.deposit) : null;
  const problems = sendProblems({
    hasCustomer: ownCustomer !== null,
    // Delivery or collection alone is not something to quote for.
    itemCount: parsed.quote.lines.filter((l) => l.kind !== "delivery" && l.kind !== "collection").length,
    validUntil: parsed.quote.validUntil,
    today: todayIn(locale.timeZone),
    profile,
    locale,
    depositTooBig: depositNow?.tooBig ?? false,
    depositIsNothing: !!depositNow && parsed.quote.totals.grossCents > 0 && depositNow.depositCents === 0,
    balanceDueDate: parsed.quote.deposit?.balance.kind === "date" ? parsed.quote.deposit.balance.date : null,
  });
  return {
    ok: true,
    value: {
      stored,
      parsed: parsed.quote,
      snapshot,
      problems,
      customerName: ownCustomer?.name ?? null,
      currencyCode: profile.currencyCode,
    },
  };
}
