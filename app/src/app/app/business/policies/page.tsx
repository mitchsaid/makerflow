import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { POLICY_HEADINGS, POLICY_KINDS, POLICY_PURPOSES, sortPolicies } from "@/lib/policies";
import { getPolicies } from "@/lib/policies/data";
import { forOrganisation } from "@/lib/scope";

/**
 * Business profile > Quote policies: the library of policies a business reuses on its quotes,
 * under five headings. Owners and admins manage it; every member can use it on a quote.
 */
export default async function PoliciesPage({ searchParams }: PageProps<"/app/business/policies">) {
  // The policies query runs beside the workspace check, not after it.
  const [all, { organisation, role }, params] = await Promise.all([
    getPolicies(),
    requireOrganisation(),
    searchParams,
  ]);
  const policies = forOrganisation(all, organisation.id);
  const canEdit = canEditBusinessProfile(role);
  const saved = typeof params.saved === "string" ? policies.find((p) => p.id === params.saved) : undefined;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <div className="space-y-1">
        <Link href="/app/business" className="text-sm text-muted-foreground underline">
          Business profile
        </Link>
        <h1 className="text-xl font-semibold">Quote policies</h1>
        <p className="text-muted-foreground">
          Write each policy once, then tick the ones you want on each quote. Quotes keep their own copy, so
          changing a policy here never changes a quote you have already made.
        </p>
      </div>

      {saved && (
        <Alert data-testid="policy-saved">
          <AlertDescription>Saved “{saved.title}”.</AlertDescription>
        </Alert>
      )}
      {!canEdit && (
        <Alert>
          <AlertDescription>Only owners and admins can change these. You can use them on any quote.</AlertDescription>
        </Alert>
      )}

      {POLICY_KINDS.map((kind) => {
        const list = sortPolicies(policies.filter((p) => p.kind === kind));
        return (
          <section key={kind} className="space-y-2" aria-labelledby={`h-${kind}`}>
            <div>
              <h2 id={`h-${kind}`} className="text-base font-semibold">
                {POLICY_HEADINGS[kind]}
              </h2>
              <p className="text-sm text-muted-foreground">{POLICY_PURPOSES[kind]}</p>
            </div>
            {list.length === 0 ? (
              <p className="text-base text-muted-foreground">No policy here yet.</p>
            ) : (
              <ul className="space-y-2">
                {list.map((p) => {
                  const card = (
                    <Card className={p.archived ? "opacity-70" : undefined}>
                      <CardContent className="space-y-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="min-w-0 truncate text-base font-medium">{p.title}</p>
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
                        <p className="line-clamp-2 whitespace-pre-line text-sm text-muted-foreground">{p.body}</p>
                      </CardContent>
                    </Card>
                  );
                  return (
                    <li key={p.id}>
                      {canEdit ? (
                        <Link
                          href={`/app/business/policies/${p.id}`}
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
              <Link
                href={`/app/business/policies/new?kind=${kind}`}
                className={buttonVariants({ variant: "outline" })}
              >
                Add a {POLICY_HEADINGS[kind].toLowerCase()} policy
              </Link>
            )}
          </section>
        );
      })}
    </main>
  );
}
