import { requireOrganisation } from "@/lib/auth/dal";
import { getCustomersWithAddresses } from "@/lib/customers/data";
import { getProducts } from "@/lib/products/data";
import { bankPreview, canEditBankDetails } from "@/lib/bank";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { defaultQuotePolicies } from "@/lib/policies";
import { getPolicies } from "@/lib/policies/data";
import { getQuoteSequences, sequenceFor } from "@/lib/quotes/sequence";
import { forOrganisation } from "@/lib/scope";
import { getLocalePack, vatSettingsFor } from "@/lib/locale";
import { usualsFromProfile } from "@/lib/quotes/usuals";
import { addDays, DEFAULT_VALID_DAYS, todayIn } from "@/lib/quotes/dates";
import { customerOptions } from "../builder-data";
import { QuoteBuilder } from "../quote-builder";

export default async function NewQuotePage() {
  // Customers and products load beside the workspace check, not after it.
  const [allCustomers, allProducts, allPolicies, sequences, { organisation, profile, role, bankDetails }] = await Promise.all([
    getCustomersWithAddresses(),
    getProducts(),
    getPolicies(),
    getQuoteSequences(),
    requireOrganisation(),
  ]);
  const sequence = sequenceFor(sequences, organisation.id);
  const policyLibrary = forOrganisation(allPolicies, organisation.id);
  const locale = getLocalePack(profile.countryCode);
  const customers = forOrganisation(allCustomers, organisation.id);
  const today = todayIn(locale.timeZone);
  const usuals = usualsFromProfile(profile, locale.numberStyle);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <QuoteBuilder
        quoteId={null}
        header={
          // A new quote has its X to cancel; there is no page above it to go back to.
          <div className="space-y-1 pt-2">
            <h1 className="text-xl font-semibold">New quote</h1>
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
          // The discount the business usually gives, if any (the section then opens with it).
          discountKind: usuals.discountKind,
          discountValue: usuals.discountValue,
          notes: "",
          title: "",
          // The introduction the business starts every quote with, if it has set one; otherwise a generic start from the
          // country's wording that shows how the box is used (the maker changes or clears it).
          description: usuals.description || locale.documents.quoteStart.description,
          // The same for the sign-off.
          signOff: usuals.signOff || locale.documents.quoteStart.signOff,
          paymentInstructions: usuals.paymentInstructions,
          // Bank details print by default; the switch on the quote turns them off for this one.
          showBankDetails: true,
          // Product photos show by default (each quote can switch them off).
          showPhotos: true,
          // Quantity prices are not mentioned on the quote unless the maker asks.
          showQuantityPrices: false,
          // The deposit the business has set as its default, if any (the balance starts on collection or delivery).
          // "Ask me each time" starts with nothing chosen: the deposit section puts the choice in front of the maker.
          depositKind: profile.defaultDepositKind === "ask" ? "none" : profile.defaultDepositKind,
          depositValue: profile.defaultDepositKind === "ask" ? "" : usuals.depositValue,
          balanceDue: "handover",
          balanceDueDate: "",
          balanceDueText: "",
          // And the terms the business has marked to include on every new quote.
          policies: defaultQuotePolicies(policyLibrary),
        }}
        policyLibrary={policyLibrary}
        policyContent={locale.policies}
        canManagePolicies={canEditBusinessProfile(role)}
        bankDetails={bankPreview(bankDetails, locale)}
        canEditBankDetails={canEditBankDetails(role)}
        usuals={usuals}
        canSaveUsuals={canEditBusinessProfile(role)}
        startingText={locale.documents.quoteStart}
        numbering={{
          prefix: sequence.prefix,
          nextNumber: sequence.nextNumber,
          minDigits: sequence.minDigits,
          lastIssued: sequence.lastIssued,
        }}
        canChangeNumbering={canEditBusinessProfile(role)}
        askForDeposit={profile.defaultDepositKind === "ask"}
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
