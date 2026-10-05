import Link from "next/link";
import { notFound } from "next/navigation";
import { ComingSoonSection } from "@/components/coming-soon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireOrganisation } from "@/lib/auth/dal";
import { getCustomers } from "@/lib/customers/data";
import { getProducts } from "@/lib/products/data";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { getPolicies } from "@/lib/policies/data";
import { forOrganisation } from "@/lib/scope";
import { getLocalePack, vatSettingsFor } from "@/lib/locale";
import { formatMoment, todayIn } from "@/lib/quotes/dates";
import { getStoredQuote, type StoredQuote } from "@/lib/quotes/data";
import { toFormValues } from "@/lib/quotes/form-values";
import { customerOptions } from "../builder-data";
import { QuoteBuilder } from "../quote-builder";
import { DesignSection } from "../design-section";
import { PdfPreview } from "../pdf-preview";
import { QuoteDocumentView } from "../quote-document-view";
import { SentQuoteActions } from "../sent-quote-actions";
import { StatusChip } from "../status-chip";
import { DeleteDraftButton } from "./delete-draft-button";

export default async function QuotePage({
  params,
  searchParams,
}: PageProps<"/app/quotes/[id]">) {
  const { id } = await params;
  // The quote and the customers load beside the workspace check, not after it.
  const [quote, allCustomers, allProducts, allPolicies, { organisation, profile, role }, query] = await Promise.all([
    getStoredQuote(id),
    getCustomers(),
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
          customers={customerOptions(customers)}
          products={forOrganisation(allProducts, organisation.id)}
          vat={vatSettingsFor(profile, locale)}
          currencyCode={profile.currencyCode}
          countryCode={profile.countryCode}
          numberStyle={locale.numberStyle}
          taxName={locale.tax.name}
          justSaved={query.saved === "1"}
          focusOnLoad={typeof query.focus === "string" ? query.focus : undefined}
          policyLibrary={forOrganisation(allPolicies, organisation.id)}
          policyContent={locale.policies}
          canManagePolicies={canEditBusinessProfile(role)}
        >
          {/* A quote that has been sent can never be deleted, and neither can its revision. */}
          {quote.versions.length === 0 && <DeleteDraftButton id={quote.id} />}
          {previous && (
            <ComingSoonSection
              title="Discard this revision"
              description={`Go back to version ${previous.version} as it was sent, and drop the changes you've made since.`}
            />
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
      <DesignSection design={shown.snapshot.design} sent />

      <section className="space-y-3" aria-labelledby="more-heading">
        <h2 id="more-heading" className="text-base font-semibold">
          What you can do next
        </h2>
        <ComingSoonSection
          title="Record accepted or declined"
          description="Note your customer's answer on the quote, and turn an accepted quote into a job."
        />
        <ComingSoonSection title="Quote again" description="Start a new quote for the same customer from this one." />
        <ComingSoonSection
          title="Withdraw this quote"
          description="Take it back if it should no longer be honoured. It stays on record."
        />
        <ComingSoonSection
          title="Email it to your customer"
          description="We'll send it from MakerFlow, with a message, and show when it was sent."
        />
        <ComingSoonSection
          title="Send a link they can accept online"
          description="Your customer opens the quote, accepts it or asks for changes, and you see it here."
        />
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
                <span>{words(e)}</span>
                <span className="text-sm text-muted-foreground">{formatMoment(e.at, locale, timeZone)}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </section>
  );
}
