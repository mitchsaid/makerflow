"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganisation } from "@/lib/auth/dal";
import { PROMPTS } from "@/lib/business-profile";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/** "Not now" on the business-details prompt. Remembered per person, per business. */
export async function dismissBusinessDetailsPrompt() {
  const { user, organisation } = await requireOrganisation();

  const supabase = await createClient();
  const { error } = await supabase.from("prompt_dismissals").upsert(
    {
      user_id: user.id,
      organisation_id: organisation.id,
      prompt_key: PROMPTS.businessDetails,
    },
    { onConflict: "user_id,organisation_id,prompt_key", ignoreDuplicates: true },
  );
  if (error) console.error("could not save prompt dismissal:", error.message);

  revalidatePath("/app");
}
