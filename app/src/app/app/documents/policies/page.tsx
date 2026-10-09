import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { getLocalePack } from "@/lib/locale";
import { BUSINESS_TYPE_PROMPT, describeTypes, hasSpecificTypes, splitForTypes } from "@/lib/business-types";
import { exampleLabel, sortPolicies, termExamples, termName } from "@/lib/policies";
import { getPolicies } from "@/lib/policies/data";
import { forOrganisation } from "@/lib/scope";
import { BusinessTypePrompt } from "./business-type-prompt";

/**
 * Quotes and invoices > Terms: the library of terms a business reuses on its quotes (stored as
 * "policies"). Owners and admins manage it; every member can use it on a quote.
 */
export default async function PoliciesPage({ searchParams }: PageProps<"/app/documents/policies">) {
  // The terms query runs beside the workspace check, not after it.
  const [all, { organisation, profile, role, dismissedPrompts }, params] = await Promise.all([
    getPolicies(),
    requireOrganisation(),
    searchParams,
  ]);
  const policies = forOrganisation(all, organisation.id);
  const list = sortPolicies(policies);
  const locale = getLocalePack(profile.countryCode);
  const canEdit = canEditBusinessProfile(role);
  const types = profile.businessTypes;
  const examples = splitForTypes(termExamples(locale.policies), types);
  // Skipped (or never answered) and not dismissed: offer the question again, once, kindly.
  const askTypes = canEdit && (types === null || types.length === 0) && !dismissedPrompts.includes(BUSINESS_TYPE_PROMPT);
  const saved = typeof params.saved === "string" ? policies.find((p) => p.id === params.saved) : undefined;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <div className="space-y-1">
        <Link href="/app/documents" className="text-sm text-muted-foreground underline">
          Quotes and invoices
        </Link>
        <h1 className="text-xl font-semibold">Terms</h1>
        <p className="text-muted-foreground">
          Write each term once, then tick the ones you want on each quote. A title is optional: without one, a
          term prints as a plain paragraph. Quotes keep their own copy, so changing a term here never changes a
          quote you have already made.
        </p>
      </div>

      {saved && (
        <Alert data-testid="policy-saved">
          <AlertDescription>Saved “{termName(saved)}”.</AlertDescription>
        </Alert>
      )}
      {!canEdit && (
        <Alert>
          <AlertDescription>Only owners and admins can change these. You can use them on any quote.</AlertDescription>
        </Alert>
      )}

      {policies.length === 0 ? (
        <p className="text-base text-muted-foreground" data-testid="no-policies">
          No terms yet.{canEdit ? " Write your own, or start from an example." : ""}
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Your terms">
          {list.map((p) => {
            const card = (
              <Card className={p.archived ? "opacity-70" : undefined}>
                <CardContent className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3">
                    {/* A term with no title is shown by its wording. */}
                    {p.title ? (
                      <p className="min-w-0 truncate text-base font-medium">{p.title}</p>
                    ) : (
                      <p className="line-clamp-2 min-w-0 whitespace-pre-line text-base">{p.body}</p>
                    )}
                    <span className="flex shrink-0 gap-1.5">
                      {p.includeByDefault && !p.archived && (
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                          On new quotes
                        </span>
                      )}
                      {p.archived && (
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                          Archived
                        </span>
                      )}
                    </span>
                  </div>
                  {p.title && <p className="line-clamp-2 whitespace-pre-line text-sm text-muted-foreground">{p.body}</p>}
                </CardContent>
              </Card>
            );
            return (
              <li key={p.id}>
                {canEdit ? (
                  <Link
                    href={`/app/documents/policies/${p.id}`}
                    className="block rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {card}
                  </Link>
                ) : (
                  card
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && askTypes && <BusinessTypePrompt />}

      {canEdit && (
        <>
          <Link href="/app/documents/policies/new" className={buttonVariants({ variant: "outline" })}>
            Add a term
          </Link>
          <section className="space-y-2" aria-labelledby="examples-heading" data-testid="example-links">
            <div>
              <h2 id="examples-heading" className="text-base font-semibold">
                {hasSpecificTypes(types) ? "Examples for you" : "Start from an example"}
              </h2>
              {hasSpecificTypes(types) && (
                <p className="text-sm text-muted-foreground" data-testid="showing-types">
                  Showing examples for {describeTypes(types)}.{" "}
                  <Link href="/app/business#what-you-make" className="underline">
                    Change
                  </Link>
                </p>
              )}
            </div>
            <ul className="flex flex-wrap gap-2">
              {examples.forYou.map((e) => (
                <li key={e.key}>
                  <Link href={`/app/documents/policies/new?example=${e.key}`} className={buttonVariants({ variant: "outline" })}>
                    {exampleLabel(e)}
                  </Link>
                </li>
              ))}
            </ul>
            {examples.others.length > 0 && (
              <details className="space-y-2" data-testid="more-examples">
                <summary className="min-h-11 cursor-pointer py-2.5 text-base font-medium">More examples</summary>
                <ul className="flex flex-wrap gap-2">
                  {examples.others.map((e) => (
                    <li key={e.key}>
                      <Link href={`/app/documents/policies/new?example=${e.key}`} className={buttonVariants({ variant: "outline" })}>
                        {exampleLabel(e)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        </>
      )}
    </main>
  );
}
