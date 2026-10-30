import { notFound, redirect } from "next/navigation";
import { requireOrganisation } from "@/lib/auth/dal";
import { todayIn } from "@/lib/quotes/dates";
import { getStoredQuote } from "@/lib/quotes/data";
import { canEditBusinessProfile, shouldAskForLogo } from "@/lib/business-profile";
import { getThemes } from "@/lib/quotes/theme-data";
import { prepareQuote } from "@/lib/quotes/prepare";
import { getLocalePack } from "@/lib/locale";
import { DraftPreview } from "../../design-section";
import { LogoPrompt } from "../../logo-prompt";
import { QuoteDocumentView } from "../../quote-document-view";
import { StatusChip } from "../../status-chip";
import { PreviewBar } from "./preview-bar";
import { PageHeader } from "@/components/page-header";

/**
 * The step after a draft: the quote as it will look (its real PDF, drawn on screen), with the
 * design it uses, and the way on: back to editing, download, email, or mark it as sent.
 */
export default async function QuotePreviewPage({ params }: PageProps<"/app/quotes/[id]/preview">) {
  const { id } = await params;
  const [quote, workspace, saved] = await Promise.all([getStoredQuote(id), requireOrganisation(), getThemes()]);
  if (quote.organisationId !== workspace.organisation.id) notFound();
  // Only a draft is previewed; a sent quote opens as its document.
  if (quote.status !== "draft") redirect(`/app/quotes/${id}`);

  const prepared = await prepareQuote(id, workspace, quote);
  if (!prepared.ok) redirect(`/app/quotes/${id}`);
  const { snapshot } = prepared.value;
  const locale = getLocalePack(workspace.profile.countryCode);
  // Nudge towards a logo while there is none, to people who can set one, unless they said "Not now".
  const canEdit = canEditBusinessProfile(workspace.role);
  const askForLogo = shouldAskForLogo({
    hasLogo: !!workspace.profile.logoImageId,
    canEdit,
    dismissedPrompts: workspace.dismissedPrompts,
  });
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <PageHeader back={{ href: `/app/quotes/${quote.id}`, label: `quote ${quote.number}` }}>
        <h1 id="preview-title" tabIndex={-1} className="flex flex-wrap items-center gap-3 text-xl font-semibold outline-none">
          <span>Preview of quote {quote.number}</span>{" "}
          <StatusChip
            status={quote.status}
            version={quote.version}
            validUntil={quote.validUntil}
            today={todayIn(locale.timeZone)}
          />
        </h1>
      </PageHeader>
      {canEdit && <LogoPrompt businessName={workspace.organisation.name} askForLogo={askForLogo} />}

      {/* The same document as text, for people who can't read the pictures of the pages. */}
      <section className="sr-only" aria-label="The quote as text">
        <QuoteDocumentView snapshot={snapshot} />
      </section>

      {/* The document is drawn in the browser from this snapshot and the theme chosen below, so a choice shows at once. */}
      <DraftPreview
        snapshot={snapshot}
        target={{ kind: "quote", id }}
        label={`Quote ${quote.number}`}
        saved={saved}
        initialOwn={{ id: quote.themeId, starter: quote.themeStarter }}
        canEdit={canEdit}
      />
      <PreviewBar quoteId={id} />
    </main>
  );
}
