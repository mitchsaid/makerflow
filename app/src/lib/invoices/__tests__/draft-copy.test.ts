import { describe, expect, it } from "vitest";
import { getLocalePack } from "../../locale";
import type { QuoteSnapshot } from "../../quotes/snapshot";
import { asDraftCopy } from "../draft-copy";

describe("asDraftCopy", () => {
  const locale = getLocalePack("ZA");
  const snapshot = { number: "", wording: { title: "Invoice", notATaxInvoice: "", inclusiveStatement: "" }, lines: [] } as unknown as QuoteSnapshot;

  it("has no number and says it is a draft, in the country's words", () => {
    const copy = asDraftCopy(snapshot, locale);
    expect(copy.number).toBe(locale.documents.invoice.draftNumber);
    expect(copy.wording.notATaxInvoice).toBe(locale.documents.invoice.draftNotice);
    expect(copy.wording.notATaxInvoice).toMatch(/draft/i);
  });
  it("leaves everything else, and the original, as it was", () => {
    const copy = asDraftCopy(snapshot, locale);
    expect(copy.wording.title).toBe("Invoice");
    expect(copy.lines).toBe(snapshot.lines);
    expect(snapshot.number).toBe("");
    expect(snapshot.wording.notATaxInvoice).toBe("");
  });
});
