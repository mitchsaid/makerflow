import "server-only";
import type { Workspace } from "../auth/dal";
import { findCustomer } from "../customers/data";
import { getLocalePack, vatSettingsFor } from "../locale";
import { customerParty } from "../quotes/snapshot";
import { photosFor } from "../quotes/prepare";
import { getThemes } from "../quotes/theme-data";
import { chooseTheme, isStarterKey, resolveTheme } from "../quotes/themes";
import { buildQuoteSnapshot, type QuoteSnapshot } from "../quotes/snapshot";
import { parseInvoiceDraft, type InvoiceDraftErrors, type InvoiceDraftForm } from "./draft";
import { invoiceProblems, type InvoiceProblem } from "./index";
import { buildInvoiceSnapshot } from "./snapshot";

/**
 * Everything the server needs to issue an invoice draft, worked out the same way every time: the saved form is parsed
 * strictly and totalled with the money code (never from numbers the browser sent), the customer is read under the
 * person's own access, and the document is built from them. The number is empty here: the database gives it inside the
 * issuing transaction.
 */
export type PreparedInvoiceDraft = {
  snapshot: QuoteSnapshot;
  referenceLabel: string | null;
  issueDate: string;
  dueDate: string;
  note: string | null;
  problems: InvoiceProblem[];
  customerId: string;
};

export async function prepareInvoiceDraft(
  form: InvoiceDraftForm,
  workspace: Workspace,
  /** The quote the draft adjusts, when there is one: its number, and the design it uses (the invoice keeps it). */
  quote: { number: string; theme: { id: string | null; starter: string | null } | null } | null,
): Promise<{ ok: true; value: PreparedInvoiceDraft } | { ok: false; errors: InvoiceDraftErrors }> {
  const { organisation, profile } = workspace;
  const locale = getLocalePack(profile.countryCode);
  const vat = vatSettingsFor(profile, locale);

  const parsed = parseInvoiceDraft(form, vat);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  // The customer must be one of this business's (the database guarantees it; this says it kindly).
  const customer = await findCustomer(form.customerId);
  if (!customer || customer.organisationId !== organisation.id) {
    return { ok: false, errors: { fields: { customerId: "That customer isn't on your list. Choose one again." }, lines: {} } };
  }

  const { productPhotos, choicePhotos } = await photosFor(parsed.quote, organisation.id);
  const chosen = chooseTheme({ id: quote?.theme?.id ?? null, starter: isStarterKey(quote?.theme?.starter) ? quote.theme.starter : null }, await getThemes());
  const business = { name: organisation.name, ...profile };
  const asQuote = buildQuoteSnapshot({
    quote: parsed.quote,
    number: "",
    version: 1,
    business,
    customer,
    countryCode: profile.countryCode,
    currencyCode: profile.currencyCode,
    vat,
    locale,
    bank: workspace.bankDetails,
    paymentMethods: workspace.paymentMethods,
    productPhotos,
    choicePhotos,
    theme: resolveTheme(chosen.spec, chosen.name),
  });
  const { snapshot, referenceLabel } = buildInvoiceSnapshot({
    version: asQuote,
    issueDate: parsed.quote.issueDate,
    dueDate: parsed.dueDate,
    note: parsed.note,
    locale,
    business,
    customer,
    bank: workspace.bankDetails,
    paymentMethods: workspace.paymentMethods,
    quoteNumber: quote?.number ?? null,
  });
  const problems = invoiceProblems({
    business: profile,
    customer: customerParty(customer, locale),
    grossCents: parsed.quote.totals.grossCents,
    taxRegistered: asQuote.vat.registered,
    businessRegistered: profile.vatRegistered,
    locale,
  });
  return {
    ok: true,
    value: { snapshot, referenceLabel, issueDate: parsed.quote.issueDate, dueDate: parsed.dueDate, note: parsed.note, problems, customerId: customer.id },
  };
}
