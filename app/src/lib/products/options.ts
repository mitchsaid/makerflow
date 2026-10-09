import { parseMoney, type Cents } from "../money";

/**
 * Options and extras (docs/plans/product-choices.md): things that specify or add to the chosen product.
 * "Choose one" (Flavour), "choose any" (Extras) or "type something" (Message on the cake). Each value adds an
 * amount (often R0) to each item. A charge for the whole order (a setup fee, a box) is its own item on the
 * quote. "Choose one" always needs a choice; an optional one has a choice like "None".
 */

export const OPTION_NAME_MAX = 80;
export const OPTIONS_MAX = 20;
export const OPTION_VALUES_MAX = 50;
export const OPTION_TEXT_MAX = 500;
export const OPTION_TEXT_DEFAULT = 100;

export type OptionKind = "one" | "any" | "text";

/** `prices`: by variation id, when the option's price depends on the variation (else empty). */
export type OptionValue = { id: string; name: string; priceCents: Cents; usual: boolean; prices: Record<string, Cents> };
export type OptionGroup = {
  id: string;
  name: string;
  kind: OptionKind;
  /** Always true for "choose one", never for "choose any"; the maker decides for "type something". */
  required: boolean;
  /** "Type something": what it costs when something is typed, and how long it can be. */
  textPriceCents: Cents;
  textMax: number;
  /** Each value has a price for each of the product's variations ("Gold leaf: Small +R50, Large +R120"). */
  priceByVariation: boolean;
  values: OptionValue[];
};

/** One option on the form while it is being filled in. Ids are "" for new ones. */
/** `prices`: by the variation row's key, when the option's price depends on the variation. */
export type OptionValueFormRow = { key: string; id: string; name: string; price: string; usual: boolean; prices?: Record<string, string> };
export type OptionGroupFormRow = {
  key: string;
  id: string;
  name: string;
  kind: OptionKind;
  required: boolean;
  textPrice: string;
  textMax: string;
  priceByVariation?: boolean;
  values: OptionValueFormRow[];
};

export type ParsedOptionGroup = Omit<OptionGroup, "id" | "values"> & {
  id: string | null;
  values: { id: string | null; name: string; priceCents: Cents; usual: boolean; prices: { variationIndex: number; priceCents: Cents }[] }[];
};

export type OptionGroupErrors = {
  name?: string;
  textPrice?: string;
  textMax?: string;
  /** About the values as a whole ("add at least one"). */
  values?: string;
  rows: Record<string, { name?: string; price?: string; prices?: Record<string, string> }>;
};
export type OptionErrors = { list?: string; groups: Record<string, OptionGroupErrors> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS: readonly unknown[] = ["one", "any", "text"];

export const OPTION_KIND_WORDS: Record<OptionKind, { title: string; hint: string }> = {
  one: { title: "Choose one", hint: "Like a flavour: one is chosen." },
  any: { title: "Choose any", hint: "Like extras: none, one or several." },
  text: { title: "Type something", hint: "Like a message on the cake." },
};

function isValueRow(value: unknown): value is OptionValueFormRow {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const pricesOk =
    v.prices === undefined ||
    (typeof v.prices === "object" && v.prices !== null && !Array.isArray(v.prices) && Object.values(v.prices).every((p) => typeof p === "string"));
  return typeof v.key === "string" && typeof v.id === "string" && typeof v.name === "string" && typeof v.price === "string" && typeof v.usual === "boolean" && pricesOk;
}

function isGroupRow(value: unknown): value is OptionGroupFormRow {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.key === "string" &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    KINDS.includes(v.kind) &&
    typeof v.required === "boolean" &&
    typeof v.textPrice === "string" &&
    typeof v.textMax === "string" &&
    (v.priceByVariation === undefined || typeof v.priceByVariation === "boolean") &&
    Array.isArray(v.values) &&
    v.values.length <= OPTION_VALUES_MAX &&
    v.values.every(isValueRow)
  );
}

const tidy = (text: string) => text.trim().replace(/\s+/g, " ");

/**
 * Checks the options, saying how to fix each problem where it is. `variationKeys` are the product's variation
 * rows in order (a price by variation is stored by the variation's place in that list).
 */
