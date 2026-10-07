"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation } from "@/lib/auth/dal";
import { isDesignKey, parseDesignOptions } from "@/lib/quotes/designs";
import { createClient } from "@/lib/supabase/server";

export type QuoteDesignState = { status: "saved" } | { status: "error"; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC_ERROR = "Something went wrong saving that. Please try again.";

/**
 * Chooses the design for a draft quote and what was changed from its own look. A null design means
 * "follow my business's default". Options are cut down to the choices we know; only a draft can change
 * (a sent version keeps the look it was sent with). Any member of the business can.
 */
export async function saveQuoteDesign(quoteId: string, design: string | null, options: unknown): Promise<QuoteDesignState> {
  const { organisation } = await requireOrganisation();
  if (!UUID.test(quoteId) || (design !== null && !isDesignKey(design))) return { status: "error", message: GENERIC_ERROR };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .update({ design, design_options: design === null ? null : parseDesignOptions(options) })
    .eq("id", quoteId)
    .eq("organisation_id", organisation.id)
    .select("id");
  if (error || !data || data.length !== 1) {
    if (!error) return { status: "error", message: "This quote can't be changed any more." };
    console.error("could not save the quote's design:", error.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath(`/app/quotes/${quoteId}/preview`);
  return { status: "saved" };
}
