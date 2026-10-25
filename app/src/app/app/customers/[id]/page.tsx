import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AddLink } from "@/components/add-button";
import { PageHeader } from "@/components/page-header";
import { SectionTabs, type SectionLink } from "@/components/section-switch";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireOrganisation } from "@/lib/auth/dal";
import { customerOverview } from "@/lib/customers/overview";
import { getCustomerPage } from "@/lib/customers/page-data";
import { draftRowsOf } from "@/lib/invoices/draft";
import { getLocalePack, vatSettingsFor } from "@/lib/locale";
import { formatMoney } from "@/lib/money";
import { todayIn } from "@/lib/quotes/dates";
import { InvoiceDraftRow } from "../../invoices/invoice-draft-row";
import { InvoiceRow } from "../../invoices/invoice-row";
import { JobRow } from "../../jobs/job-row";
import { QuoteRow } from "../../quotes/quote-row";
import { updateCustomer } from "../actions";
import { CustomerForm } from "../customer-form";
import { valuesFromCustomer } from "../customer-values";
import { ArchiveButton } from "./archive-button";

const SECTIONS = ["quotes", "jobs", "invoices", "details"] as const;
type Section = (typeof SECTIONS)[number];
const LABELS: Record<Section, string> = { quotes: "Quotes", jobs: "Jobs", invoices: "Invoices", details: "Details" };

