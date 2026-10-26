import { describe, expect, it } from "vitest";
import { isDefaultDepositKind } from "../deposit";
import { canSaveUsualText, canUseUsualText, normaliseText, sameDeposit, sameDiscount, usualsFromProfile } from "../usuals";

const za = { decimal: ",", group: " " } as const;

describe("the usuals a new quote starts with", () => {
  const base = { defaultDescription: null, defaultSignOff: null, paymentInstructions: null, defaultDepositKind: "none", defaultDepositValue: 0, defaultDiscountKind: "none", defaultDiscountValue: 0, usualFulfilment: null, signOffAs: "business", signOffOther: null } as const;

  it("are empty for a business that has set none", () => {
    expect(usualsFromProfile(base, za as never)).toEqual({ description: "", signOff: "", paymentInstructions: "", depositKind: "none", depositValue: "", discountKind: "none", discountValue: "", fulfilment: "none", signOffAs: "business", signOffOther: "" });
  });
  it("carry the saved wording and the deposit as it is typed", () => {
    const u = usualsFromProfile(
      { ...base, defaultDescription: "Thank you.", defaultSignOff: "Kind regards", paymentInstructions: "EFT", defaultDepositKind: "percent", defaultDepositValue: 5000 },
      za as never,
    );
    expect(u.description).toBe("Thank you.");
    expect(u.depositKind).toBe("percent");
    expect(u.depositValue).toMatch(/^50/);
  });
  it("carry the saved discount as it is typed", () => {
    const pct = usualsFromProfile({ ...base, defaultDiscountKind: "percent", defaultDiscountValue: 1000 }, za as never);
    expect(pct.discountKind).toBe("percent");
    expect(pct.discountValue).toMatch(/^10/);
    const fixed = usualsFromProfile({ ...base, defaultDiscountKind: "fixed", defaultDiscountValue: 25000 }, za as never);
    expect(fixed.discountKind).toBe("fixed");
    expect(fixed.discountValue).toMatch(/^250/);
  });
  it("carry delivery or collection, and who signs with the name typed", () => {
    const u = usualsFromProfile({ ...base, usualFulfilment: "delivery", signOffAs: "other", signOffOther: "Studio Nkosi" }, za as never);
    expect(u.fulfilment).toBe("delivery");
    expect(u.signOffAs).toBe("other");
    expect(u.signOffOther).toBe("Studio Nkosi");
  });
  it("keep 'ask' with no amount", () => {
    const u = usualsFromProfile({ ...base, defaultDepositKind: "ask" }, za as never);
    expect(u.depositKind).toBe("ask");
    expect(u.depositValue).toBe("");
  });
});

describe("when Save as my usual and Use my usual are offered", () => {
  it("offers saving only for text that is not blank and differs from the usual", () => {
    expect(canSaveUsualText("Hello", "")).toBe(true);
    expect(canSaveUsualText("Hello", "Hello")).toBe(false);
    expect(canSaveUsualText("  Hello ", "Hello")).toBe(false);
    expect(canSaveUsualText("   ", "Hello")).toBe(false);
    expect(canSaveUsualText("", "")).toBe(false);
  });
  it("does not offer to save the generic starting text while there is no usual of the business's own", () => {
    expect(canSaveUsualText("Thank you.", "", "Thank you.")).toBe(false);
    expect(canSaveUsualText(" Thank  you. ", "", "Thank you.")).toBe(false);
    expect(canSaveUsualText("Thanks!", "", "Thank you.")).toBe(true);
    // Once there is a usual, the starting text is just another change from it.
    expect(canSaveUsualText("Thank you.", "Kind regards", "Thank you.")).toBe(true);
  });
  it("offers going back only when there is a usual and the quote differs from it", () => {
    expect(canUseUsualText("Changed", "Hello")).toBe(true);
    expect(canUseUsualText("", "Hello")).toBe(true);
    expect(canUseUsualText("Hello", "Hello")).toBe(false);
    expect(canUseUsualText("Changed", "")).toBe(false);
  });
});

describe("deposit defaults", () => {
  it("accept 'ask' as well as the kinds a quote can have", () => {
    for (const k of ["none", "percent", "fixed", "ask"]) expect(isDefaultDepositKind(k)).toBe(true);
    expect(isDefaultDepositKind("whenever")).toBe(false);
    expect(isDefaultDepositKind(undefined)).toBe(false);
  });
});

describe("comparing what is typed with the usual", () => {
  it("ignores the tidying the server does to text", () => {
    expect(normaliseText("Kind  regards ")).toBe("Kind regards");
    expect(normaliseText("a\r\n\r\n\r\n\r\nb")).toBe("a\n\nb");
    expect(canSaveUsualText("Kind  regards", "Kind regards")).toBe(false);
    expect(canUseUsualText("Kind  regards", "Kind regards")).toBe(false);
  });
  it("compares a deposit by what it works out to, not how it was typed", () => {
    expect(sameDeposit({ kind: "percent", value: "50" }, { kind: "percent", value: "50,0" })).toBe(true);
    expect(sameDeposit({ kind: "fixed", value: "1250" }, { kind: "fixed", value: "1 250,00" })).toBe(true);
    expect(sameDeposit({ kind: "percent", value: "30" }, { kind: "percent", value: "50" })).toBe(false);
    expect(sameDeposit({ kind: "percent", value: "50" }, { kind: "fixed", value: "50" })).toBe(false);
    expect(sameDeposit({ kind: "none", value: "" }, { kind: "none", value: "" })).toBe(true);
    // Not a number yet: compared as typed.
    expect(sameDeposit({ kind: "percent", value: "abc" }, { kind: "percent", value: "abc" })).toBe(true);
  });
});

describe("sameDiscount", () => {
  it("compares by what the discount works out to, not by its text", () => {
    expect(sameDiscount({ kind: "percent", value: "10" }, { kind: "percent", value: "10,0" })).toBe(true);
    expect(sameDiscount({ kind: "percent", value: "10" }, { kind: "percent", value: "12" })).toBe(false);
    expect(sameDiscount({ kind: "fixed", value: "250" }, { kind: "fixed", value: "250,00" })).toBe(true);
    expect(sameDiscount({ kind: "percent", value: "10" }, { kind: "fixed", value: "10" })).toBe(false);
    expect(sameDiscount({ kind: "none", value: "" }, { kind: "none", value: "" })).toBe(true);
  });
});
