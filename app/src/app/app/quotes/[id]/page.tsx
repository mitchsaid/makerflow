import Link from "next/link";
import { notFound } from "next/navigation";
import { ComingSoonSection } from "@/components/coming-soon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireOrganisation } from "@/lib/auth/dal";
import { getCustomersWithAddresses } from "@/lib/customers/data";
import { getProducts } from "@/lib/products/data";
import { bankPreview, canEditBankDetails } from "@/lib/bank";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { getPolicies } from "@/lib/policies/data";
import { forOrganisation } from "@/lib/scope";
import { getLocalePack, vatSettingsFor } from "@/lib/locale";
import { formatMoment, todayIn } from "@/lib/quotes/dates";
import { getStoredQuote, type StoredQuote } from "@/lib/quotes/data";
import { themeFromStored } from "@/lib/quotes/themes";
import { toFormValues } from "@/lib/quotes/form-values";
import { currentOutcome, outcomeSentence } from "@/lib/quotes/outcome";
import { customerOptions } from "../builder-data";
import { QuoteBuilder } from "../quote-builder";
import { DesignSection } from "../design-section";
import { PdfPreview } from "../pdf-preview";
import { ChangeAnswerButton, OutcomeButtons, QuoteAgainButton } from "../quote-outcome";
import { QuoteDocumentView } from "../quote-document-view";
import { SentQuoteActions } from "../sent-quote-actions";
import { StatusChip } from "../status-chip";
import { DeleteDraftButton } from "./delete-draft-button";
import { DiscardRevisionButton } from "./discard-revision-button";

export default async function QuotePage({
  params,
  searchParams,
}: PageProps<"/app/quotes/[id]">) {
  const { id } = await params;
  // The quote and the customers load beside the workspace check, not after it.
  const [quote, allCustomers, allProducts, allPolicies, { organisation, profile, role, bankDetails }, query] = await Promise.all([
    getStoredQuote(id),
    getCustomersWithAddresses(),
    getProducts(),
    getPolicies(),
    requireOrganisation(),
    searchParams,
  ]);
  // Another business of the same person is not this workspace's quote.
  if (quote.organisationId !== organisation.id) notFound();

  const locale = getLocalePack(profile.countryCode);
  const today = todayIn(locale.timeZone);
  const versionParam = typeof query.version === "string" && /^\d{1,4}$/.test(query.version) ? Number(query.version) : null;
  const viewing = versionParam !== null ? quote.versions.find((v) => v.version === versionParam) : undefined;
  if (versionParam !== null && !viewing) notFound();

  const header = (
    <div className="space-y-1">
      <Link href="/app/quotes" className="text-sm text-muted-foreground underline">
        Quotes
      </Link>
      <h1 className="flex flex-wrap items-center gap-3 text-xl font-semibold">
        <span>Quote {quote.number}</span>{" "}
        <StatusChip status={quote.status} version={quote.version} validUntil={quote.validUntil} today={today} />
      </h1>
    </div>
  );

  // A draft being edited (not looking at an earlier sent version).
  if (quote.status === "draft" && !viewing) {
    const customers = forOrganisation(allCustomers, organisation.id);
    const previous = quote.versions[0];
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
        {header}
        {previous && (
          <Alert data-testid="revising-note">
            <AlertDescription>
              You are working on version {quote.version}. Your customer still has version {previous.version},
              sent {formatMoment(previous.sentAt, locale.formatLocale, locale.timeZone)}, until you send this one.{" "}
              <Link href={`/app/quotes/${quote.id}?version=${previous.version}`} className="font-medium underline">
                View version {previous.version}
              </Link>
            </AlertDescription>
          </Alert>
        )}
        <QuoteBuilder
          key={quote.id}
          quoteId={quote.id}
          initial={toFormValues(quote, locale.numberStyle)}
          customers={customerOptions(customers, locale)}
          products={forOrganisation(allProducts, organisation.id)}
          vat={vatSettingsFor(profile, locale)}
          currencyCode={profile.currencyCode}
          countryCode={profile.countryCode}
          numberStyle={locale.numberStyle}
          taxName={locale.tax.name}
          vatStatuses={locale.tax.statuses}
          justSaved={query.saved === "1"}
          focusOnLoad={typeof query.focus === "string" ? query.focus : undefined}
          policyLibrary={forOrganisation(allPolicies, organisation.id)}
          policyContent={locale.policies}
          canManagePolicies={canEditBusinessProfile(role)}
          bankDetails={bankPreview(bankDetails, locale)}
          canEditBankDetails={canEditBankDetails(role)}
        >
          {/* A quote that has been sent can never be deleted, and neither can its revision. */}
          {quote.versions.length === 0 && <DeleteDraftButton id={quote.id} />}
          {previous && quote.canDiscardRevision && (
            <DiscardRevisionButton quoteId={quote.id} sentVersion={previous.version} />
          )}
        </QuoteBuilder>
      </main>
    );
  }

  // A sent quote, or an earlier version: read-only, from the frozen document.
  const shown = viewing ?? quote.versions[0];
  if (!shown) notFound();
  const latestSent = quote.versions[0];
  const isLatest = shown.version === latestSent.version;
  const canRevise = isLatest && quote.status === "sent";
  const outcome = currentOutcome(quote.status, quote.events);
  const answered = quote.status === "accepted" || quote.status === "declined";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      {header}

      {query.sent === "shared" && (
        <Alert data-testid="sent-banner">
          <AlertDescription>
            {quote.number} is sent and locked. If your share options closed before you chose an app, use
            Share PDF below.
          </AlertDescription>
        </Alert>
      )}
      {query.sent === "marked" && (
        <Alert data-testid="sent-banner">
          <AlertDescription>{quote.number} is marked as sent and locked.</AlertDescription>
        </Alert>
      )}
      {outcome && isLatest && (
        <Alert data-testid="outcome-banner">
          <AlertDescription className="space-y-1">
            <span className="block font-medium">{outcomeSentence(outcome, locale.formatLocale)}</span>
            {outcome.note && <span className="block">{outcome.note}</span>}
          </AlertDescription>
        </Alert>
      )}
      {!isLatest && (
        <Alert data-testid="earlier-version-note">
          <AlertDescription>
            This is version {shown.version}, an earlier version.{" "}
            <Link
              href={quote.status === "draft" ? `/app/quotes/${quote.id}` : `/app/quotes/${quote.id}?version=${latestSent.version}`}
              className="font-medium underline"
            >
              {quote.status === "draft" ? "Back to editing the new version" : `Go to version ${latestSent.version}`}
            </Link>
          </AlertDescription>
        </Alert>
      )}
      {quote.status === "draft" && isLatest && (
        <Alert data-testid="editing-note">
          <AlertDescription>
            Version {quote.version} of this quote is being edited.{" "}
            <Link href={`/app/quotes/${quote.id}`} className="font-medium underline">
              Back to editing
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <SentQuoteActions
        quoteId={quote.id}
        number={quote.number}
        version={shown.version}
        latest={canRevise}
      />

      <PdfPreview
        url={`/app/quotes/${quote.id}/pdf?version=${shown.version}`}
        label={`Quote ${quote.number}${shown.version > 1 ? `, version ${shown.version}` : ""}`}
      />
      {/* The same document as text, for people who can't read the pictures of the pages. */}
      <section className="sr-only" aria-label="The quote as text">
        <QuoteDocumentView snapshot={shown.snapshot} />
      </section>
      <DesignSection theme={themeFromStored(shown.snapshot)} />

      <section className="space-y-3" aria-labelledby="more-heading">
        <h2 id="more-heading" className="text-base font-semibold">
          What you can do next
        </h2>
        {canRevise && <OutcomeButtons quoteId={quote.id} number={quote.number} today={today} />}
        {isLatest && answered && <ChangeAnswerButton quoteId={quote.id} />}
        {isLatest && quote.status === "accepted" && (
          <ComingSoonSection
            title="Create a job"
            description="Turn the accepted quote into a job, with the items, the deposit and the dates carried over."
          />
        )}
        {isLatest && quote.status !== "draft" && <QuoteAgainButton quoteId={quote.id} />}
        {canRevise && (
          <>
            <ComingSoonSection
              title="Email it to your customer"
              description="We'll send it from MakerFlow, with a message, and show when it was sent."
            />
            <ComingSoonSection
              title="Send a link they can accept online"
              description="Your customer opens the quote, accepts it or asks for changes, and you see it here."
            />
          </>
        )}
      </section>

      <Versions quote={quote} shown={shown.version} />
      <Activity quote={quote} locale={locale.formatLocale} timeZone={locale.timeZone} />
    </main>
  );
}

