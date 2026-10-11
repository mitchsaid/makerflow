import { describe, expect, it } from "vitest";
import { emptyJobItem, MISSING_JOB_CUSTOMER, MISSING_JOB_ITEMS, parseNewJob, type NewJobValues } from "../new-job";

const CUSTOMER = "11111111-1111-4111-8111-111111111111";
const good = (over: Partial<NewJobValues> = {}): NewJobValues => ({
  customerId: CUSTOMER,
  fulfilment: "none",
  deliveryAddress: "",
  neededBy: "",
  note: "",
  items: [{ ...emptyJobItem("a"), name: "Oak shelf" }],
  ...over,
});

describe("parseNewJob", () => {
  it("accepts a customer and one item, with everything else empty", () => {
    const r = parseNewJob(good());
    expect(r).toEqual({
      ok: true,
      value: { customerId: CUSTOMER, fulfilment: "none", deliveryAddress: null, neededBy: null, note: null, items: [{ name: "Oak shelf", description: null, quantityMilli: 1000, unit: null }] },
    });
  });

  it("asks for a customer and for items, naming how to fix each", () => {
    const r = parseNewJob(good({ customerId: "", items: [] }));
    expect(r).toMatchObject({ ok: false, errors: { customerId: MISSING_JOB_CUSTOMER, items: MISSING_JOB_ITEMS } });
  });

  it("points at the item and field with the problem", () => {
    const r = parseNewJob(good({ items: [{ ...emptyJobItem("a"), name: "Shelf" }, { ...emptyJobItem("b"), name: "", quantity: "0" }, { ...emptyJobItem("c"), name: "Bracket", quantity: "1,5000x" }] }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors)).toEqual(["item-1-name", "item-1-quantity", "item-2-quantity"]);
  });

  it("reads quantities in thousandths, with a decimal comma", () => {
    const r = parseNewJob(good({ items: [{ ...emptyJobItem("a"), name: "Flour", quantity: "2,5", unit: " kg ", description: " fine " }] }));
    expect(r).toMatchObject({ ok: true, value: { items: [{ name: "Flour", quantityMilli: 2500, unit: "kg", description: "fine" }] } });
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
    const items = Array.from({ length: 51 }, (_, i) => ({ ...emptyJobItem(String(i)), name: `Item ${i}` }));
    expect(parseNewJob(good({ items }))).toMatchObject({ ok: false, errors: { items: "A job can have up to 50 items." } });
  });
});
