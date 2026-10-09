import { parseMoney, type Cents } from "../money";

/**
 * Extras (docs/plans/product-extras.md): what people can add to a product, like gift wrap or engraving.
 * An extra is a name, a price and an optional "ask for wording". It is SHARED (the business has it once, with
 * one price on every product that has it) or for ONE product only (its own price, which can differ by the
 * product's variations).
 */

export const EXTRA_NAME_MAX = 80;
export const EXTRAS_MAX = 40;
export const EXTRA_TEXT_MAX = 500;
export const EXTRA_TEXT_DEFAULT = 100;

/** An extra of a product, as it is saved. */
export type ExtraSummary = {
  id: string;
  name: string;
  /** What it adds, in the business's VAT entry mode. */
  priceCents: Cents;
  /** The person quoting types what it should say ("Happy 40th"). */
  asksForWording: boolean;
  textMax: number;
  /** The business has it once, on every product that has it. False: this product only. */
  shared: boolean;
  /** How many products have it (a product-only extra is on one). */
  usedOn: number;
  /** Product-only extras can cost more on a bigger size. */
  priceByVariation: boolean;
  /** By variation id, when `priceByVariation`. */
  prices: Record<string, Cents>;
};

/** A saved extra offered when another product wants one the business already has. */
export type SharedExtra = Pick<ExtraSummary, "id" | "name" | "priceCents" | "asksForWording" | "textMax" | "usedOn">;

/** One extra on the form while it is being filled in. The id is "" for a new one. */
export type ExtraFormRow = {
  key: string;
  id: string;
  name: string;
  price: string;
  asksForWording: boolean;
  /** "" means the usual length. */
  textMax: string;
  shared: boolean;
  /** Products that have it as saved (for "Used on 3 products"); 0 for a new one. */
  usedOn: number;
  /**
   * Changed on this form since it was opened or saved. A shared extra that was not changed is left as it is
   * when the product is saved, so a form that is out of date never puts an old price back on every product.
   * Absent (an older form): changed.
   */
  edited?: boolean;
  priceByVariation?: boolean;
  /** By the variation row's key, when `priceByVariation`. */
  prices?: Record<string, string>;
};

export type ParsedExtra = {
  id: string | null;
  name: string;
  priceCents: Cents;
  asksForWording: boolean;
  textMax: number;
  shared: boolean;
  priceByVariation: boolean;
  prices: { variationIndex: number; priceCents: Cents }[];
  /** False: a shared extra left as it is. */
  changed: boolean;
};

