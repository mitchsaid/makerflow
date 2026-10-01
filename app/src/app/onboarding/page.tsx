import { redirect } from "next/navigation";
import { getWorkspace, requireUser } from "@/lib/auth/dal";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  await requireUser();
  if (await getWorkspace()) redirect("/app");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold">Welcome! Let&apos;s get you set up</h1>
        <p className="text-muted">
          What&apos;s your business called? It will appear on your quotes and
          invoices, and you can change it later.
        </p>
      </div>
      <OnboardingForm />
    </main>
  );
}
