"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { parseNumbering, type NumberingErrors, type NumberingValues } from "@/lib/quotes/numbering";
import { getInvoiceSequences, getQuoteSequences, sequenceFor } from "@/lib/quotes/sequence";
import { DEFAULT_INVOICE_PREFIX } from "@/lib/quotes/numbering";
import { createClient } from "@/lib/supabase/server";

export type NumberingState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message?: string; errors?: NumberingErrors };

type DocType = "quote" | "invoice";

const NOUN: Record<DocType, string> = { quote: "quote", invoice: "invoice" };

/** Sets the prefix and next number for this business's quotes or invoices. Owners and admins only. */
async function saveNumbering(docType: DocType, values: NumberingValues): Promise<NumberingState> {
  const { organisation, role } = await requireOrganisation();
  if (!canEditBusinessProfile(role)) {
    return { status: "error", message: `Only owners and admins can change how ${NOUN[docType]}s are numbered.` };
  }
  if (typeof values?.prefix !== "string" || typeof values?.nextNumber !== "string") {
    return { status: "error", message: "Something went wrong saving that. Please try again." };
  }

  // The latest figure is read now, so the check is against what has been used up to this moment.
  const sequence =
    docType === "quote"
      ? sequenceFor(await getQuoteSequences(), organisation.id)
      : sequenceFor(await getInvoiceSequences(), organisation.id, DEFAULT_INVOICE_PREFIX);
  const parsed = parseNumbering(values, sequence.lastIssued);
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_document_numbering", {
    p_org: organisation.id,
    p_doc_type: docType,
    p_prefix: parsed.prefix,
    p_next_number: parsed.nextNumber,
  });
  if (error) {
    if (error.code === "22023") {
      // A document took the number between the check and the save.
      return {
        status: "error",
        errors: { nextNumber: `${docType === "quote" ? "A quote" : "An invoice"} has just used that number. Choose a higher one.` },
      };
    }
    console.error(`could not save ${docType} numbering:`, error.code, error.message);
    return { status: "error", message: "Something went wrong saving that. Please try again." };
  }
  revalidatePath("/app/documents");
  return { status: "saved" };
}

export async function saveQuoteNumbering(values: NumberingValues): Promise<NumberingState> {
  return saveNumbering("quote", values);
}

export async function saveInvoiceNumbering(values: NumberingValues): Promise<NumberingState> {
  return saveNumbering("invoice", values);
}
