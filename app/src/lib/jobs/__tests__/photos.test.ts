import { describe, expect, it } from "vitest";
import type { ProductSummary } from "@/lib/products";
import type { LineFormValues } from "@/lib/quotes";
import { jobItemPhoto } from "../photos";

const IMG = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

const product = {
  id: "p1",
  photoImageId: IMG(1),
  variations: [
    { id: "v1", imageId: IMG(2) },
    { id: "v2", imageId: null },
  ],
  options: [{ id: "g1", values: [{ id: "o1", imageId: IMG(3) }, { id: "o2", imageId: null }] }],
} as unknown as ProductSummary;

const line = (over: Partial<LineFormValues> = {}): LineFormValues => ({
  key: "a", kind: "product", productId: "p1", name: "Cake", description: "", quantity: "1", unit: "",
  unitPrice: "", discountKind: "none", discountValue: "", variationId: "", options: [], ...over,
});

describe("jobItemPhoto", () => {
  it("is the chosen variation's picture, else the first choice's, else the product's", () => {
    expect(jobItemPhoto(line({ variationId: "v1" }), [product])).toBe(IMG(2));
    const choice = { groupId: "g1", group: "Flavour", kind: "one" as const, valueId: "o1", value: "Vanilla", text: "", amountCents: 0 };
    expect(jobItemPhoto(line({ variationId: "v2", options: [choice] }), [product])).toBe(IMG(3));
    expect(jobItemPhoto(line({ variationId: "v2" }), [product])).toBe(IMG(1));
  });

  it("is nothing for a one-off item or a product that is not the business's", () => {
    expect(jobItemPhoto(line({ productId: "" }), [product])).toBeNull();
    expect(jobItemPhoto(line({ productId: "someone-elses" }), [product])).toBeNull();
  });
});
