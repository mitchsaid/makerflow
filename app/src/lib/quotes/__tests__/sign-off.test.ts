import { describe, expect, it } from "vitest";
import { ZA_LOCALE } from "../../locale/za";
import type { VatSettings } from "../../money";
import { parseQuote, type QuoteFormValues } from "../index";
import { sendProblems } from "../send-checks";
import { NO_OWNER_NAME, parseOwnerName, parseSignOffOther, signOffBlock, signOffChoiceLabels, signOffNameFor, type SignOffAs } from "../sign-off";
import { buildQuoteSnapshot } from "../snapshot";

/** Who signs a quote (docs/plans/quote-sign-off-name.md). */

const NOT_REGISTERED: VatSettings = { registered: false };

const form = (over: Partial<QuoteFormValues> = {}): QuoteFormValues => ({
  customerId: "",
  issueDate: "2026-10-02",
  validUntil: "2026-10-16",
  neededBy: "",
  lines: [
    { key: "a", kind: "custom", productId: "", name: "Cake", description: "", quantity: "1", unit: "", unitPrice: "800", discountKind: "none", discountValue: "" },
  ],
  fulfilment: "none",
  deliveryFee: "",
  deliveryAddress: "",
  discountKind: "none",
  discountValue: "",
  notes: "",
  title: "",
  description: "",
  signOff: "Yours in sweetness",
  paymentInstructions: "",
  showBankDetails: true,
  showPhotos: true,
  depositKind: "none",
  depositValue: "",
  balanceDue: "handover",
  balanceDueDate: "",
  balanceDueText: "",
  policies: [],
  ...over,
});

const business = {
  name: "Sweet Co",
  ownerName: "Thandi Nkosi" as string | null,
  phone: "011 555 0101",
  email: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  region: null,
  postalCode: null,
  vatRegistered: false,
  vatNumber: null,
};

function snapshotWith(signOffAs: SignOffAs | undefined, ownerName: string | null = "Thandi Nkosi", signOff = "Yours in sweetness") {
  const parsed = parseQuote(form({ signOffAs, signOff }), NOT_REGISTERED);
  if (!parsed.ok) throw new Error("test quote should parse");
  return buildQuoteSnapshot({
    quote: parsed.quote,
    number: "QT-0001",
    version: 1,
    business: { ...business, ownerName },
    customer: null,
    countryCode: "ZA",
    currencyCode: "ZAR",
    vat: NOT_REGISTERED,
    locale: ZA_LOCALE,
    bank: null,
  });
}

