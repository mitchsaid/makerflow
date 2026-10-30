import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/page-header";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { withBack } from "@/lib/back-link";
import { asDraftCopy } from "@/lib/invoices/draft-copy";
import { getInvoiceDraft } from "@/lib/invoices/draft-data";
import { prepareInvoiceDraft } from "@/lib/invoices/prepare-draft";
import { getLocalePack } from "@/lib/locale";
import { getThemes } from "@/lib/quotes/theme-data";
import { formatMoney } from "@/lib/money";
import { DraftPreview } from "../../../../quotes/design-section";
import { QuoteDocumentView } from "../../../../quotes/quote-document-view";
import { InvoicePreviewBar } from "./invoice-preview-bar";

/**
 * The step after an invoice draft (docs/plans/invoice-preview.md): the invoice as the customer will see it (the real
 * document, drawn on screen), with the way on: back to editing, or issue it. It has no number yet: numbers are given,
 * without gaps, only when an invoice is issued.
 */
export default async function InvoiceDraftPreviewPage({ params }: PageProps<"/app/invoices/drafts/[id]/preview">) {
  const { id } = await params;
  const [draft, workspace] = await Promise.all([getInvoiceDraft(id), requireOrganisation()]);
  // Another business of the same person is not this workspace's draft.
  if (draft.organisationId !== workspace.organisation.id) notFound();
  // A draft that can't be read as an invoice, or isn't complete enough to draw, is fixed on its own page.
  if (!draft.form) redirect(`/app/invoices/drafts/${id}`);
  const [prepared, saved] = await Promise.all([
    prepareInvoiceDraft(draft.form, workspace, draft.quoteNumber ? { number: draft.quoteNumber } : null, draft.theme),
    getThemes(),
  ]);
  if (!prepared.ok) redirect(`/app/invoices/drafts/${id}`);

  const { snapshot, problems } = prepared.value;
  const locale = getLocalePack(workspace.profile.countryCode);
  const here = `/app/invoices/drafts/${id}/preview`;
  const shown = asDraftCopy(snapshot, locale);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <PageHeader back={{ href: `/app/invoices/drafts/${id}`, label: "invoice draft" }}>
        <h1 id="preview-title" tabIndex={-1} className="flex flex-wrap items-center gap-3 text-xl font-semibold outline-none">
          <span>Preview of invoice</span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">Not sent</span>
        </h1>
        <p className="text-base text-muted-foreground">It gets its number when you mark it as sent.</p>
      </PageHeader>

      {problems.length > 0 && (
        <Alert variant="destructive" data-testid="invoice-problems">
          <AlertDescription>
            <ul className="space-y-1">
              {problems.map((p) => (
                <li key={p.code}>
                  {p.message}{" "}
                  <Link
                    href={withBack(p.code === "customer-address" && draft.form?.customerId ? `/app/customers/${draft.form.customerId}?section=details` : "/app/business", here)}
                    className="inline-flex min-h-11 items-center font-medium underline"
                  >
                    {p.code === "customer-address" ? "Open the customer" : "Open your business profile"}
                  </Link>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* The same document as text, for people who can't read the pictures of the pages. */}
      <section className="sr-only" aria-label="The invoice as text">
        <QuoteDocumentView snapshot={shown} />
      </section>
      {/* Drawn in the browser from this snapshot and the theme chosen below, so a choice shows at once (as on a quote). */}
      <DraftPreview
        snapshot={shown}
        target={{ kind: "invoice", id }}
        label="Invoice preview"
        saved={saved}
        initialOwn={draft.theme}
        canEdit={canEditBusinessProfile(workspace.role)}
      />

      <InvoicePreviewBar
        draftId={id}
        customerName={draft.customerName ?? ""}
        totalText={formatMoney(snapshot.totals.grossCents, snapshot.currencyCode, locale.numberStyle)}
      />
    </main>
  );
}
