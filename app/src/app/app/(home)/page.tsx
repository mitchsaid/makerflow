import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
        <Card aria-labelledby="details-prompt-title" role="region">
          <CardHeader>
            <CardTitle id="details-prompt-title" className="text-lg">
              Make your quotes look right
            </CardTitle>
            <CardDescription className="text-base">
              Add your contact details and address once, and they&apos;ll appear on every
              quote you send. It only takes a minute.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link href="/app/settings" className={buttonVariants()}>
              Add my details
            </Link>
            <form action={dismissBusinessDetailsPrompt}>
              <Button type="submit" variant="outline">
                Not now
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">You&apos;re all set up</CardTitle>
          <CardDescription className="text-base">
            This is your workspace. Customers and quotes will appear here as we build
            them.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