function Versions({ quote, shown }: { quote: StoredQuote; shown: number }) {
  if (quote.versions.length < 2) return null;
  return (
    <section className="space-y-2" aria-labelledby="versions-heading">
      <h2 id="versions-heading" className="text-base font-semibold">
        Versions
      </h2>
      <ul className="flex flex-wrap gap-2">
        {quote.versions.map((v) => (
          <li key={v.version}>
            <Link
              href={`/app/quotes/${quote.id}?version=${v.version}`}
              aria-current={v.version === shown ? "page" : undefined}
              className={buttonVariants({ variant: v.version === shown ? "default" : "outline" })}
            >
              Version {v.version}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const SENT_VIA = { shared: "shared as a PDF", marked: "marked as sent" } as const;

function Activity({ quote, locale, timeZone }: { quote: StoredQuote; locale: string; timeZone: string }) {
  const words = (e: StoredQuote["events"][number]) => {
    if (e.kind === "created") return "Draft created";
    if (e.kind === "revised") return `Revised: version ${e.version} started`;
    if (e.kind === "discarded") return `Revision discarded: back to version ${e.version - 1}`;
    if (e.kind === "accepted" || e.kind === "declined" || e.kind === "withdrawn" || e.kind === "reopened") {
      return outcomeSentence(e, locale);
    }
    return `Version ${e.version} ${e.via ? SENT_VIA[e.via] : "sent"}`;
  };
  return (
    <section className="space-y-2" aria-labelledby="activity-heading">
      <h2 id="activity-heading" className="text-base font-semibold">
        Activity
      </h2>
      <Card>
        <CardContent>
          <ol className="space-y-2" data-testid="activity">
            {quote.events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-4 text-base">
                <span>
                  {words(e)}
                  {e.note && <span className="block text-sm text-muted-foreground">{e.note}</span>}
                </span>
                <span className="text-sm text-muted-foreground">{formatMoment(e.at, locale, timeZone)}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </section>
  );
}
