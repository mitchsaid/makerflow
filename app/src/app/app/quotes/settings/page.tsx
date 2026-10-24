import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { getLocalePack } from "@/lib/locale";
import { currencySymbol } from "@/lib/money";
import { usualsFromProfile } from "@/lib/quotes/usuals";
import { formatDocumentNumber } from "@/lib/quotes/numbering";
import { getQuoteSequences, sequenceFor } from "@/lib/quotes/sequence";
import { DepositDefaultForm } from "./deposit-default-form";
import { HandoverDefaultForm } from "./handover-default-form";
import { DiscountDefaultForm } from "./discount-default-form";
import { QuoteNumberingForm } from "./quote-numbering-form";
import { QuoteWordingForm } from "./quote-wording-form";

/**
 * Quote settings: how quotes are numbered and worded, the terms library, the themes and what a new quote starts with.
 * They live with the quotes (reached from the Quotes page), not on a page of their own in the menu. Facts about the
 * business (name, contact, address, VAT, what you make, bank details) stay on the Business profile; invoice numbering
 * is under Invoices.
 */
export default async function QuoteSettingsPage() {
  // The numbering query runs beside the workspace check, not after it.
  const [{ organisation, profile, role }, sequences] = await Promise.all([requireOrganisation(), getQuoteSequences()]);
  const sequence = sequenceFor(sequences, organisation.id);
  const locale = getLocalePack(profile.countryCode);
  const usuals = usualsFromProfile(profile, locale.numberStyle);
  const canEdit = canEditBusinessProfile(role);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <PageHeader back={{ href: "/app/quotes", label: "Quotes" }}>
        <h1 className="text-xl font-semibold">Quote settings</h1>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Terms</CardTitle>
          <CardDescription className="text-base">
            Write each term once, then add it to any quote.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/app/quotes/settings/policies" className={buttonVariants({ variant: "outline" })}>
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
          <Link href="/app/quotes/settings/themes" className={buttonVariants({ variant: "outline" })}>
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

    </main>
  );
}
