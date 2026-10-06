import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrganisation } from "@/lib/auth/dal";
import { bankLines, bankSummary, canEditBankDetails } from "@/lib/bank";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { getLocalePack } from "@/lib/locale";
import { formatMoment } from "@/lib/quotes/dates";
import { formatDocumentNumber } from "@/lib/quotes/numbering";
import { getQuoteSequences, sequenceFor } from "@/lib/quotes/sequence";
import { bankFormValues } from "@/lib/bank/form";
import { BankDetailsForm } from "./bank-details-form";
import { BusinessProfileForm, type FormValues } from "./business-profile-form";
import { QuoteNumberingForm } from "./quote-numbering-form";
import { QuoteWordingForm } from "./quote-wording-form";

export default async function BusinessProfilePage() {
  // The numbering query runs beside the workspace check, not after it.
  const [{ organisation, profile, role, bankDetails }, sequences] = await Promise.all([requireOrganisation(), getQuoteSequences()]);
  const sequence = sequenceFor(sequences, organisation.id);

  const locale = getLocalePack(profile.countryCode);
  const initial: FormValues = {
    name: organisation.name,
    phone: profile.phone ?? "",
    email: profile.email ?? "",
    addressLine1: profile.addressLine1 ?? "",
    addressLine2: profile.addressLine2 ?? "",
    city: profile.city ?? "",
    region: profile.region ?? "",
    postalCode: profile.postalCode ?? "",
    vatRegistered: profile.vatRegistered,
    vatNumber: profile.vatNumber ?? "",
    pricesIncludeVat: profile.pricesIncludeVat ? "inclusive" : "exclusive",
  };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <h1 className="text-xl font-semibold">Business profile</h1>

      {canEditBusinessProfile(role) ? (
        <BusinessProfileForm initial={initial} countryCode={profile.countryCode} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Business details</CardTitle>
            <CardDescription className="text-base">
              Only owners and admins can change these details. You can see them on your
              quotes and invoices.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {canEditBankDetails(role) ? (
        <BankDetailsForm
          initial={bankFormValues(bankDetails, profile.countryCode)}
          countryCode={profile.countryCode}
          lastChanged={bankDetails ? formatMoment(bankDetails.updatedAt, locale.formatLocale, locale.timeZone) : null}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Bank details</CardTitle>
            <CardDescription className="text-base">
              {bankDetails
                ? `${bankSummary(bankDetails, locale)}. They are shown on your quotes. `
                : "No bank details are saved yet. "}
              Only the owner can change them, because they decide where customers send money.
            </CardDescription>
          </CardHeader>
          {bankDetails && (
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-base">
                {bankLines(bankDetails, null, locale).map((line) => (
                  <div key={line.label} className="contents">
                    <dt className="text-muted-foreground">{line.label}</dt>
                    <dd>{line.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quote policies</CardTitle>
          <CardDescription className="text-base">
            Cancellation, changes, aftercare and the rest: write each once, in your own words,
            and tick them onto your quotes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/app/business/policies" className={buttonVariants({ variant: "outline" })}>
            Manage quote policies
          </Link>
        </CardContent>
      </Card>

      {canEditBusinessProfile(role) && (
        <QuoteWordingForm
          otherWaysHint={locale.payment.otherWaysHint}
          initial={{
            signOff: profile.defaultSignOff ?? "",
            terms: profile.defaultTerms ?? "",
            paymentInstructions: profile.paymentInstructions ?? "",
          }}
        />
      )}

      {canEditBusinessProfile(role) ? (
        <QuoteNumberingForm
          initialPrefix={sequence.prefix}
          initialNext={sequence.nextNumber}
          minDigits={sequence.minDigits}
          lastIssued={sequence.lastIssued}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quote numbers</CardTitle>
            <CardDescription className="text-base">
              Your next quote will be {formatDocumentNumber(sequence.prefix, sequence.nextNumber, sequence.minDigits)}.
              Only owners and admins can change how quotes are numbered.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </main>
  );
}
