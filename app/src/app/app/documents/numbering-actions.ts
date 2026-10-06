"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { parseNumbering, type NumberingErrors, type NumberingValues } from "@/lib/quotes/numbering";
import { getQuoteSequences, sequenceFor } from "@/lib/quotes/sequence";
import { createClient } from "@/lib/supabase/server";

export type NumberingState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message?: string; errors?: NumberingErrors };

/** Sets the prefix and next number for this business's quotes. Owners and admins only. */
export async function saveQuoteNumbering(values: NumberingValues): Promise<NumberingState> {
  const { organisation, role } = await requireOrganisation();
  if (!canEditBusinessProfile(role)) {
    return { status: "error", message: "Only owners and admins can change how quotes are numbered." };
  }
  if (typeof values?.prefix !== "string" || typeof values?.nextNumber !== "string") {
    return { status: "error", message: "Something went wrong saving that. Please try again." };
  }

  // The latest figure is read now, so the check is against what has been used up to this moment.
  const sequence = sequenceFor(await getQuoteSequences(), organisation.id);
  const parsed = parseNumbering(values, sequence.lastIssued);
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_document_numbering", {
    p_org: organisation.id,
    p_doc_type: "quote",
    p_prefix: parsed.prefix,
    p_next_number: parsed.nextNumber,
  });
  if (error) {
    if (error.code === "22023") {
      // A quote took the number between the check and the save.
      return {
        status: "error",
        errors: { nextNumber: "A quote has just used that number. Choose a higher one." },
      };
    }
    console.error("could not save quote numbering:", error.code, error.message);
    return { status: "error", message: "Something went wrong saving that. Please try again." };
  }
  revalidatePath("/app/documents");
  return { status: "saved" };
}
