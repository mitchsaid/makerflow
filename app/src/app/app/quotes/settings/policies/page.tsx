import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { getLocalePack } from "@/lib/locale";
import { describeTypes, hasSpecificTypes, splitForTypes } from "@/lib/business-types";
import { exampleLabel, sortPolicies, termExamples, termName } from "@/lib/policies";
import { getPolicies } from "@/lib/policies/data";
import { forOrganisation } from "@/lib/scope";
import { AddLink } from "@/components/add-button";
import { PageHeader } from "@/components/page-header";

/**
 * Quote settings > Terms: the library of terms a business reuses on its quotes (stored as
 * "policies"). Owners and admins manage it; every member can use it on a quote.
 */
export default async function PoliciesPage({ searchParams }: PageProps<"/app/quotes/settings/policies">) {
  // The terms query runs beside the workspace check, not after it.
  const [all, { organisation, profile, role }, params] = await Promise.all([
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
  const saved = typeof params.saved === "string" ? policies.find((p) => p.id === params.saved) : undefined;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <PageHeader back={{ href: "/app/quotes/settings", label: "Quote settings" }}>
        <h1 className="text-xl font-semibold">Terms</h1>
        <p className="text-muted-foreground">
          Write each term once, then add it to any quote. Existing quotes are never changed.
        </p>
      </PageHeader>

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
                    href={`/app/quotes/settings/policies/${p.id}`}
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

      {canEdit && (
        <>
          <AddLink href="/app/quotes/settings/policies/new">
            Add a term
          </AddLink>
          <section className="space-y-2" aria-labelledby="examples-heading" data-testid="example-links">
            <div>
              <h2 id="examples-heading" className="text-base font-semibold">
                {hasSpecificTypes(types) ? "Examples for you" : "Start from an example"}
              </h2>
              {/* What you make is asked in one place, the Business profile: this only links there. */}
              {hasSpecificTypes(types) ? (
                <p className="text-sm text-muted-foreground" data-testid="showing-types">
                  Showing examples for {describeTypes(types)}.{" "}
                  <Link href="/app/business" className="underline">
                    Change
                  </Link>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="types-link">
                  To see the examples that fit first,{" "}
                  <Link href="/app/business" className="underline">
                    say what you make
                  </Link>
                  .
                </p>
              )}
            </div>
            <ul className="flex flex-wrap gap-2">
              {examples.forYou.map((e) => (
                <li key={e.key}>
                  <Link href={`/app/quotes/settings/policies/new?example=${e.key}`} className={buttonVariants({ variant: "outline" })}>
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
                      <Link href={`/app/quotes/settings/policies/new?example=${e.key}`} className={buttonVariants({ variant: "outline" })}>
                        {exampleLabel(e)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <p className="text-sm text-muted-foreground" data-testid="examples-advice">
              {locale.policies.adviceNote}
            </p>
          </section>
        </>
      )}
    </main>
  );
}
