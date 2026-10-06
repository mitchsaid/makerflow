import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { getLocalePack } from "@/lib/locale";
import { getPolicy } from "@/lib/policies/data";
import { PolicyArchiveButton } from "../archive-button";
import { PolicyForm } from "../policy-form";

export default async function EditPolicyPage({ params }: PageProps<"/app/business/policies/[id]">) {
  const { id } = await params;
  // The policy loads beside the workspace check, not after it.
  const [policy, { organisation, profile, role }] = await Promise.all([getPolicy(id), requireOrganisation()]);
  // Another business of the same person is not this workspace's policy.
  if (policy.organisationId !== organisation.id) notFound();
  const locale = getLocalePack(profile.countryCode);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <div className="space-y-1">
        <Link href="/app/business/policies" className="text-sm text-muted-foreground underline">
          Quote policies
        </Link>
        <h1 className="text-xl font-semibold">{policy.title}</h1>
      </div>
      {policy.archived && (
        <Alert data-testid="archived-notice">
          <AlertDescription>This policy is archived, so it is hidden from new quotes. Restore it below to use it again.</AlertDescription>
        </Alert>
      )}
      {canEditBusinessProfile(role) ? (
        <>
          <PolicyForm
            key={policy.id}
            initial={{
              title: policy.title,
              body: policy.body,
              includeByDefault: policy.includeByDefault,
            }}
            policyId={policy.id}
            content={locale.policies}
          />
          <PolicyArchiveButton id={policy.id} archived={policy.archived} />
        </>
      ) : (
        <Alert>
          <AlertDescription>Only owners and admins can change policies.</AlertDescription>
        </Alert>
      )}
    </main>
  );
}
