import { describe, expect, it } from "vitest";
import { ZA_NUMBER_STYLE } from "../../locale/za";
import { currencySymbol } from "../format";

describe("currencySymbol", () => {
  it("gives the symbol the locale writes, or the currency code when it has none", () => {
    expect(currencySymbol("ZAR", ZA_NUMBER_STYLE)).toBe("R");
    expect(currencySymbol("USD", ZA_NUMBER_STYLE)).toBe("USD");
  });
});
