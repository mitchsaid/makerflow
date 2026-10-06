"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { validateBusinessName } from "@/lib/validation";

export type OnboardingState = { error?: string };

export async function createBusiness(
  _previous: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  await requireUser();

  const name = validateBusinessName(formData.get("name"));
  if (!name.ok) return { error: name.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("ensure_organisation", {
    org_name: name.value,
  });

  if (error) {
    console.error("could not create organisation:", error.message);
    return { error: "Something went wrong saving that. Please try again." };
  }

  // One more optional question (what they make), then Home.
  redirect("/onboarding/type");
}