export type ExtraRowErrors = { name?: string; price?: string; textMax?: string; prices?: Record<string, string> };
export type ExtraErrors = { list?: string; rows: Record<string, ExtraRowErrors> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isExtraRow(value: unknown): value is ExtraFormRow {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const pricesOk =
    v.prices === undefined ||
    (typeof v.prices === "object" && v.prices !== null && !Array.isArray(v.prices) && Object.values(v.prices).every((p) => typeof p === "string"));
  return (
    typeof v.key === "string" &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.price === "string" &&
    typeof v.asksForWording === "boolean" &&
    typeof v.textMax === "string" &&
    typeof v.shared === "boolean" &&
    typeof v.usedOn === "number" &&
    (v.edited === undefined || typeof v.edited === "boolean") &&
    (v.priceByVariation === undefined || typeof v.priceByVariation === "boolean") &&
    pricesOk
  );
}

const tidy = (text: string) => text.trim().replace(/\s+/g, " ");

/**
 * Checks the extras, saying how to fix each problem where it is. `variationKeys` are the product's variation
 * rows in order (a price by variation is stored by the variation's place in that list).
 */
export function parseExtras(
  input: unknown,
  variationKeys: readonly string[] = [],
): { ok: true; extras: ParsedExtra[] } | { ok: false; errors: ExtraErrors } {
  const unreadable = "The extras could not be read. Open the product again.";
  if (!Array.isArray(input)) return { ok: false, errors: { list: unreadable, rows: {} } };
  if (input.length > EXTRAS_MAX) return { ok: false, errors: { list: `A product can have up to ${EXTRAS_MAX} extras.`, rows: {} } };
  if (!input.every(isExtraRow)) return { ok: false, errors: { list: unreadable, rows: {} } };

  const errors: ExtraErrors = { rows: {} };
  const extras: ParsedExtra[] = [];
  const names = new Set<string>();
  for (const row of input) {
    const e: ExtraRowErrors = {};
    const name = tidy(row.name);
    if (name === "") e.name = "Give it a name, like “Gift wrap”.";
    else if (name.length > EXTRA_NAME_MAX) e.name = `Keep the name to ${EXTRA_NAME_MAX} characters or fewer.`;
    else if (names.has(name.toLowerCase())) e.name = "Two extras have this name. Give each its own.";
    names.add(name.toLowerCase());

    // Product-only extras can cost more on a bigger size: a shared one has no sizes to ask about.
    const byVariation = !row.shared && row.priceByVariation === true && variationKeys.length > 0;
    let priceCents: Cents = 0;
    const prices: { variationIndex: number; priceCents: Cents }[] = [];
    if (byVariation) {
      const priceErrors: Record<string, string> = {};
      variationKeys.forEach((vk, index) => {
        const text = row.prices?.[vk] ?? "";
        // Left empty, a size would quietly cost nothing: say so (0 is fine when typed).
        if (text.trim() === "") {
          priceErrors[vk] = "Enter what it adds for this one. Use 0 if nothing.";
          return;
        }
        const r = parseMoney(text);
        if (r.ok) prices.push({ variationIndex: index, priceCents: r.value });
        else priceErrors[vk] = r.error;
      });
      if (Object.keys(priceErrors).length > 0) e.prices = priceErrors;
      // Its own price is the lowest of its prices (its "from").
      priceCents = prices.length > 0 ? Math.min(...prices.map((p) => p.priceCents)) : 0;
    } else if (row.price.trim() !== "") {
      // An empty price is R0: "Message on the cake" costs nothing extra.
      const r = parseMoney(row.price);
      if (r.ok) priceCents = r.value;
      else e.price = r.error;
    }

    let textMax = EXTRA_TEXT_DEFAULT;
    if (row.asksForWording && row.textMax.trim() !== "") {
      const max = Number(row.textMax.trim());
      if (!Number.isInteger(max) || max < 1 || max > EXTRA_TEXT_MAX) e.textMax = `Choose a length from 1 to ${EXTRA_TEXT_MAX} characters, or leave it empty for ${EXTRA_TEXT_DEFAULT}.`;
      else textMax = max;
    }

    if (e.name || e.price || e.textMax || e.prices) errors.rows[row.key] = e;
    else {
      extras.push({
        id: UUID.test(row.id) ? row.id : null,
        name,
        priceCents,
        asksForWording: row.asksForWording,
        textMax,
        shared: row.shared,
        priceByVariation: byVariation,
        prices,
        changed: row.edited !== false,
      });
    }
  }
  if (Object.keys(errors.rows).length > 0) return { ok: false, errors };
  return { ok: true, extras };
}

/** What save_product takes for the extras. */
export function extrasPayload(extras: readonly ParsedExtra[]) {
  return extras.map((x) => ({
    ...(x.id ? { id: x.id } : {}),
    name: x.name,
    price_cents: x.priceCents,
    asks_for_wording: x.asksForWording,
    text_max: x.textMax,
    shared: x.shared,
    changed: x.changed,
    price_by_variation: x.priceByVariation,
    ...(x.priceByVariation ? { prices: x.prices.map((p) => ({ variation_index: p.variationIndex, price_cents: p.priceCents })) } : {}),
  }));
}

/** The price an extra adds on an item with this variation: its own price, or the one for that variation. */
export function extraAmount(extra: Pick<ExtraSummary, "priceCents" | "priceByVariation" | "prices">, variationId: string): Cents {
  if (extra.priceByVariation && variationId !== "" && extra.prices[variationId] !== undefined) return extra.prices[variationId];
  return extra.priceCents;
}

/** "Used on 3 products" (or "Used on 1 other product"), for a shared extra on a product that has it. */
export function usedOnWords(usedOn: number): string | null {
  const others = usedOn - 1;
  if (others < 1) return null;
  return `Also on ${others} other ${others === 1 ? "product" : "products"}. Changing it changes it there too.`;
}
