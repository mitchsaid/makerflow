import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requireOrganisation } from "@/lib/auth/dal";
import { todayIn } from "@/lib/quotes/dates";
import { getStoredQuote } from "@/lib/quotes/data";
import { prepareQuote } from "@/lib/quotes/prepare";
import { getLocalePack } from "@/lib/locale";
import { DesignSection } from "../../design-section";
import { PdfPreview } from "../../pdf-preview";
import { QuoteDocumentView } from "../../quote-document-view";
import { StatusChip } from "../../status-chip";
import { PreviewBar } from "./preview-bar";

/**
 * The step after a draft: the quote as it will look (its real PDF, drawn on screen), with the
 * design it uses, and the way on: back to editing, download, or send.
 */
export default async function QuotePreviewPage({ params }: PageProps<"/app/quotes/[id]/preview">) {
  const { id } = await params;
  const [quote, workspace] = await Promise.all([getStoredQuote(id), requireOrganisation()]);
  if (quote.organisationId !== workspace.organisation.id) notFound();
  // Only a draft is previewed; a sent quote opens as its document.
  if (quote.status !== "draft") redirect(`/app/quotes/${id}`);

  const prepared = await prepareQuote(id, workspace, quote);
  if (!prepared.ok) redirect(`/app/quotes/${id}`);
  const { snapshot } = prepared.value;
  const locale = getLocalePack(workspace.profile.countryCode);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <div className="space-y-1">
        <Link href="/app/quotes" className="text-sm text-muted-foreground underline">
          Quotes
        </Link>
        <h1 className="flex flex-wrap items-center gap-3 text-xl font-semibold">
          <span>Preview of quote {quote.number}</span>{" "}
          <StatusChip
            status={quote.status}
            version={quote.version}
            validUntil={quote.validUntil}
            today={todayIn(locale.timeZone)}
          />
        </h1>
      </div>
      <Alert>
        <AlertDescription>
          This is how your quote will look. Check it, then send it or download it. Nothing is sent until you
          press Send.
        </AlertDescription>
      </Alert>

      <PdfPreview url={`/app/quotes/${id}/pdf`} label={`Quote ${quote.number}`} />
      {/* The same document as text, for people who can't read the pictures of the pages. */}
      <section className="sr-only" aria-label="The quote as text">
        <QuoteDocumentView snapshot={snapshot} />
      </section>

      <DesignSection design={snapshot.design} />
      <PreviewBar quoteId={id} />
    </main>
  );
}
