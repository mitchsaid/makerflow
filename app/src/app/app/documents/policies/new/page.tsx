import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { getLocalePack } from "@/lib/locale";
import { PolicyForm } from "../policy-form";

export default async function NewPolicyPage({ searchParams }: PageProps<"/app/documents/policies/new">) {
  const [{ profile, role }, params] = await Promise.all([requireOrganisation(), searchParams]);
  const startFrom = typeof params.example === "string" ? params.example : undefined;
  const locale = getLocalePack(profile.countryCode);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <div className="space-y-1">
        <Link href="/app/documents/policies" className="text-sm text-muted-foreground underline">
          Quote policies
        </Link>
        <h1 className="text-xl font-semibold">Add a policy</h1>
      </div>
      {canEditBusinessProfile(role) ? (
        <PolicyForm
          initial={{ title: "", body: "", includeByDefault: false }}
          policyId={null}
          startFrom={startFrom}
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
