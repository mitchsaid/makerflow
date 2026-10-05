import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { formatDocumentNumber } from "@/lib/quotes/numbering";
import { getQuoteSequences, sequenceFor } from "@/lib/quotes/sequence";
import { BusinessProfileForm, type FormValues } from "./business-profile-form";
import { QuoteNumberingForm } from "./quote-numbering-form";
import { QuoteWordingForm } from "./quote-wording-form";

export default async function BusinessProfilePage() {
  // The numbering query runs beside the workspace check, not after it.
  const [{ organisation, profile, role }, sequences] = await Promise.all([requireOrganisation(), getQuoteSequences()]);
  const sequence = sequenceFor(sequences, organisation.id);

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

      {canEditBusinessProfile(role) && (
        <QuoteWordingForm
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