export function parseOptionGroups(
  input: unknown,
  variationKeys: readonly string[] = [],
): { ok: true; groups: ParsedOptionGroup[] } | { ok: false; errors: OptionErrors } {
  const errors: OptionErrors = { groups: {} };
  if (!Array.isArray(input)) return { ok: false, errors: { ...errors, list: "The options could not be read. Open the product again." } };
  if (input.length > OPTIONS_MAX) return { ok: false, errors: { ...errors, list: `A product can have up to ${OPTIONS_MAX} options.` } };
  if (!input.every(isGroupRow)) return { ok: false, errors: { ...errors, list: "The options could not be read. Open the product again." } };

  const groups: ParsedOptionGroup[] = [];
  const groupNames = new Set<string>();
  for (const row of input) {
    const e: OptionGroupErrors = { rows: {} };
    const name = tidy(row.name);
    if (name === "") e.name = "Give it a name, like “Flavour” or “Extras”.";
    else if (name.length > OPTION_NAME_MAX) e.name = `Keep the name to ${OPTION_NAME_MAX} characters or fewer.`;
    else if (groupNames.has(name.toLowerCase())) e.name = "Two options have this name. Give each its own.";
    groupNames.add(name.toLowerCase());

    let textPriceCents: Cents = 0;
    let textMax = OPTION_TEXT_DEFAULT;
    const values: ParsedOptionGroup["values"] = [];
    if (row.kind === "text") {
      if (row.textPrice.trim() !== "") {
        const price = parseMoney(row.textPrice);
        if (price.ok) textPriceCents = price.value;
        else e.textPrice = price.error;
      }
      const max = Number(row.textMax.trim() === "" ? OPTION_TEXT_DEFAULT : row.textMax.trim());
      if (!Number.isInteger(max) || max < 1 || max > OPTION_TEXT_MAX) e.textMax = `Choose a length from 1 to ${OPTION_TEXT_MAX} characters.`;
      else textMax = max;
    } else {
      if (row.values.length === 0) e.values = "Add at least one choice.";
      // Prices by variation only make sense when there are variations to price by.
      const byVariation = row.priceByVariation === true && variationKeys.length > 0;
      const valueNames = new Set<string>();
      let usualTaken = false;
      for (const v of row.values) {
        const ve: { name?: string; price?: string } = {};
        const vName = tidy(v.name);
        if (vName === "") ve.name = "Give it a name, like “Vanilla”.";
        else if (vName.length > OPTION_NAME_MAX) ve.name = `Keep the name to ${OPTION_NAME_MAX} characters or fewer.`;
        else if (valueNames.has(vName.toLowerCase())) ve.name = "Two have this name. Give each its own.";
        valueNames.add(vName.toLowerCase());
        // An empty amount is R0: most choices cost nothing extra.
        const amount = (text: string) => (text.trim() === "" ? ({ ok: true, value: 0 } as const) : parseMoney(text));
        const prices: { variationIndex: number; priceCents: Cents }[] = [];
        const priceErrors: Record<string, string> = {};
        let price: ReturnType<typeof amount>;
        if (byVariation) {
          variationKeys.forEach((vk, index) => {
            const text = v.prices?.[vk] ?? "";
            // Left empty, a size would quietly cost nothing: say so (0 is fine when typed).
            if (text.trim() === "") {
              priceErrors[vk] = "Enter what it adds for this one. Use 0 if nothing.";
              return;
            }
            const r = parseMoney(text);
            if (r.ok) prices.push({ variationIndex: index, priceCents: r.value });
            else priceErrors[vk] = r.error;
          });
          // The value's own price is the lowest of its prices (its "from").
          price = { ok: true, value: prices.length > 0 ? Math.min(...prices.map((p) => p.priceCents)) : 0 };
        } else {
          price = amount(v.price);
          if (!price.ok) ve.price = price.error;
        }
        if (Object.keys(priceErrors).length > 0) (ve as { prices?: Record<string, string> }).prices = priceErrors;
        if (ve.name || ve.price || Object.keys(priceErrors).length > 0) e.rows[v.key] = ve;
        else if (price.ok) {
          const usual = row.kind === "one" && v.usual && !usualTaken;
          if (usual) usualTaken = true;
          values.push({ id: UUID.test(v.id) ? v.id : null, name: vName, priceCents: price.value, usual, prices });
        }
      }
    }

    if (e.name || e.textPrice || e.textMax || e.values || Object.keys(e.rows).length > 0) errors.groups[row.key] = e;
    else {
      groups.push({
        id: UUID.test(row.id) ? row.id : null,
        name,
        kind: row.kind,
        // "Choose one" always needs a choice; "choose any" can always be left empty.
        required: row.kind === "one" ? true : row.kind === "any" ? false : row.required,
        textPriceCents,
        textMax,
        priceByVariation: row.kind !== "text" && row.priceByVariation === true && variationKeys.length > 0,
        values,
      });
    }
  }
  if (errors.list || Object.keys(errors.groups).length > 0) return { ok: false, errors };
  return { ok: true, groups };
}

/** What save_product takes for the options. */
export function optionsPayload(groups: readonly ParsedOptionGroup[]) {
  return groups.map((g) => ({
    ...(g.id ? { id: g.id } : {}),
    name: g.name,
    kind: g.kind,
    required: g.required,
    text_price_cents: g.kind === "text" ? g.textPriceCents : 0,
    text_max: g.textMax,
    price_by_variation: g.priceByVariation,
    values: g.values.map((v) => ({
      ...(v.id ? { id: v.id } : {}),
      name: v.name,
      price_cents: v.priceCents,
      usual: v.usual,
      ...(g.priceByVariation ? { prices: v.prices.map((p) => ({ variation_index: p.variationIndex, price_cents: p.priceCents })) } : {}),
    })),
  }));
}
