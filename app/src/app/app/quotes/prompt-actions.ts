"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation } from "@/lib/auth/dal";
import { MARGIN_PROMPT } from "@/lib/quotes/margin";
import { createClient } from "@/lib/supabase/server";

/** "Don't ask me again" on the card that asks if you want to see your profit margin on a quote. Remembered for this person in this business. */
export async function dismissMarginPrompt(): Promise<{ status: "done" } | { status: "error" }> {
  const { organisation, user } = await requireOrganisation();
  const supabase = await createClient();
  const { error } = await supabase.from("prompt_dismissals").insert({
    user_id: user.id,
    organisation_id: organisation.id,
    prompt_key: MARGIN_PROMPT,
  });
  // Already dismissed (a second tab): that is what was asked for.
  if (error && error.code !== "23505") {
    console.error("could not dismiss prompt:", error.message);
    return { status: "error" };
  }
  revalidatePath("/app", "layout");
  return { status: "done" };
}