describe("who signs a quote", () => {
  it("gives the business's name, the owner's, or none", () => {
    expect(signOffNameFor("business", "Sweet Co", "Thandi Nkosi")).toBe("Sweet Co");
    expect(signOffNameFor("owner", "Sweet Co", "Thandi Nkosi")).toBe("Thandi Nkosi");
    expect(signOffNameFor("owner", "Sweet Co", null)).toBeNull();
    expect(signOffNameFor("none", "Sweet Co", "Thandi Nkosi")).toBeNull();
    expect(signOffNameFor("other", "Sweet Co", "Thandi Nkosi", "The Nkosi family")).toBe("The Nkosi family");
  });

  it("names each choice with the name it gives", () => {
    expect(signOffChoiceLabels("Sweet Co", "Thandi Nkosi")).toEqual({
      business: "The business name (Sweet Co)",
      owner: "The owner's name (Thandi Nkosi)",
      other: "Another name",
      none: "No name",
    });
    expect(signOffChoiceLabels("Sweet Co", null).owner).toBe("The owner's name");
  });

  it("freezes the name in the snapshot, and an older form without the choice signs with the business", () => {
    expect(snapshotWith("owner").signOffName).toBe("Thandi Nkosi");
    expect(snapshotWith("business").signOffName).toBe("Sweet Co");
    expect(snapshotWith("none").signOffName).toBeNull();
    expect(snapshotWith(undefined).signOffName).toBe("Sweet Co");
  });

  it("prints the message and the name; no name prints the message alone; the owner's name signs even without a message", () => {
    expect(signOffBlock(snapshotWith("owner"))).toEqual({ message: "Yours in sweetness", name: "Thandi Nkosi" });
    expect(signOffBlock(snapshotWith("none"))).toEqual({ message: "Yours in sweetness", name: null });
    expect(signOffBlock(snapshotWith("owner", "Thandi Nkosi", ""))).toEqual({ message: null, name: "Thandi Nkosi" });
    // The business name is already at the top: without a message nothing is printed, as before.
    expect(signOffBlock(snapshotWith("business", "Thandi Nkosi", ""))).toBeNull();
    expect(signOffBlock(snapshotWith("none", null, ""))).toBeNull();
  });

  it("prints a snapshot from before the choice existed as it always did: the message, then the business name", () => {
    expect(signOffBlock({ signOff: "Kind regards", business: { name: "Sweet Co" } })).toEqual({ message: "Kind regards", name: "Sweet Co" });
    expect(signOffBlock({ signOff: null, business: { name: "Sweet Co" } })).toBeNull();
  });

  it("holds sending when the owner's name is chosen but none is saved, and says how to fix it", () => {
    const base = { hasCustomer: true, itemCount: 1, validUntil: "2026-10-16", today: "2026-10-02" };
    expect(sendProblems({ ...base, noOwnerName: true })).toEqual([{ code: "sign-off", message: NO_OWNER_NAME }]);
    expect(sendProblems({ ...base, noOwnerName: false })).toEqual([]);
  });

  it("tidies the owner's name, keeps none as none, and refuses one that is too long", () => {
    expect(parseOwnerName("  Thandi   Nkosi ")).toEqual({ ok: true, value: "Thandi Nkosi" });
    expect(parseOwnerName("")).toEqual({ ok: true, value: null });
    expect(parseOwnerName("a".repeat(121)).ok).toBe(false);
    expect(parseOwnerName(42).ok).toBe(false);
  });

  it("signs with another name when one is typed, asks for it when it is not, and drops it with any other choice", () => {
    const parsed = parseQuote(form({ signOffAs: "other", signOffOther: "  The   Nkosi family " }), NOT_REGISTERED);
    expect(parsed.ok && parsed.quote.signOffOther).toBe("The Nkosi family");
    const empty = parseQuote(form({ signOffAs: "other", signOffOther: " " }), NOT_REGISTERED);
    expect(!empty.ok && empty.errors.fields.signOffOther).toBe("Enter the name to sign with, or choose another option.");
    const other = parseQuote(form({ signOffAs: "owner", signOffOther: "The Nkosi family" }), NOT_REGISTERED);
    expect(other.ok && other.quote.signOffOther).toBeNull();
    expect(parseSignOffOther("other", "a".repeat(121)).ok).toBe(false);

    const quote = parseQuote(form({ signOffAs: "other", signOffOther: "The Nkosi family" }), NOT_REGISTERED);
    if (!quote.ok) throw new Error("should parse");
    const snapshot = buildQuoteSnapshot({
      quote: quote.quote, number: "QT-0001", version: 1, business: { ...business }, customer: null,
      countryCode: "ZA", currencyCode: "ZAR", vat: NOT_REGISTERED, locale: ZA_LOCALE, bank: null,
    });
    expect(signOffBlock(snapshot)).toEqual({ message: "Yours in sweetness", name: "The Nkosi family" });
  });

  it("refuses a sign-off choice that is not one of the four", () => {
    const bad = { ...form(), signOffAs: "someone" } as unknown as QuoteFormValues;
    // The shape check refuses it, so a hand-built request cannot store it.
    return import("../index").then(({ isQuoteFormValues }) => {
      expect(isQuoteFormValues(bad)).toBe(false);
      expect(isQuoteFormValues(form({ signOffAs: "owner" }))).toBe(true);
    });
  });
});