export default async function CustomerPage({ params, searchParams }: PageProps<"/app/customers/[id]">) {
  const { id } = await params;
  // The customer (with their quotes, jobs and invoices) is one query, beside the workspace check.
  const [{ customer, quotes: allQuotes, jobs: allJobs, invoices: allInvoices, drafts: allDrafts }, { organisation, profile }, query] = await Promise.all([
    getCustomerPage(id),
    requireOrganisation(),
    searchParams,
  ]);
  // Another business of the same person is not this workspace's customer.
  if (customer.organisationId !== organisation.id) notFound();

  const locale = getLocalePack(profile.countryCode);
  const today = todayIn(locale.timeZone);
  const quotes = allQuotes.filter((q) => q.organisationId === organisation.id);
  const jobs = allJobs.filter((j) => j.organisationId === organisation.id);
  const invoices = allInvoices.filter((i) => i.organisationId === organisation.id);
  const drafts = draftRowsOf(allDrafts.filter((d) => d.organisationId === organisation.id), vatSettingsFor(profile, locale));
  const creditNotes = invoices.reduce((sum, i) => sum + i.creditNoteCount, 0);
  const overview = customerOverview({ quotes, jobs, invoices, today });
  const money = (cents: number) => formatMoney(cents, profile.currencyCode, locale.numberStyle);

  const wanted = typeof query.section === "string" ? query.section : "quotes";
  const section: Section = (SECTIONS as readonly string[]).includes(wanted) ? (wanted as Section) : "quotes";
  const base = `/app/customers/${customer.id}`;
  const items: SectionLink<Section>[] = SECTIONS.map((key) => ({ key, label: LABELS[key], href: key === "quotes" ? base : `${base}?section=${key}` }));
  const rowProps = { today, formatLocale: locale.formatLocale, numberStyle: locale.numberStyle, hideCustomer: true };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <PageHeader back={{ href: "/app/customers", label: "Customers" }}>
        <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold">
          <span>{customer.name}</span>
          {customer.kind === "business" && <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">Business</span>}
        </h1>
        {(customer.phone || customer.email) && (
          <p className="flex flex-wrap gap-x-4 text-base">
            {customer.phone && (
              <a href={`tel:${customer.phone.replace(/[^0-9+]/g, "")}`} className="font-medium underline">
                {customer.phone}
              </a>
            )}
            {customer.email && (
              <a href={`mailto:${customer.email}`} className="font-medium underline">
                {customer.email}
              </a>
            )}
          </p>
        )}
      </PageHeader>

      {customer.archived && (
        <Alert data-testid="archived-notice">
          <AlertDescription>Archived: hidden from your list. Restore it in Details to use it again.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="space-y-3">
          {/* What needs attention for this customer; a count of nothing is left out (docs/ux-review-2026-10-25.md, N7). */}
          {overview.owingCents > 0 || overview.openQuotes > 0 || overview.jobsInProgress > 0 ? (
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-base" data-testid="customer-overview">
              {overview.owingCents > 0 && (
                <>
                  <dt className="text-muted-foreground">Owing</dt>
                  <dd className="font-medium" data-testid="customer-owing">
                    <Link href={`${base}?section=invoices`} className="underline">{money(overview.owingCents)}</Link>
                  </dd>
                </>
              )}
              {overview.openQuotes > 0 && (
                <>
                  <dt className="text-muted-foreground">Quotes waiting for an answer</dt>
                  <dd data-testid="customer-open-quotes">{overview.openQuotes}</dd>
                </>
              )}
              {overview.jobsInProgress > 0 && (
                <>
                  <dt className="text-muted-foreground">Jobs in progress</dt>
                  <dd data-testid="customer-jobs-in-progress">{overview.jobsInProgress}</dd>
                </>
              )}
            </dl>
          ) : (
            <p className="text-base text-muted-foreground" data-testid="customer-overview">
              Nothing owing, waiting or being made.
            </p>
          )}
          <Link href={`${base}/statement`} className={buttonVariants({ variant: "outline", size: "lg" })}>
            Statement of account
          </Link>
        </CardContent>
      </Card>

      <SectionTabs
        label={`${customer.name}: quotes, jobs, invoices or details`}
        items={items}
        initial={section}
        panels={{
          quotes: (
            <section className="space-y-3" aria-label="Quotes">
              <AddLink href={`/app/quotes/new?customer=${customer.id}`} variant="outline">
                New quote
              </AddLink>
              {quotes.length === 0 ? (
                <EmptyState title="No quotes yet" line="A quote you make for this customer will show here." />
              ) : (
                <ul className="space-y-2">
                  {quotes.map((q) => (
                    <QuoteRow key={q.id} quote={q} {...rowProps} />
                  ))}
                </ul>
              )}
            </section>
          ),
          jobs: (
            <section className="space-y-3" aria-label="Jobs">
              <AddLink href={`/app/jobs/new?customer=${customer.id}`} variant="outline">
                New job
              </AddLink>
              {jobs.length === 0 ? (
                <EmptyState title="No jobs yet" line="Work you make for this customer will show here." />
              ) : (
                <ul className="space-y-2">
                  {jobs.map((j) => (
                    <JobRow key={j.id} job={j} {...rowProps} />
                  ))}
                </ul>
              )}
            </section>
          ),
          invoices: (
            <section className="space-y-3" aria-label="Invoices">
              <AddLink href={`/app/invoices/new?customer=${customer.id}`} variant="outline">
                New invoice
              </AddLink>
              {invoices.length === 0 && drafts.length === 0 ? (
                <EmptyState title="No invoices yet" line="Open an accepted quote and choose Create invoice." />
              ) : (
                <>
                  {creditNotes > 0 && (
                    <p className="text-sm text-muted-foreground" data-testid="customer-credit-notes">
                      {creditNotes} {creditNotes === 1 ? "credit note" : "credit notes"} on these invoices
                    </p>
                  )}
                  <ul className="space-y-2">
                    {drafts.map((d) => (
                      <InvoiceDraftRow key={d.id} draft={d} currencyCode={profile.currencyCode} formatLocale={locale.formatLocale} numberStyle={locale.numberStyle} />
                    ))}
                    {invoices.map((i) => (
                      <InvoiceRow key={i.id} invoice={i} {...rowProps} />
                    ))}
                  </ul>
                </>
              )}
            </section>
          ),
          details: (
            <section className="space-y-6" aria-label="Details">
              <CustomerForm
                key={customer.id}
                mode="edit"
                action={updateCustomer.bind(null, customer.id)}
                initial={valuesFromCustomer(customer)}
                countryCode={profile.countryCode}
              />
              <ArchiveButton id={customer.id} archived={customer.archived} />
            </section>
          ),
        }}
      />
    </main>
  );
}
