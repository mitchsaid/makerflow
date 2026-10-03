"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganisation } from "@/lib/auth/dal";
import { getLocalePack, vatSettingsFor } from "@/lib/locale";
import {
  isQuoteFormValues,
  parseQuote,
  toDatabasePayload,
  type QuoteErrors,
  type QuoteFormValues,
} from "@/lib/quotes";
import { createClient } from "@/lib/supabase/server";

export type SaveQuoteState =
  | { status: "idle" }
  | { status: "saved"; savedAt: number }
  | { status: "error"; message?: string; errors?: QuoteErrors };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC_ERROR = "Something went wrong saving that. Please try again.";

/**
 * Saves a draft quote: checks everything, works out the totals on the server, and writes the
 * quote and its lines in one transaction (save_quote_draft). A new quote then opens on its own
 * page; an existing one stays where it is. Any member of the business can do this.
 */
export async function saveQuoteDraft(
  quoteId: string | null,
  values: QuoteFormValues,
  then?: "send",
): Promise<SaveQuoteState> {
  const { organisation, profile } = await requireOrganisation();
  if (quoteId !== null && !UUID.test(quoteId)) return { status: "error", message: GENERIC_ERROR };
  // The form arrives from the browser as a plain object: check its shape before anything else.
  if (!isQuoteFormValues(values)) return { status: "error", message: GENERIC_ERROR };

  const locale = getLocalePack(profile.countryCode);
  const parsed = parseQuote(values, vatSettingsFor(profile, locale));
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  const payload = toDatabasePayload(parsed.quote, {
    countryCode: profile.countryCode,
    currencyCode: profile.currencyCode,
  });

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("save_quote_draft", {
    p_org: organisation.id,
    p_quote_id: quoteId,
    p_quote: payload.quote,
    p_lines: payload.lines,
  });
  if (error || typeof id !== "string") {
    if (error?.code === "P0002") {
      return {
        status: "error",
        message: "This quote can't be changed any more. Go back to your quotes and open it again.",
      };
    }
    if (error?.code === "23503" && error.message.includes("quote_lines_product_same_org")) {
      return {
        status: "error",
        errors: {
          fields: { lines: "One of the items comes from a product that isn't on your list. Remove it and add it again." },
          lines: {},
        },
      };
    }
    if (error?.code === "23503") {
      return {
        status: "error",
        errors: { fields: { customerId: "That customer isn't on your list. Choose one again." }, lines: {} },
      };
    }
    console.error("could not save quote draft:", error?.code, error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  revalidatePath("/app/quotes");
  // Pressing Send on a new quote saves it first and then opens the send sheet on its own page.
  if (quoteId === null) redirect(`/app/quotes/${id}?saved=1${then === "send" ? "&send=1" : ""}`);
  return { status: "saved", savedAt: Date.now() };
}

export type DeleteState = { status: "idle" } | { status: "error"; message: string };

/** Deletes a DRAFT quote and its lines. Quotes that have been sent can't be deleted. */
export async function deleteQuoteDraft(id: string): Promise<DeleteState> {
  const { organisation } = await requireOrganisation();
  if (!UUID.test(id)) redirect("/app/quotes");

  const supabase = await createClient();
  const { data: deleted, error } = await supabase
    .from("quotes")
    .delete()
    .eq("id", id)
    .eq("organisation_id", organisation.id)
    .select("id");
  if (error || !deleted || deleted.length !== 1) {
    console.error("could not delete quote draft:", error?.message);
    return { status: "error", message: "Couldn't delete that draft. It may already be gone, or it was sent." };
  }

  revalidatePath("/app/quotes");
  redirect("/app/quotes");
}
