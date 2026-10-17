import { parseLine, type LineFormValues } from "@/lib/quotes";
import { chosenIdsOf } from "@/lib/quotes/chosen";
import { isIsoDay } from "@/lib/quotes/dates";
import type { QuantityMilli } from "@/lib/money";
import type { JobFulfilment } from "./index";

/**
 * A job made by hand, without a quote (a walk-in order, a repeat, work agreed over WhatsApp). Its items are added the
 * same way a quote's are (the same sheet: a product or service with its variation and choices, or a one-off item),
 * only without prices. What the maker typed is checked here, on the screen and again on the server; the database
 * checks it a third time.
 */

export const NEW_JOB_LIMITS = { items: 50, optionsPerItem: 50, address: 1000, note: 2000 } as const;

/** An item on the form: the quote's own item values. */
export type NewJobLine = LineFormValues;

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
  /** The product it came from, or null. The job takes a frozen copy of the product's steps. */
  productId: string | null;
  /** The ids of the variation, list choices and extras chosen on it: the job takes the steps that depend on them. */
  chosenIds: string[];
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

// The database cannot store a NUL character (pasted text sometimes has one).
const NUL = "That text has a character that can't be saved. Delete it and type it again.";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The problems with these values, in the order they appear on the screen; none means it can be saved.
 * `photoFor` gives an item's picture from the business's own products (see jobItemPhoto); without it there are none.
 */
export function parseNewJob(
  values: NewJobValues,
  photoFor: (line: LineFormValues) => string | null = () => null,
): { ok: true; value: NewJob } | { ok: false; errors: NewJobErrors } {
  const errors: NewJobErrors = {};
  const text = (s: unknown) => (typeof s === "string" ? s.trim() : "");
  const hasNul = (s: unknown) => typeof s === "string" && s.includes("\u0000");

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
    const r = parseJobLine(item, photoFor);
    if (r.ok) items.push(r.value);
    else errors[`line:${key}`] = r.error;
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

/**
 * One item as the database takes it: the quote's own item check, for a line that has no price. The same check runs
 * when a whole job is made and when one item is added to a job that exists.
 */
export function parseJobLine(
  item: LineFormValues,
  photoFor: (line: LineFormValues) => string | null = () => null,
): { ok: true; value: NewJobItem } | { ok: false; error: string } {
  const hasNul = (s: unknown) => typeof s === "string" && s.includes("\u0000");
  // A job item has no price: the quote's item check wants one, so it is given a neutral one that is never kept.
  let r: ReturnType<typeof parseLine>;
  try {
    r = parseLine({ ...item, unitPrice: "0", discountKind: "none", discountValue: "", vatStatus: "standard" });
  } catch {
    // Only a hand-built request gets here (a choice that is not an object, and so on).
    return { ok: false, error: "This item could not be read. Remove it and add it again." };
  }
  if (!r.ok) {
    const e = r.errors;
    return { ok: false, error: e.name ?? e.variation ?? e.options ?? e.quantity ?? e.unit ?? e.description ?? "This item could not be read. Remove it and add it again." };
  }
  if (r.line.options.length > NEW_JOB_LIMITS.optionsPerItem) {
    return { ok: false, error: `An item can have up to ${NEW_JOB_LIMITS.optionsPerItem} choices and extras. Remove some of them.` };
  }
  const words = [r.line.name, r.line.description, r.line.unit, r.line.variation?.label, r.line.variation?.name, ...r.line.options.flatMap((o) => [o.group, o.value, o.text])];
  if (words.some(hasNul)) return { ok: false, error: NUL };
  return {
    ok: true,
    value: {
      kind: r.line.kind === "service" ? "service" : r.line.kind === "product" ? "product" : "custom",
      name: r.line.name,
      description: r.line.description,
      quantityMilli: r.line.quantityMilli,
      unit: r.line.unit,
      variationLabel: r.line.variation?.label ?? null,
      variationName: r.line.variation?.name ?? null,
      options: r.line.options.map((o) => ({ group: o.group, kind: o.kind, value: o.value, text: o.text, quantityMilli: o.quantityMilli })),
      photoImageId: r.line.productId ? photoFor(item) : null,
      // Where it came from: the job takes a frozen copy of the product's steps (the database checks it is this business's).
      productId: r.line.productId ?? null,
      chosenIds: chosenIdsOf(r.line),
    },
  };
}
