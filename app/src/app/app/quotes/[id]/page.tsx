import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requireOrganisation } from "@/lib/auth/dal";
import { forOrganisation } from "@/lib/customers";
import { getCustomers } from "@/lib/customers/data";
import { getLocalePack, vatSettingsFor } from "@/lib/locale";
import { getStoredQuote } from "@/lib/quotes/data";
import { toFormValues } from "@/lib/quotes/form-values";
import { customerOptions } from "../builder-data";
import { QuoteBuilder } from "../quote-builder";
import { DeleteDraftButton } from "./delete-draft-button";

export default async function QuotePage({
  params,
  searchParams,
}: PageProps<"/app/quotes/[id]">) {
  const { id } = await params;
  // The quote and the customers load beside the workspace check, not after it.
  const [quote, allCustomers, { organisation, profile }, query] = await Promise.all([
    getStoredQuote(id),
    getCustomers(),
    requireOrganisation(),
    searchParams,
  ]);
  // Another business of the same person is not this workspace's quote.
  if (quote.organisationId !== organisation.id) notFound();

  const locale = getLocalePack(profile.countryCode);
  const customers = forOrganisation(allCustomers, organisation.id);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <div className="space-y-1">
        <Link href="/app/quotes" className="text-sm text-muted-foreground underline">
          Quotes
        </Link>
        <h1 className="flex items-center gap-3 text-xl font-semibold">
          Quote
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium capitalize text-muted-foreground">
            {quote.status}
          </span>
        </h1>
      </div>

      {quote.status !== "draft" ? (
        <Alert>
          <AlertDescription>
            This quote has been sent, so it can no longer be changed here.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <QuoteBuilder
            key={quote.id}
            quoteId={quote.id}
            initial={toFormValues(quote, locale.numberStyle)}
            customers={customerOptions(customers)}
            vat={vatSettingsFor(profile, locale)}
            currencyCode={profile.currencyCode}
            numberStyle={locale.numberStyle}
            taxName={locale.tax.name}
            justSaved={query.saved === "1"}
          />
          <DeleteDraftButton id={quote.id} />
        </>
      )}
    </main>
  );
}
