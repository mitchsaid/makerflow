import Link from "@/components/app-link";
import { notFound } from "next/navigation";
import { ComingSoonSection } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireOrganisation } from "@/lib/auth/dal";
import { invoiceStatus } from "@/lib/invoices";
import { creditItemsOf, remainingItems } from "@/lib/credit-notes";
import { owingCentsOf, paidCentsOf, paymentRows, refundDueCentsOf } from "@/lib/invoices/payments";
import { getInvoice } from "@/lib/invoices/data";
import { jobNumberText } from "@/lib/jobs";
import { getLocalePack } from "@/lib/locale";
import { currencySymbol, formatMoney } from "@/lib/money";
import { formatDay, formatMoment, todayIn } from "@/lib/quotes/dates";
import { PdfPreview } from "../../quotes/pdf-preview";
import { QuoteDocumentView } from "../../quotes/quote-document-view";
import { InvoiceStatusChip } from "../invoice-status-chip";
import { CreditNotesSection } from "../credit-notes-section";
import { PaymentsSection } from "../payments-section";
import { DesignSection } from "../../quotes/design-section";
import { themeFromStored } from "@/lib/quotes/themes";
import { ShareInvoice } from "../share-invoice";

/** An issued invoice: read-only, drawn from its stored document. Nothing on this page changes it. */
export default async function InvoicePage({ params }: PageProps<"/app/invoices/[id]">) {
  const { id } = await params;
  const [invoice, { organisation, profile }] = await Promise.all([getInvoice(id), requireOrganisation()]);
  // Another business of the same person is not this workspace's invoice.
  if (invoice.organisationId !== organisation.id) notFound();

  const locale = getLocalePack(profile.countryCode);
  const today = todayIn(locale.timeZone);
  const money = (cents: number) => formatMoney(cents, invoice.currencyCode, locale.numberStyle);
  const paidCents = paidCentsOf(invoice.payments);
  const creditedCents = invoice.creditNotes.reduce((sum, c) => sum + c.grossCents, 0);
  const owingCents = owingCentsOf(invoice.grossCents, paidCents, creditedCents);
  const refundDueCents = refundDueCentsOf(invoice.grossCents, paidCents, creditedCents);
  const status = invoiceStatus({ grossCents: invoice.grossCents, creditedCents, paidCents, dueDate: invoice.dueDate, today });
  const vat = invoice.snapshot.vat;
  const title = invoice.snapshot.wording.title;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <PageHeader back={{ href: "/app/invoices", label: "Invoices" }}>
        <h1 id="invoice-title" tabIndex={-1} className="flex flex-wrap items-center gap-3 text-xl font-semibold outline-none">
          <span>
            {title} {invoice.number}
          </span>{" "}
          <InvoiceStatusChip status={status} />
        </h1>
      </PageHeader>

      <ShareInvoice invoiceId={invoice.id} number={invoice.number} />

      <Card>
        <CardContent className="space-y-2">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-base">
            <dt className="text-muted-foreground">For</dt>
            <dd className="font-medium">{invoice.customerName}</dd>
            <dt className="text-muted-foreground">Total</dt>
            <dd className="font-medium" data-testid="invoice-total">
              {money(invoice.grossCents)}
            </dd>
            {creditedCents > 0 && (
              <>
                <dt className="text-muted-foreground">Credited</dt>
                <dd data-testid="invoice-credited">{money(creditedCents)}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Owing</dt>
            <dd data-testid="invoice-owing">{money(owingCents)}</dd>
            <dt className="text-muted-foreground">Invoice date</dt>
            <dd>{formatDay(invoice.issueDate, locale.formatLocale)}</dd>
            <dt className="text-muted-foreground">Due</dt>
            <dd>{formatDay(invoice.dueDate, locale.formatLocale)}</dd>
          </dl>
          <p className="text-sm text-muted-foreground" data-testid="invoice-origin">
            {invoice.quote ? (
              <>
                Made from{" "}
                <Link href={`/app/quotes/${invoice.quote.id}`} className="font-medium underline">
                  quote {invoice.quote.number}
                </Link>
                {invoice.adjusted && ", and changed before it was sent"}
              </>
            ) : (
              "Made without a quote"
            )}
            {invoice.job && (
              <>
                {" "}
                and{" "}
                <Link href={`/app/jobs/${invoice.job.id}`} className="font-medium underline">
                  job {jobNumberText(invoice.job.number)}
                </Link>
              </>
            )}
            . It can&apos;t be changed. If something is wrong, a credit note corrects it.
          </p>
        </CardContent>
      </Card>

      <PaymentsSection
        invoiceId={invoice.id}
        number={invoice.number}
        currencyCode={invoice.currencyCode}
        numberStyle={locale.numberStyle}
        formatLocale={locale.formatLocale}
        symbol={currencySymbol(invoice.currencyCode, locale.numberStyle)}
        today={today}
        grossCents={invoice.grossCents - creditedCents}
        paidCents={paidCents}
        rows={paymentRows(invoice.payments)}
        methods={locale.payment.methods}
        depositCents={invoice.depositCents}
        depositNote={locale.documents.invoice.depositNote}
        fullyCredited={status === "credited"}
      />

      <CreditNotesSection
        invoiceId={invoice.id}
        number={invoice.number}
        currencyCode={invoice.currencyCode}
        numberStyle={locale.numberStyle}
        formatLocale={locale.formatLocale}
        symbol={currencySymbol(invoice.currencyCode, locale.numberStyle)}
        today={today}
        invoiceDate={invoice.issueDate}
        reasons={locale.documents.creditNote.reasons}
        notes={invoice.creditNotes.map((c) => ({ id: c.id, number: c.number, issueDate: c.issueDate, reason: c.reason, grossCents: c.grossCents }))}
        items={remainingItems(creditItemsOf(invoice.snapshot), invoice.creditNotes.flatMap((c) => c.lines))}
        vat={vat.registered && vat.entry && vat.rateBp !== null ? { registered: true, entry: vat.entry, standardRateBp: vat.rateBp } : { registered: false }}
        taxName={vat.taxName}
        invoiceGroups={invoice.snapshot.totals.groups}
        priorGroups={invoice.creditNotes.flatMap((c) => c.groups)}
        creditedCents={creditedCents}
        totalCents={invoice.grossCents}
        refundDueCents={refundDueCents}
      />

      <section className="space-y-3" aria-label="Coming soon">
        <ComingSoonSection title="Email it to your customer" description="Send it from MakerFlow and see when it was sent." />
      </section>

      {/* A sent invoice is locked to the theme it went out with. */}
      <DesignSection theme={themeFromStored(invoice.snapshot)} what="invoice" />

      <PdfPreview url={`/app/invoices/${invoice.id}/pdf?v=${invoice.payments.length}-${paidCents}-${creditedCents}`} label={`${title} ${invoice.number}`} />
      {/* The same document as text, for people who can't read the pictures of the pages. */}
      <section className="sr-only" aria-label="The invoice as text">
        <QuoteDocumentView snapshot={invoice.snapshot} />
      </section>

      <section className="space-y-2" aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="text-base font-semibold">
          Activity
        </h2>
        <Card>
          <CardContent>
            <ol className="space-y-2" data-testid="activity">
              {invoice.events.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-4 text-base">
                  <span>Sent as {invoice.number}</span>
                  <span className="text-sm text-muted-foreground">{formatMoment(e.at, locale.formatLocale, locale.timeZone)}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
