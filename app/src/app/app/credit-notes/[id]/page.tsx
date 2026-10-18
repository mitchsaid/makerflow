import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireOrganisation } from "@/lib/auth/dal";
import { getCreditNote } from "@/lib/credit-notes/data";
import { getLocalePack } from "@/lib/locale";
import { formatMoney } from "@/lib/money";
import { formatDay, formatMoment } from "@/lib/quotes/dates";
import { PdfPreview } from "../../quotes/pdf-preview";
import { QuoteDocumentView } from "../../quotes/quote-document-view";
import { ShareDocument } from "../../invoices/share-invoice";

/** An issued credit note: read-only, drawn from its stored document. Nothing on this page changes it. */
export default async function CreditNotePage({ params }: PageProps<"/app/credit-notes/[id]">) {
  const { id } = await params;
  const [note, { organisation, profile }] = await Promise.all([getCreditNote(id), requireOrganisation()]);
  // Another business of the same person is not this workspace's credit note.
  if (note.organisationId !== organisation.id) notFound();

  const locale = getLocalePack(profile.countryCode);
  const money = (cents: number) => formatMoney(cents, note.currencyCode, locale.numberStyle);
  const title = note.snapshot.wording.title;
  const vat = note.snapshot.vat.registered;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <PageHeader back={{ href: `/app/invoices/${note.invoiceId}`, label: `Invoice ${note.invoiceNumber}` }}>
        <h1 id="credit-note-title" tabIndex={-1} className="text-xl font-semibold outline-none">
          {title} {note.number}
        </h1>
      </PageHeader>

      <ShareDocument url={`/app/credit-notes/${note.id}/pdf`} number={note.number} title={title} />

      <Card>
        <CardContent className="space-y-2">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-base">
            <dt className="text-muted-foreground">For</dt>
            <dd className="font-medium">{note.customerName}</dd>
            <dt className="text-muted-foreground">Credited</dt>
            <dd className="font-medium" data-testid="credit-note-total">
              {money(note.grossCents)}
            </dd>
            {vat && (
              <>
                <dt className="text-muted-foreground">Includes VAT</dt>
                <dd>{money(note.snapshot.totals.vatCents)}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Day</dt>
            <dd>{formatDay(note.issueDate, locale.formatLocale)}</dd>
            <dt className="text-muted-foreground">Why</dt>
            <dd>{locale.documents.creditNote.reasons[note.reason]}</dd>
          </dl>
          <p className="text-base">{note.explanation}</p>
          <p className="text-sm text-muted-foreground">
            It corrects{" "}
            <Link href={`/app/invoices/${note.invoiceId}`} className="font-medium underline">
              invoice {note.invoiceNumber}
            </Link>
            . It can&apos;t be changed or deleted.
          </p>
        </CardContent>
      </Card>

      <PdfPreview url={`/app/credit-notes/${note.id}/pdf`} label={`${title} ${note.number}`} />
      {/* The same document as text, for people who can't read the pictures of the pages. */}
      <section className="sr-only" aria-label="The credit note as text">
        <QuoteDocumentView snapshot={note.snapshot} />
      </section>

      <section className="space-y-2" aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="text-base font-semibold">
          Activity
        </h2>
        <Card>
          <CardContent>
            <ol className="space-y-2" data-testid="activity">
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 text-base">
                <span>Issued as {note.number}</span>
                <span className="text-sm text-muted-foreground">{formatMoment(note.issuedAt, locale.formatLocale, locale.timeZone)}</span>
              </li>
            </ol>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
