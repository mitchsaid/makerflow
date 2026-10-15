import { describe, expect, it } from "vitest";
import { isDefaultDepositKind } from "../deposit";
import { canSaveUsualText, canUseUsualText, usualsFromProfile } from "../usuals";

const za = { decimal: ",", group: " " } as const;

describe("the usuals a new quote starts with", () => {
  const base = { defaultDescription: null, defaultSignOff: null, paymentInstructions: null, defaultDepositKind: "none", defaultDepositValue: 0 } as const;

  it("are empty for a business that has set none", () => {
    expect(usualsFromProfile(base, za as never)).toEqual({ description: "", signOff: "", paymentInstructions: "", depositKind: "none", depositValue: "" });
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
