import { describe, expect, it } from "vitest";
import { ZA_NUMBER_STYLE } from "@/lib/locale/za";
import { addedPriceNote, type PriceBase } from "../added-price";

// (South Africa writes a space after the R, which may be a no-break one: compared with an ordinary space.)
const plain = (text: string | null) => text?.replace(/R\s/g, "R ") ?? null;
const note = (added: string, bases: PriceBase[], only?: string) => plain(addedPriceNote(added, bases, "ZAR", ZA_NUMBER_STYLE, only));
const OWN: PriceBase[] = [{ key: "", name: "", price: "100" }];
const SIZES: PriceBase[] = [
  { key: "s", name: "Small", price: "300" },
  { key: "l", name: "Large", price: "600,50" },
];

describe("addedPriceNote", () => {
  it("one price: what it makes in total", () => {
    expect(note("25", OWN)).toBe("R 125,00 in total");
    expect(note("0", OWN)).toBe("R 100,00 in total");
    expect(note("2,5", OWN)).toBe("R 102,50 in total");
  });

  it("several prices: each named", () => {
    expect(note("30", SIZES)).toBe("Small R 330,00 · Large R 630,50");
  });

  it("one box for one price (a choice priced by size): only that size, in total", () => {
    expect(note("120", SIZES, "l")).toBe("R 720,50 in total");
    expect(note("50", SIZES, "s")).toBe("R 350,00 in total");
  });

  it("says nothing when there is nothing to add, or it cannot be read", () => {
    expect(note("", OWN)).toBeNull();
    expect(note("  ", OWN)).toBeNull();
    expect(note("lots", OWN)).toBeNull();
    expect(note("5", [{ key: "", name: "", price: "" }])).toBeNull();
    expect(note("5", [{ key: "", name: "", price: "x" }])).toBeNull();
    expect(note("5", SIZES, "gone")).toBeNull();
  });

  it("leaves out a price that is not typed yet, and keeps the others", () => {
    expect(note("30", [{ key: "s", name: "Small", price: "300" }, { key: "l", name: "Large", price: "" }])).toBe("Small R 330,00");
  });
});
