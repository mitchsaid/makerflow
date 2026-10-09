import Link from "next/link";
import { requireOrganisation } from "@/lib/auth/dal";
import { getCustomersWithAddresses } from "@/lib/customers/data";
import { getProducts } from "@/lib/products/data";
import { bankPreview, canEditBankDetails } from "@/lib/bank";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { defaultQuotePolicies } from "@/lib/policies";
import { getPolicies } from "@/lib/policies/data";
import { forOrganisation } from "@/lib/scope";
import { getLocalePack, vatSettingsFor } from "@/lib/locale";
import { moneyToInput, percentToInput } from "@/lib/money";
import { addDays, DEFAULT_VALID_DAYS, todayIn } from "@/lib/quotes/dates";
import { customerOptions } from "../builder-data";
import { QuoteBuilder } from "../quote-builder";
import { QuoteSetup } from "../quote-setup";
import { createClient } from "@/lib/supabase/server";

/** Only asked on the rare first visit; the normal page never runs it. */
async function hasAnyQuote(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("quotes").select("id").limit(1);
  return (data?.length ?? 0) > 0;
}

export default async function NewQuotePage() {
  // Customers and products load beside the workspace check, not after it.
  const [allCustomers, allProducts, allPolicies, { organisation, profile, role, bankDetails }] = await Promise.all([
    getCustomersWithAddresses(),
    getProducts(),
    getPolicies(),
    requireOrganisation(),
  ]);
  const policyLibrary = forOrganisation(allPolicies, organisation.id);
  const locale = getLocalePack(profile.countryCode);
  const customers = forOrganisation(allCustomers, organisation.id);
  const today = todayIn(locale.timeZone);

  // The first New quote of a business: two questions first, for those who can answer them, when nothing
  // was set elsewhere (Quotes and invoices) and nobody has made a quote yet (staff can, without being asked).
  if (
    profile.quoteSetupAt === null &&
    canEditBusinessProfile(role) &&
    profile.defaultDepositKind === "none" &&
    profile.usualFulfilment === null &&
    !(await hasAnyQuote())
  ) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
        <div className="space-y-1">
          <Link href="/app/quotes" className="text-sm text-muted-foreground underline">
            Quotes
          </Link>
          <h1 className="text-xl font-semibold">New quote</h1>
        </div>
        <QuoteSetup />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <QuoteBuilder
        quoteId={null}
        header={
        <div className="space-y-1">
          <Link href="/app/quotes" className="text-sm text-muted-foreground underline">
            Quotes
          </Link>
          <h1 className="text-xl font-semibold">New quote</h1>
          <p className="text-sm text-muted-foreground">It gets its number the first time you save it.</p>
        </div>
        }
        initial={{
          customerId: "",
          issueDate: today,
          validUntil: addDays(today, DEFAULT_VALID_DAYS),
          neededBy: "",
          lines: [],
          // Delivery or collection, as the business usually works (set by the first-quote questions or under Quotes and invoices).
          fulfilment: profile.usualFulfilment ?? "none",
          deliveryFee: "",
          deliveryAddress: "",
          discountKind: "none",
          discountValue: "",
          notes: "",
          title: "",
          description: "",
          // A new quote starts with the wording the business has set for all its quotes.
          signOff: profile.defaultSignOff ?? "",
          terms: profile.defaultTerms ?? "",
          paymentInstructions: profile.paymentInstructions ?? "",
          // Bank details print by default; the switch on the quote turns them off for this one.
          showBankDetails: true,
          // Product photos show by default (each quote can switch them off).
          showPhotos: true,
          // The deposit the business has set as its default, if any (the balance starts on collection or delivery).
          depositKind: profile.defaultDepositKind,
          depositValue:
            profile.defaultDepositKind === "percent"
              ? percentToInput(profile.defaultDepositValue, locale.numberStyle)
              : profile.defaultDepositKind === "fixed"
                ? moneyToInput(profile.defaultDepositValue, locale.numberStyle)
                : "",
          balanceDue: "handover",
          balanceDueDate: "",
          // And the policies the business has marked to include on every new quote.
          policies: defaultQuotePolicies(policyLibrary),
        }}
        policyLibrary={policyLibrary}
        policyContent={locale.policies}
        canManagePolicies={canEditBusinessProfile(role)}
        bankDetails={bankPreview(bankDetails, locale)}
        canEditBankDetails={canEditBankDetails(role)}
        customers={customerOptions(customers, locale)}
        products={forOrganisation(allProducts, organisation.id)}
        vat={vatSettingsFor(profile, locale)}
        currencyCode={profile.currencyCode}
        countryCode={profile.countryCode}
        numberStyle={locale.numberStyle}
        taxName={locale.tax.name}
          vatStatuses={locale.tax.statuses}
          businessTypes={profile.businessTypes}
        justSaved={false}
      />
    </main>
  );
}
