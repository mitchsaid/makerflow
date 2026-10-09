import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { getLocalePack } from "@/lib/locale";
import { currencySymbol, moneyToInput, percentToInput } from "@/lib/money";
import { formatDocumentNumber } from "@/lib/quotes/numbering";
import { getQuoteSequences, sequenceFor } from "@/lib/quotes/sequence";
import { DepositDefaultForm } from "./deposit-default-form";
import { HandoverDefaultForm } from "./handover-default-form";
import { LogoForm } from "./logo-form";
import { QuoteNumberingForm } from "./quote-numbering-form";
import { QuoteWordingForm } from "./quote-wording-form";

/**
 * Quotes and invoices: how documents are numbered and worded, the terms library and what a new
 * quote starts with. Facts about the business (name, contact, address, VAT, what you make, bank
 * details) stay on the Business profile; this is the settings for the documents themselves, and
 * invoices will add their own sections here.
 */
export default async function DocumentSettingsPage() {
  // The numbering query runs beside the workspace check, not after it.
  const [{ organisation, profile, role }, sequences] = await Promise.all([requireOrganisation(), getQuoteSequences()]);
  const sequence = sequenceFor(sequences, organisation.id);
  const locale = getLocalePack(profile.countryCode);
  const canEdit = canEditBusinessProfile(role);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <h1 className="text-xl font-semibold">Quotes and invoices</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Terms</CardTitle>
          <CardDescription className="text-base">
            Lead times, cancellation, changes, aftercare and the rest: write each once, in your own words, and tick them
            onto your quotes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/app/documents/policies" className={buttonVariants({ variant: "outline" })}>
            Manage your terms
          </Link>
        </CardContent>
      </Card>

      {canEdit && <LogoForm initial={profile.logoImageId ?? ""} businessName={organisation.name} />}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quote themes</CardTitle>
          <CardDescription className="text-base">
            How your quotes look: colours, fonts, the top of the page, how items are shown and the total. Start from
            a starter, remix it, or build your own from scratch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/app/documents/themes" className={buttonVariants({ variant: "outline" })}>
            Manage themes
          </Link>
        </CardContent>
      </Card>

      {canEdit && (
        <QuoteWordingForm
          otherWaysHint={locale.payment.otherWaysHint}
          initial={{
            signOff: profile.defaultSignOff ?? "",
            paymentInstructions: profile.paymentInstructions ?? "",
          }}
        />
      )}

      {canEdit && (
        <DepositDefaultForm
          symbol={currencySymbol(profile.currencyCode, locale.numberStyle)}
          initial={{
            kind: profile.defaultDepositKind,
            value:
              profile.defaultDepositKind === "percent"
                ? percentToInput(profile.defaultDepositValue, locale.numberStyle)
                : profile.defaultDepositKind === "fixed"
                  ? moneyToInput(profile.defaultDepositValue, locale.numberStyle)
                  : "",
          }}
        />
      )}

      {canEdit && <HandoverDefaultForm initial={profile.usualFulfilment ?? "none"} />}

      {canEdit ? (
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
