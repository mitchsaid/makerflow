import { Alert, AlertDescription } from "@/components/ui/alert";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { getLocalePack } from "@/lib/locale";
import { PolicyForm } from "../policy-form";
import { PageHeader } from "@/components/page-header";

export default async function NewPolicyPage({ searchParams }: PageProps<"/app/documents/policies/new">) {
  const [{ profile, role }, params] = await Promise.all([requireOrganisation(), searchParams]);
  const startFrom = typeof params.example === "string" ? params.example : undefined;
  const locale = getLocalePack(profile.countryCode);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <PageHeader back={{ href: "/app/documents/policies", label: "Terms" }}>
        <h1 className="text-xl font-semibold">Add a term</h1>
      </PageHeader>
      {canEditBusinessProfile(role) ? (
        <PolicyForm
          initial={{ title: "", body: "", includeByDefault: false }}
          policyId={null}
          startFrom={startFrom}
          content={locale.policies}
        />
      ) : (
        <Alert>
          <AlertDescription>Only owners and admins can add terms. Ask one of them.</AlertDescription>
        </Alert>
      )}
    </main>
  );
}
