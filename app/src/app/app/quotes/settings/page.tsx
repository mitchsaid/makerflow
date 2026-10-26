import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { SectionTabs, type SectionLink } from "@/components/section-switch";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const SECTIONS = ["wording", "start", "numbers"] as const;
type Section = (typeof SECTIONS)[number];
const ITEMS: SectionLink<Section>[] = [
  { key: "wording", label: "Wording", href: "/app/quotes/settings" },
  { key: "start", label: "Starting values", href: "/app/quotes/settings?section=start" },
  { key: "numbers", label: "Numbers", href: "/app/quotes/settings?section=numbers" },
];

/**
 * Quote settings: how quotes are numbered and worded, the terms library, the themes and what a new quote starts with.
 * The terms and the themes are pages of their own, linked at the top; the rest is in three tabs (docs/plans/ux-pass-2.md, E).
 * They live with the quotes (reached from the Quotes page), not on a page of their own in the menu. Facts about the
 * business (name, contact, address, VAT, what you make, bank details) stay on the Business profile; invoice numbering
 * is under Invoices.
 */
export default async function QuoteSettingsPage({ searchParams }: PageProps<"/app/quotes/settings">) {
  // The numbering query runs beside the workspace check, not after it.
  const [{ organisation, profile, role }, sequences, query] = await Promise.all([
    requireOrganisation(),
    getQuoteSequences(),
    searchParams,
  ]);
  const sequence = sequenceFor(sequences, organisation.id);
  const locale = getLocalePack(profile.countryCode);
  const usuals = usualsFromProfile(profile, locale.numberStyle);
  const canEdit = canEditBusinessProfile(role);
  const symbol = currencySymbol(profile.currencyCode, locale.numberStyle);
  const wanted = typeof query.section === "string" ? query.section : "wording";
  const section: Section = (SECTIONS as readonly string[]).includes(wanted) ? (wanted as Section) : "wording";
  const onlyOwners = (
    <Card>
      <CardHeader>
        <CardDescription className="text-base">Only owners and admins can change these.</CardDescription>
      </CardHeader>
    </Card>
  );

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <PageHeader back={{ href: "/app/quotes", label: "Quotes" }}>
        <h1 className="text-xl font-semibold">Quote settings</h1>
      </PageHeader>

      <div className="space-y-2">
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/app/quotes/settings/policies" className={buttonVariants({ variant: "outline", size: "lg" })}>
            Manage your terms
          </Link>
          <Link href="/app/quotes/settings/themes" className={buttonVariants({ variant: "outline", size: "lg" })}>
            Manage themes
          </Link>
        </div>
        {canEdit && (
          <p className="text-sm text-muted-foreground">
            Your logo is in the{" "}
            <Link href="/app/business?section=logo" className="underline">
              Business profile
            </Link>
            .
          </p>
        )}
      </div>

      <SectionTabs
        label="Quote settings"
        items={ITEMS}
        initial={section}
        panels={{
          wording: canEdit ? (
            <QuoteWordingForm
              otherWaysHint={locale.payment.otherWaysHint}
              signers={{ business: organisation.name, owner: profile.ownerName }}
              initial={{
                description: usuals.description,
                signOff: usuals.signOff,
                signOffAs: profile.signOffAs,
                signOffOther: profile.signOffOther ?? "",
                paymentInstructions: usuals.paymentInstructions,
              }}
            />
          ) : (
            onlyOwners
          ),
          start: canEdit ? (
            <>
              <DepositDefaultForm symbol={symbol} initial={{ kind: usuals.depositKind, value: usuals.depositValue }} />
              <DiscountDefaultForm symbol={symbol} initial={{ kind: usuals.discountKind, value: usuals.discountValue }} />
              <HandoverDefaultForm initial={profile.usualFulfilment ?? "none"} />
            </>
          ) : (
            onlyOwners
          ),
          numbers: canEdit ? (
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
          ),
        }}
      />
    </main>
  );
}
