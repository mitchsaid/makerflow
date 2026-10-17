import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { getLocalePack } from "@/lib/locale";
import { currencySymbol } from "@/lib/money";
import { usualsFromProfile } from "@/lib/quotes/usuals";
import { formatDocumentNumber } from "@/lib/quotes/numbering";
import { getInvoiceSequences, getQuoteSequences, sequenceFor } from "@/lib/quotes/sequence";
import { DEFAULT_INVOICE_PREFIX } from "@/lib/quotes/numbering";
import { DepositDefaultForm } from "./deposit-default-form";
import { HandoverDefaultForm } from "./handover-default-form";
import { DiscountDefaultForm } from "./discount-default-form";
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
  const [{ organisation, profile, role }, sequences, invoiceSequences] = await Promise.all([requireOrganisation(), getQuoteSequences(), getInvoiceSequences()]);
  const sequence = sequenceFor(sequences, organisation.id);
  const invoiceSequence = sequenceFor(invoiceSequences, organisation.id, DEFAULT_INVOICE_PREFIX);
  const locale = getLocalePack(profile.countryCode);
  const usuals = usualsFromProfile(profile, locale.numberStyle);
  const canEdit = canEditBusinessProfile(role);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <h1 className="text-xl font-semibold">Quotes and invoices</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Terms</CardTitle>
          <CardDescription className="text-base">
            Write each term once, then add it to any quote.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/app/documents/policies" className={buttonVariants({ variant: "outline" })}>
            Manage your terms
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quote themes</CardTitle>
          <CardDescription className="text-base">
            Colours, fonts and layout. Start from a starter, remix it, or build your own.
            {canEdit && (
              <>
                {" "}
                Your logo is in the{" "}
                <Link href="/app/business#logo" className="underline">
                  Business profile
                </Link>
                .
              </>
            )}
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
            description: usuals.description,
            signOff: usuals.signOff,
            paymentInstructions: usuals.paymentInstructions,
          }}
        />
      )}

      {canEdit && (
        <DepositDefaultForm
          symbol={currencySymbol(profile.currencyCode, locale.numberStyle)}
          initial={{ kind: usuals.depositKind, value: usuals.depositValue }}
        />
      )}

      {canEdit && (
        <DiscountDefaultForm
          symbol={currencySymbol(profile.currencyCode, locale.numberStyle)}
          initial={{ kind: usuals.discountKind, value: usuals.discountValue }}
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
              Next quote: {formatDocumentNumber(sequence.prefix, sequence.nextNumber, sequence.minDigits)}. Only owners and admins can change numbering.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {canEdit ? (
        <QuoteNumberingForm
          docType="invoice"
          initialPrefix={invoiceSequence.prefix}
          initialNext={invoiceSequence.nextNumber}
          minDigits={invoiceSequence.minDigits}
          lastIssued={invoiceSequence.lastIssued}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Invoice numbers</CardTitle>
            <CardDescription className="text-base">
              Next invoice: {formatDocumentNumber(invoiceSequence.prefix, invoiceSequence.nextNumber, invoiceSequence.minDigits)}. Only owners and admins can change numbering.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </main>
  );
}
