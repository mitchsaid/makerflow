import { redirect } from "next/navigation";
import { businessFormValues } from "@/app/app/business/form-values";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { readerEnabled } from "@/lib/reader";
import { StartFromDocument } from "./start-from-document";

// Reading a document takes a while; a hosted function is given up to a minute.
export const maxDuration = 60;

/**
 * "Coming from another tool?" (docs/plans/import-onboarding.md, slice 2): the step after "What do you make or sell?",
 * and a link from the Business profile. Only shown when the reader is switched on (a key is set), and only to people
 * who can change the business details. Skipping goes on to Home (or back to the Business profile).
 */
export default async function StartFromDocumentPage({ searchParams }: PageProps<"/onboarding/start">) {
  const [{ organisation, profile, role, demo }, params] = await Promise.all([requireOrganisation(), searchParams]);
  const fromBusiness = params.from === "business";
  const skipHref = fromBusiness ? "/app/business" : "/app";
  if (!readerEnabled() || demo || !canEditBusinessProfile(role)) redirect(skipHref);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Coming from another tool?</h1>
        <p className="text-muted-foreground">Upload a recent quote or invoice and we&apos;ll fill in what we can.</p>
      </div>
      <StartFromDocument
        initial={businessFormValues(organisation.name, profile)}
        countryCode={profile.countryCode}
        skipHref={skipHref}
        skipLabel={fromBusiness ? "Back to the Business profile" : "Go to Home"}
      />
    </main>
  );
}
