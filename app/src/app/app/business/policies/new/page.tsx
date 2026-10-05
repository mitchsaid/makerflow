import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { getLocalePack } from "@/lib/locale";
import { isPolicyKind, POLICY_HEADINGS } from "@/lib/policies";
import { PolicyForm } from "../policy-form";

export default async function NewPolicyPage({ searchParams }: PageProps<"/app/business/policies/new">) {
  const [{ profile, role }, params] = await Promise.all([requireOrganisation(), searchParams]);
  const kind = isPolicyKind(params.kind) ? params.kind : "changes";
  const locale = getLocalePack(profile.countryCode);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <div className="space-y-1">
        <Link href="/app/business/policies" className="text-sm text-muted-foreground underline">
          Quote policies
        </Link>
        <h1 className="text-xl font-semibold">Add a policy</h1>
      </div>
      {canEditBusinessProfile(role) ? (
        <PolicyForm
          initial={{ kind, title: POLICY_HEADINGS[kind], body: "", includeByDefault: false }}
          policyId={null}
          content={locale.policies}
        />
      ) : (
        <Alert>
          <AlertDescription>Only owners and admins can add policies. Ask one of them.</AlertDescription>
        </Alert>
      )}
    </main>
  );
}
