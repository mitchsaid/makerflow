import { redirect } from "next/navigation";
import { requireOrganisation } from "@/lib/auth/dal";
import { TypeForm } from "./type-form";

/**
 * Sign-up step 2: what the business makes or sells. Optional (Skip), asked once: once there is an
 * answer, or a skip, this goes straight to Home.
 */
export default async function OnboardingTypePage() {
  const { profile } = await requireOrganisation();
  if (profile.businessTypes !== null) redirect("/app");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="space-y-1">
        <h1 id="types-heading" className="text-2xl font-semibold">
          What do you make or sell?
        </h1>
        <p className="text-muted-foreground">
          Tick any that fit. We use this to show examples that fit your business, and nothing else. You can
          change it any time.
        </p>
      </div>
      <TypeForm />
    </main>
  );
}
