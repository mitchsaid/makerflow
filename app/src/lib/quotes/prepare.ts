import "server-only";
import type { Workspace } from "../auth/dal";
import { getLocalePack, vatSettingsFor } from "../locale";
import { parseQuote, type ParsedQuote } from "./index";
import { todayIn } from "./dates";
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
  });
  const problems = sendProblems({
    hasCustomer: ownCustomer !== null,
    // Delivery or collection alone is not something to quote for.
    itemCount: parsed.quote.lines.filter((l) => l.kind !== "delivery" && l.kind !== "collection").length,
    validUntil: parsed.quote.validUntil,
    today: todayIn(locale.timeZone),
    profile,
    locale,
    depositTooBig: parsed.quote.deposit ? depositAmounts(parsed.quote.totals.grossCents, parsed.quote.deposit).tooBig : false,
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
