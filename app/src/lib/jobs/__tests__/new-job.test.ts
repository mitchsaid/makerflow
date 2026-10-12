import { describe, expect, it } from "vitest";
import type { LineFormValues } from "@/lib/quotes";
import { MISSING_JOB_CUSTOMER, MISSING_JOB_ITEMS, parseNewJob, type NewJobLine, type NewJobValues } from "../new-job";

const CUSTOMER = "11111111-1111-4111-8111-111111111111";
const PRODUCT = "22222222-2222-4222-8222-222222222222";
const PHOTO = "33333333-3333-4333-8333-333333333333";

const oneOff = (key: string, over: Partial<NewJobLine> = {}): NewJobLine => ({
  key,
  kind: "custom",
  productId: "",
  name: "Oak shelf",
  description: "",
  quantity: "1",
  unit: "",
  unitPrice: "",
  discountKind: "none",
  discountValue: "",
  ...over,
});
const good = (over: Partial<NewJobValues> = {}): NewJobValues => ({
  customerId: CUSTOMER,
  fulfilment: "none",
  deliveryAddress: "",
  neededBy: "",
  note: "",
  items: [oneOff("a")],
  ...over,
});
const cake = (over: Partial<NewJobLine> = {}): NewJobLine =>
  oneOff("c", {
    kind: "product",
    productId: PRODUCT,
    name: "Wedding cake",
    variationId: "44444444-4444-4444-8444-444444444444",
    variationLabel: "Size",
    variationName: "Large",
    options: [
      { groupId: "55555555-5555-4555-8555-555555555555", group: "Flavour", kind: "one", valueId: "66666666-6666-4666-8666-666666666666", value: "Vanilla", text: "", amountCents: 500 },
    ],
    photoImageId: PHOTO,
    ...over,
  });

describe("parseNewJob", () => {
  it("accepts a customer and one item, with everything else empty, and no price", () => {
    const r = parseNewJob(good());
    expect(r).toEqual({
      ok: true,
      value: {
        customerId: CUSTOMER,
        fulfilment: "none",
        deliveryAddress: null,
        neededBy: null,
        note: null,
        items: [{ kind: "custom", name: "Oak shelf", description: null, quantityMilli: 1000, unit: null, variationLabel: null, variationName: null, options: [], photoImageId: null }],
      },
    });
  });

  it("takes a product item with its variation, choices and picture, as the quote does, without any amounts", () => {
    const r = parseNewJob(good({ items: [cake()] }));
    expect(r).toMatchObject({
      ok: true,
      value: {
        items: [
          {
            kind: "product",
            name: "Wedding cake",
            variationLabel: "Size",
            variationName: "Large",
            photoImageId: PHOTO,
            options: [{ group: "Flavour", kind: "one", value: "Vanilla", text: null, quantityMilli: null }],
          },
        ],
      },
    });
    if (r.ok) expect(JSON.stringify(r.value)).not.toContain("amountCents");
  });

  it("keeps a picture only on an item from a product", () => {
    const r = parseNewJob(good({ items: [oneOff("a", { photoImageId: PHOTO })] }));
    expect(r).toMatchObject({ ok: true, value: { items: [{ photoImageId: null }] } });
  });

  it("asks for a customer and for items, naming how to fix each", () => {
    const r = parseNewJob(good({ customerId: "", items: [] }));
    expect(r).toMatchObject({ ok: false, errors: { customerId: MISSING_JOB_CUSTOMER, items: MISSING_JOB_ITEMS } });
  });

  it("points at the item with the problem, by its key, whatever its place in the list", () => {
    const r = parseNewJob(good({ items: [oneOff("a"), oneOff("b", { name: "" }), oneOff("c", { quantity: "0" })] }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors)).toEqual(["line:b", "line:c"]);
    expect(r.errors["line:b"]).toBe("Say what this item is, like “Wedding cake”.");
  });

  it("reads quantities in thousandths, with a decimal comma", () => {
    const r = parseNewJob(good({ items: [oneOff("a", { name: "Flour", quantity: "2,5", unit: " kg ", description: " fine " })] }));
    expect(r).toMatchObject({ ok: true, value: { items: [{ name: "Flour", quantityMilli: 2500, unit: "kg", description: "fine" }] } });
  });

  it("does not need a price", () => {
    expect(parseNewJob(good({ items: [oneOff("a", { unitPrice: "" })] })).ok).toBe(true);
  });

  it("keeps an address only for a delivery", () => {
    expect(parseNewJob(good({ fulfilment: "delivery", deliveryAddress: " 12 Long Street " }))).toMatchObject({ ok: true, value: { deliveryAddress: "12 Long Street" } });
    expect(parseNewJob(good({ fulfilment: "collection", deliveryAddress: "12 Long Street" }))).toMatchObject({ ok: true, value: { deliveryAddress: null } });
  });

  it("checks the day and the lengths", () => {
    const r = parseNewJob(good({ neededBy: "2026-02-30", note: "x".repeat(2001), deliveryAddress: "y".repeat(1001) }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(["deliveryAddress", "neededBy", "note"]);
  });

  it("refuses more than 50 items", () => {
    const items = Array.from({ length: 51 }, (_, i) => oneOff(String(i), { name: `Item ${i}` }));
    expect(parseNewJob(good({ items }))).toMatchObject({ ok: false, errors: { items: "A job can have up to 50 items." } });
  });

  it("refuses a character the database cannot store, and bad ids and fulfilments", () => {
    const r = parseNewJob(good({ note: "a\u0000b", items: [oneOff("a", { name: "Sh\u0000elf" })] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["line:a", "note"]);
    expect(parseNewJob(good({ customerId: "not-an-id" }))).toMatchObject({ ok: false, errors: { customerId: MISSING_JOB_CUSTOMER } });
    expect(parseNewJob(good({ fulfilment: "pigeon" as never }))).toMatchObject({ ok: false, errors: { fulfilment: expect.any(String) } });
  });

  it("refuses an item whose product link or choice is not readable", () => {
    const bad: LineFormValues = { ...cake(), productId: "nope" };
    expect(parseNewJob(good({ items: [bad] }))).toMatchObject({ ok: false, errors: { "line:c": expect.any(String) } });
    expect(parseNewJob(good({ items: [oneOff("a", { variationName: "Large", variationLabel: "Size" })] })).ok).toBe(false);
  });
});
