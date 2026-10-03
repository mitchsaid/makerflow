import Link from "next/link";
import { requireOrganisation } from "@/lib/auth/dal";
import { getCustomers } from "@/lib/customers/data";
import { getProducts } from "@/lib/products/data";
import { forOrganisation } from "@/lib/scope";
import { getLocalePack, vatSettingsFor } from "@/lib/locale";
import { addDays, todayIn } from "@/lib/quotes/dates";
import { customerOptions } from "../builder-data";
import { QuoteBuilder } from "../quote-builder";

/** How long a new quote is valid for, until it becomes a business setting. */
const DEFAULT_VALID_DAYS = 14;

export default async function NewQuotePage() {
  // Customers and products load beside the workspace check, not after it.
  const [allCustomers, allProducts, { organisation, profile }] = await Promise.all([
    getCustomers(),
    getProducts(),
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
          lines: [],
          fulfilment: "none",
          deliveryFee: "",
          discountKind: "none",
          discountValue: "",
          notes: "",
        }}
        customers={customerOptions(customers)}
        products={forOrganisation(allProducts, organisation.id)}
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
