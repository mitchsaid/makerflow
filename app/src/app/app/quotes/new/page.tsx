import Link from "next/link";
import { requireOrganisation } from "@/lib/auth/dal";
import { forOrganisation } from "@/lib/customers";
import { getCustomers } from "@/lib/customers/data";
import { getLocalePack, vatSettingsFor } from "@/lib/locale";
import { blankLine } from "@/lib/quotes";
import { addDays, todayIn } from "@/lib/quotes/dates";
import { customerOptions } from "../builder-data";
import { QuoteBuilder } from "../quote-builder";

/** How long a new quote is valid for, until it becomes a business setting. */
const DEFAULT_VALID_DAYS = 14;

export default async function NewQuotePage() {
  const [allCustomers, { organisation, profile }] = await Promise.all([
    getCustomers(),
    requireOrganisation(),
  ]);
  const locale = getLocalePack(profile.countryCode);
  const customers = forOrganisation(allCustomers, organisation.id);
  const today = todayIn(locale.timeZone);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <div className="space-y-1">
        <Link href="/app/quotes" className="text-sm text-muted-foreground underline">
          Quotes
        </Link>
        <h1 className="text-xl font-semibold">New quote</h1>
      </div>
      <QuoteBuilder
        quoteId={null}
        initial={{
          customerId: "",
          issueDate: today,
          validUntil: addDays(today, DEFAULT_VALID_DAYS),
          neededBy: "",
          lines: [blankLine("n-0")],
          fulfilment: "none",
          deliveryFee: "",
          discountKind: "none",
          discountValue: "",
          notes: "",
        }}
        customers={customerOptions(customers)}
        vat={vatSettingsFor(profile, locale)}
        currencyCode={profile.currencyCode}
        countryCode={profile.countryCode}
        numberStyle={locale.numberStyle}
        taxName={locale.tax.name}
        justSaved={false}
      />
    </main>
  );
}
