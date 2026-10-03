import "server-only";
import { createClient } from "../supabase/server";
import { DEFAULT_MIN_DIGITS, DEFAULT_QUOTE_PREFIX } from "./numbering";

export type QuoteSequence = {
  organisationId: string;
  prefix: string;
  nextNumber: number;
  minDigits: number;
  /** The highest number handed out so far, or null if none yet. */
  lastIssued: number | null;
};

type Row = {
  organisation_id: string;
  prefix: string;
  next_number: number;
  min_digits: number;
  last_issued_number: number | null;
};

/**
 * The quote numbering of every business the person belongs to (row-level security; callers
 * keep the current one). A business that has not made a quote yet has no row, and starts from
 * the defaults the database uses.
 */
export async function getQuoteSequences(): Promise<QuoteSequence[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_sequences")
    .select("organisation_id, prefix, next_number, min_digits, last_issued_number")
    .eq("doc_type", "quote");
  if (error) throw new Error(`Could not load quote numbering: ${error.message}`);
  return (data as Row[]).map((r) => ({
    organisationId: r.organisation_id,
    prefix: r.prefix,
    nextNumber: r.next_number,
    minDigits: r.min_digits,
    lastIssued: r.last_issued_number,
  }));
}

export function sequenceFor(sequences: readonly QuoteSequence[], organisationId: string): QuoteSequence {
  return (
    sequences.find((s) => s.organisationId === organisationId) ?? {
      organisationId,
      prefix: DEFAULT_QUOTE_PREFIX,
      nextNumber: 1,
      minDigits: DEFAULT_MIN_DIGITS,
      lastIssued: null,
    }
  );
}
