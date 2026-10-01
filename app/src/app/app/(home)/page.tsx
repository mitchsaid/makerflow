import Link from "next/link";
import { isPromptDismissed, requireOrganisation } from "@/lib/auth/dal";
import {
  PROMPTS,
  canEditBusinessProfile,
  isBusinessProfileComplete,
} from "@/lib/business-profile";
import { dismissBusinessDetailsPrompt } from "../actions";

export default async function WorkspacePage() {
  const workspace = await requireOrganisation();
  const { organisation, profile, role } = workspace;

  const showDetailsPrompt =
    canEditBusinessProfile(role) &&
    !isBusinessProfileComplete(profile) &&
    !isPromptDismissed(workspace, PROMPTS.businessDetails);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <h1 className="text-xl font-semibold" data-testid="business-name">
        {organisation.name}
      </h1>

      {showDetailsPrompt && (
        <section aria-labelledby="details-prompt-title" className="card space-y-3">
          <h2 id="details-prompt-title" className="text-lg font-semibold">
            Make your quotes look right
          </h2>
          <p className="text-muted">
            Add your contact details and address once, and they&apos;ll appear on every
            quote you send. It only takes a minute.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/app/settings" className="btn-primary">
              Add my details
            </Link>
            <form action={dismissBusinessDetailsPrompt}>
              <button type="submit" className="btn-secondary">
                Not now
              </button>
            </form>
          </div>
        </section>
      )}

      <section className="card space-y-2">
        <h2 className="text-lg font-semibold">You&apos;re all set up</h2>
        <p className="text-muted">
          This is your workspace. Customers and quotes will appear here as we build
          them.
        </p>
      </section>
    </main>
  );
}
