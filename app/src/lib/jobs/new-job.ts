import { parseQuantity, type QuantityMilli } from "@/lib/money";
import { isIsoDay } from "@/lib/quotes/dates";
import type { JobFulfilment } from "./index";

/**
 * A job made by hand, without a quote (a walk-in order, a repeat, work agreed over WhatsApp). What the maker types is
 * checked here, on the screen and again on the server; the database checks it a third time.
 */

export const NEW_JOB_LIMITS = { items: 50, itemName: 300, description: 4000, unit: 20, address: 1000, note: 2000 } as const;

export type NewJobItemValues = { key: string; name: string; quantity: string; unit: string; description: string };

export type NewJobValues = {
  customerId: string;
  fulfilment: JobFulfilment;
  deliveryAddress: string;
  neededBy: string;
  note: string;
  items: NewJobItemValues[];
};

export type NewJob = {
  customerId: string;
  fulfilment: JobFulfilment;
  deliveryAddress: string | null;
  neededBy: string | null;
  note: string | null;
  items: { name: string; description: string | null; quantityMilli: QuantityMilli; unit: string | null }[];
};

/** Field id → message. Item fields are `item-<n>-name` and `item-<n>-quantity` (n from 0). */
export type NewJobErrors = Record<string, string>;

export const MISSING_JOB_CUSTOMER = "Choose who this job is for, or add them as a new customer.";
export const MISSING_JOB_ITEMS = "Add at least one item to make.";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const emptyJobItem = (key: string): NewJobItemValues => ({ key, name: "", quantity: "1", unit: "", description: "" });

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

  const items: NewJob["items"] = [];
  const list = Array.isArray(values.items) ? values.items : [];
  if (list.length === 0) errors.items = MISSING_JOB_ITEMS;
  if (list.length > NEW_JOB_LIMITS.items) errors.items = `A job can have up to ${NEW_JOB_LIMITS.items} items.`;
  list.forEach((item, i) => {
    const name = text(item?.name);
    if (hasNul(item?.name)) errors[`item-${i}-name`] = NUL;
    else if (name === "") errors[`item-${i}-name`] = "Say what to make.";
    else if (name.length > NEW_JOB_LIMITS.itemName) errors[`item-${i}-name`] = `Keep the name to ${NEW_JOB_LIMITS.itemName} characters or fewer.`;
    const quantity = parseQuantity(item?.quantity);
    if (!quantity.ok) errors[`item-${i}-quantity`] = quantity.error;
    const unit = text(item?.unit);
    if (hasNul(item?.unit)) errors[`item-${i}-unit`] = NUL;
    else if (unit.length > NEW_JOB_LIMITS.unit) errors[`item-${i}-unit`] = `Keep the unit to ${NEW_JOB_LIMITS.unit} characters or fewer.`;
    const description = text(item?.description);
    if (hasNul(item?.description)) errors[`item-${i}-description`] = NUL;
    else if (description.length > NEW_JOB_LIMITS.description) errors[`item-${i}-description`] = `Keep the details to ${NEW_JOB_LIMITS.description} characters or fewer.`;
    if (!errors[`item-${i}-name`] && quantity.ok && !errors[`item-${i}-unit`] && !errors[`item-${i}-description`]) {
      items.push({ name, description: description === "" ? null : description, quantityMilli: quantity.value, unit: unit === "" ? null : unit });
    }
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
