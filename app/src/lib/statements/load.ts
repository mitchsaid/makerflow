import "server-only";
import { notFound } from "next/navigation";
import { requireOrganisation } from "../auth/dal";
import { bankLines } from "../bank";
import { getCustomer } from "../customers/data";
import { getLocalePack } from "../locale";
import { todayIn } from "../quotes/dates";
import { businessParty, customerParty } from "../quotes/snapshot";
import { buildStatement, parsePeriod, type Period, type Statement } from "./index";
import { getStatementInvoices } from "./data";
import type { StatementDocumentData } from "./pdf/statement-document";

export type LoadedStatement = {
  customerId: string;
  period: Period;
  onlyOwing: boolean;
  statement: Statement;
  document: StatementDocumentData;
  logoImageId: string | null;
  today: string;
};

/**
 * Everything the statement page and its PDF are drawn from, worked out the same way every time: the customer's invoices
 * (with payments and credit notes) read under the person's own access, the ledger and ageing built from them, and the
 * business's own details and bank details (never invented ones).
 */
export async function loadStatement(customerId: string, query: { period?: unknown; owing?: unknown }): Promise<LoadedStatement> {
  const workspace = await requireOrganisation();
  const { organisation, profile } = workspace;
  const locale = getLocalePack(profile.countryCode);
  const period = parsePeriod(query.period);
  const onlyOwing = query.owing === "1";

  const reasons = locale.documents.creditNote.reasons as Record<string, string>;
  const [customer, found] = await Promise.all([
    getCustomer(customerId),
    getStatementInvoices(customerId, (reason) => reasons[reason] ?? reason),
  ]);
  // Another business of the same person is not this workspace's customer.
  if (customer.organisationId !== organisation.id) notFound();

  const today = todayIn(locale.timeZone);
  const methods = locale.payment.methods as Record<string, string>;
  const statement = buildStatement({
    invoices: found.invoices,
    today,
    period,
    onlyOwing,
    methodLabel: (m) => methods[m] ?? m,
  });

  return {
    customerId,
    period,
    onlyOwing,
    statement,
    today,
    logoImageId: profile.logoImageId ?? null,
    document: {
      business: businessParty({ name: organisation.name, ...profile }, locale),
      customer: customerParty(customer, locale),
      vatNumberLabel: locale.tax.registrationNumberLabel,
      today,
      period,
      onlyOwing,
      currencyCode: profile.currencyCode,
      numberStyle: locale.numberStyle,
      dateLocale: locale.formatLocale,
      statement,
      // The customer's name is what they quote when they pay (when the business asks for a reference).
      bank: bankLines(workspace.bankDetails, customer.name, locale),
      words: locale.documents.statement,
    },
  };
}
