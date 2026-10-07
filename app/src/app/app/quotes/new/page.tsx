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

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <div className="space-y-1">
        <Link href="/app/quotes" className="text-sm text-muted-foreground underline">
          Quotes
        </Link>
        <h1 className="text-xl font-semibold">New quote</h1>
        <p className="text-sm text-muted-foreground">It gets its number the first time you save it.</p>
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
        justSaved={false}
      />
    </main>
  );
}
