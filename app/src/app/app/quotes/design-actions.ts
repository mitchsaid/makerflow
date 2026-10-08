"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation } from "@/lib/auth/dal";
import { isStarterKey } from "@/lib/quotes/themes";
import { createClient } from "@/lib/supabase/server";

export type QuoteThemeState = { status: "saved" } | { status: "error"; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC_ERROR = "Something went wrong saving that. Please try again.";

/**
 * Chooses the theme for a draft quote: one of the business's own (an id), a starter, or neither to
 * follow the business's usual theme. Only a draft can change (a sent version keeps the look it was sent
 * in). Any member of the business can.
 */
export async function saveQuoteTheme(quoteId: string, id: string | null, starter: string | null): Promise<QuoteThemeState> {
  const { organisation } = await requireOrganisation();
  if (!UUID.test(quoteId) || (id !== null && !UUID.test(id)) || (starter !== null && !isStarterKey(starter)) || (id !== null && starter !== null)) {
    return { status: "error", message: GENERIC_ERROR };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .update({ theme_id: id, theme_starter: starter })
    .eq("id", quoteId)
    .eq("organisation_id", organisation.id)
    .select("id");
  if (error?.code === "23503") return { status: "error", message: "That theme isn't there any more. Pick another." };
  if (error || !data || data.length !== 1) {
    if (!error) return { status: "error", message: "This quote can't be changed any more." };
    console.error("could not save the quote's theme:", error.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath(`/app/quotes/${quoteId}/preview`);
  return { status: "saved" };
}
