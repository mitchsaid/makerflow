import { parseLine, type LineFormValues } from "@/lib/quotes";
import { isIsoDay } from "@/lib/quotes/dates";
import type { QuantityMilli } from "@/lib/money";
import type { JobFulfilment } from "./index";

/**
 * A job made by hand, without a quote (a walk-in order, a repeat, work agreed over WhatsApp). Its items are added the
 * same way a quote's are (the same sheet: a product or service with its variation and choices, or a one-off item),
 * only without prices. What the maker typed is checked here, on the screen and again on the server; the database
 * checks it a third time.
 */

export const NEW_JOB_LIMITS = { items: 50, address: 1000, note: 2000 } as const;

/** An item on the form: the quote's own item values, and the picture of what was chosen (if the product has one). */
export type NewJobLine = LineFormValues & { photoImageId?: string | null };

export type NewJobValues = {
  customerId: string;
  fulfilment: JobFulfilment;
  deliveryAddress: string;
  neededBy: string;
  note: string;
  items: NewJobLine[];
};

export type NewJobItem = {
  kind: "product" | "service" | "custom";
  name: string;
  description: string | null;
  quantityMilli: QuantityMilli;
  unit: string | null;
  variationLabel: string | null;
  variationName: string | null;
  options: { group: string; kind: string; value: string | null; text: string | null; quantityMilli: number | null }[];
  photoImageId: string | null;
};

export type NewJob = {
  customerId: string;
  fulfilment: JobFulfilment;
  deliveryAddress: string | null;
  neededBy: string | null;
  note: string | null;
  items: NewJobItem[];
};

/** Field id → message. An item's problem is under `line:<its key>` (one message per item). */
export type NewJobErrors = Record<string, string>;

export const MISSING_JOB_CUSTOMER = "Choose who this job is for, or add them as a new customer.";
export const MISSING_JOB_ITEMS = "Add at least one item to make.";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The problems with these values, in the order they appear on the screen; none means it can be saved. */
export function parseNewJob(values: NewJobValues): { ok: true; value: NewJob } | { ok: false; errors: NewJobErrors } {
  const errors: NewJobErrors = {};
  const text = (s: unknown) => (typeof s === "string" ? s.trim() : "");
  // The database cannot store a NUL character (pasted text sometimes has one).
  const hasNul = (s: unknown) => typeof s === "string" && s.includes("\u0000");
  const NUL = "That text has a character that can't be saved. Delete it and type it again.";

  if (!UUID.test(text(values.customerId))) errors.customerId = MISSING_JOB_CUSTOMER;

  const fulfilment = values.fulfilment;
  if (fulfilment !== "none" && fulfilment !== "collection" && fulfilment !== "delivery") errors.fulfilment = "Choose collection, delivery or not decided yet.";

  const address = text(values.deliveryAddress);
  if (hasNul(values.deliveryAddress)) errors.deliveryAddress = NUL;
  else if (address.length > NEW_JOB_LIMITS.address) errors.deliveryAddress = `Keep the address to ${NEW_JOB_LIMITS.address} characters or fewer. It is ${address.length} now.`;

  const neededBy = text(values.neededBy);
  if (neededBy !== "" && !isIsoDay(neededBy)) errors.neededBy = "Choose the day from the calendar, or leave it empty.";

  const note = text(values.note);
  if (hasNul(values.note)) errors.note = NUL;
  else if (note.length > NEW_JOB_LIMITS.note) errors.note = `Keep the note to ${NEW_JOB_LIMITS.note} characters or fewer. It is ${note.length} now.`;

  const items: NewJobItem[] = [];
  const list = Array.isArray(values.items) ? values.items : [];
  if (list.length === 0) errors.items = MISSING_JOB_ITEMS;
  if (list.length > NEW_JOB_LIMITS.items) errors.items = `A job can have up to ${NEW_JOB_LIMITS.items} items.`;
  list.forEach((item, i) => {
    const key = typeof item?.key === "string" && item.key !== "" ? item.key : `#${i}`;
    // A job item has no price: the quote's item check wants one, so it is given a neutral one that is never kept.
    const r = parseLine({ ...item, unitPrice: "0", discountKind: "none", discountValue: "", vatStatus: "standard" });
    if (!r.ok) {
      const e = r.errors;
      errors[`line:${key}`] = e.name ?? e.variation ?? e.options ?? e.quantity ?? e.unit ?? e.description ?? "This item could not be read. Remove it and add it again.";
      return;
    }
    const nul = [r.line.name, r.line.description, r.line.unit, ...r.line.options.map((o) => o.text)].some(hasNul);
    if (nul) {
      errors[`line:${key}`] = NUL;
      return;
    }
    const photo = typeof item.photoImageId === "string" && UUID.test(item.photoImageId) ? item.photoImageId : null;
    items.push({
      kind: r.line.kind === "service" ? "service" : r.line.kind === "product" ? "product" : "custom",
      name: r.line.name,
      description: r.line.description,
      quantityMilli: r.line.quantityMilli,
      unit: r.line.unit,
      variationLabel: r.line.variation?.label ?? null,
      variationName: r.line.variation?.name ?? null,
      options: r.line.options.map((o) => ({ group: o.group, kind: o.kind, value: o.value, text: o.text, quantityMilli: o.quantityMilli })),
      photoImageId: r.line.productId ? photo : null,
    });
  });

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      customerId: text(values.customerId),
      fulfilment,
      // An address belongs to a delivery; if the maker changed their mind it is dropped.
      deliveryAddress: fulfilment === "delivery" && address !== "" ? address : null,
      neededBy: neededBy === "" ? null : neededBy,
      note: note === "" ? null : note,
      items,
    },
  };
}
