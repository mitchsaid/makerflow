import type { LocalePack } from "../locale";
import type { QuoteSnapshot } from "../quotes/snapshot";

/**
 * An invoice draft's document as a copy to look at or download before it is issued: no number (numbers are given, without
 * gaps, only when an invoice is issued) and a line that says it is a draft. The preview and the downloaded copy are both
 * drawn from this, so they say the same. What is issued is built separately, with the real number.
 */
export function asDraftCopy(snapshot: QuoteSnapshot, locale: LocalePack): QuoteSnapshot {
  const words = locale.documents.invoice;
  return { ...snapshot, number: words.draftNumber, wording: { ...snapshot.wording, notATaxInvoice: words.draftNotice } };
}
