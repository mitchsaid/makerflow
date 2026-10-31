import Link from "@/components/app-link";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loadStatement } from "@/lib/statements/load";
import { ageingAmounts, PERIODS, PERIOD_LABELS } from "@/lib/statements";
import { formatMoney } from "@/lib/money";
import { formatDay } from "@/lib/quotes/dates";
import { PdfPreview } from "../../../quotes/pdf-preview";
import { ShareDocument } from "../../../invoices/share-invoice";

/**
 * A customer's statement of account: what they have been invoiced, credited and paid, the balance, and how old what is
 * owing is. A view of their invoices as they are now; nothing here is issued, numbered or stored.
 */
export default async function StatementPage({ params, searchParams }: PageProps<"/app/customers/[id]/statement">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const loaded = await loadStatement(id, { period: query.period, owing: query.owing });
  const { statement: s, document: doc, period, onlyOwing } = loaded;
  const locale = { numberStyle: doc.numberStyle, formatLocale: doc.dateLocale };
  const money = (cents: number) => formatMoney(cents, doc.currencyCode, locale.numberStyle);
  const words = doc.words;
  const href = (next: { period?: string; owing?: boolean }) => {
    const p = next.period ?? period;
    const o = next.owing ?? onlyOwing;
    const qs = new URLSearchParams();
    if (p !== "all") qs.set("period", p);
    if (o) qs.set("owing", "1");
    const text = qs.toString();
    return `/app/customers/${id}/statement${text ? `?${text}` : ""}`;
  };
  const pdfQuery = new URLSearchParams({ ...(period !== "all" ? { period } : {}), ...(onlyOwing ? { owing: "1" } : {}) }).toString();
  const pdfUrl = `/app/customers/${id}/statement/pdf${pdfQuery ? `?${pdfQuery}` : ""}`;
  const empty = s.entries.length === 0 && s.openingCents === 0;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <PageHeader back={{ href: `/app/customers/${id}`, label: doc.customer.name }}>
        <h1 id="statement-title" tabIndex={-1} className="text-xl font-semibold outline-none">
          {words.title}
        </h1>
      </PageHeader>

      <nav aria-label="Period" className="space-y-2">
        <ul className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <li key={p}>
              <Link href={href({ period: p })} aria-current={p === period ? "page" : undefined} className={buttonVariants({ variant: p === period ? "default" : "outline" })}>
                {PERIOD_LABELS[p]}
              </Link>
            </li>
          ))}
        </ul>
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link href={href({ owing: !onlyOwing })} aria-current={onlyOwing ? "true" : undefined} className={buttonVariants({ variant: onlyOwing ? "default" : "outline" })}>
              Only what is owing
            </Link>
          </li>
        </ul>
      </nav>

      {empty ? (
        <Card>
          <CardContent className="space-y-1">
            <p className="text-base font-medium">{onlyOwing ? "Nothing owing" : "No invoices yet"}</p>
            <p className="text-muted-foreground">{onlyOwing ? "This customer has paid everything." : "Invoices for this customer will show here."}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent>
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-base" data-testid="statement-summary">
                {period !== "all" && (
                  <>
                    <dt className="text-muted-foreground">{words.broughtForward}</dt>
                    <dd data-testid="statement-opening">{money(s.openingCents)}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">{words.invoiced}</dt>
                <dd>{money(s.invoicedCents)}</dd>
                <dt className="text-muted-foreground">{words.credited}</dt>
                <dd>{money(s.creditedCents)}</dd>
                <dt className="text-muted-foreground">{words.paid}</dt>
                <dd>{money(s.paidCents)}</dd>
                <dt className="font-medium">{words.balance}</dt>
                <dd className="font-medium" data-testid="statement-balance">
                  {money(s.closingCents)}
                </dd>
                {s.creditOnAccountCents > 0 && (
                  <>
                    <dt className="text-muted-foreground">{words.creditOnAccount}</dt>
                    <dd data-testid="statement-credit">{money(s.creditOnAccountCents)}</dd>
                  </>
                )}
              </dl>
            </CardContent>
          </Card>

          {s.ageing.totalCents > 0 && (
            <section className="space-y-2" aria-labelledby="ageing-heading">
              <h2 id="ageing-heading" className="text-base font-semibold">
                {words.ageingTitle}
              </h2>
              <Card>
                <CardContent>
                  <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-base" data-testid="statement-ageing">
                    {ageingAmounts(s.ageing).map((cents, i) => (
                      <div key={i} className="contents">
                        <dt className="text-muted-foreground">{words.ageingBuckets[i]}</dt>
                        <dd>{money(cents)}</dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            </section>
          )}

          <ShareDocument url={pdfUrl} number={doc.customer.name} title="Statement for" />
          <PdfPreview url={pdfUrl} label={`${words.title}, ${doc.customer.name}`} />

          {/* The same statement as a table, for people who can't read the pictures of the pages, with a way to each document. */}
          <section className="sr-only" aria-label="The statement as text">
            <table>
              <caption>
                {words.title}, {doc.customer.name}, {formatDay(loaded.today, locale.formatLocale)}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Details</th>
                  <th scope="col">{words.invoiced}</th>
                  <th scope="col">{words.credited}</th>
                  <th scope="col">{words.balance}</th>
                </tr>
              </thead>
              <tbody>
                {s.entries.map((e) => (
                  <tr key={e.key}>
                    <td>{formatDay(e.date, locale.formatLocale)}</td>
                    <td>
                      <Link href={e.creditNoteId ? `/app/credit-notes/${e.creditNoteId}` : `/app/invoices/${e.invoiceId}`}>{e.reference}</Link>
                    </td>
                    <td>{e.description}</td>
                    <td>{e.debitCents ? money(e.debitCents) : ""}</td>
                    <td>{e.creditCents ? money(e.creditCents) : ""}</td>
                    <td>{money(e.balanceCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}
