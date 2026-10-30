import { optionalMultiline, optionalText } from "../form-values";
import { isImageId } from "../images";
import { parseMoney, type Cents, type VatStatus } from "../money";
import type { ValidationResult } from "../validation";
import { parseExtras, type ExtraErrors, type ExtraSummary, type ParsedExtra } from "./extras";
import { parseOptionGroups, type OptionErrors, type OptionGroup, type ParsedOptionGroup } from "./options";
import { parseCosts, parseExtraCosts, type CostErrors, type CostLineSummary, type ExtraCostsErrors, type ParsedCosts, type ParsedExtraCosts } from "./costs";
import type { UnitCode } from "../materials/units";
import { parseSteps, type ParsedStep, type StepChoices, type StepErrors, type StepSummary } from "./steps";
import { parsePriceBreaks, type ParsedPriceBreak, type PriceBreak, type PriceBreakErrors } from "./price-breaks";
import { parseVariations, type ParsedVariation, type ProductVariation, type VariationErrors } from "./variations";

/**
 * Products, first layer: what a business sells, with a name, a price, an optional
 * description and whether it is a product or a service. Later layers (variations and extras,
 * costs, quantity prices, production steps, stock, photos) are designed with the founder; see
 * docs/plans/products.md.
 */

export const PRODUCT_NAME_MAX = 200;
export const PRODUCT_DESCRIPTION_MAX = 1000;
export const PRODUCT_UNIT_MAX = 20;

export type ProductKind = "product" | "service";

export type ProductFields = {
  kind: ProductKind;
  name: string;
  description: string | null;
  /** In the business's VAT entry mode, like a quote line's price. */
  unitPriceCents: Cents;
  /** What one is: "dozen", "kg", "hour". Fills a quote line's unit. Null for a plain count. */
  unit: string | null;
  /**
   * The photo (an id from lib/images), or null for none. Undefined when the form that saved the
   * product did not carry one (an older app): the photo is left as it is.
   */
  photoImageId?: string | null;
  /**
   * How VAT treats it: a quote item made from it starts with this. Undefined when the form that saved the
   * product did not carry one (a business that is not VAT registered never sees the choice): it is left as it is.
   */
  vatStatus?: VatStatus;
  /**
   * The variations and the maker's word for them. Undefined when the form that saved the product did not
   * carry them (an older app): they are left as they are. With variations, the product's own price is
   * the lowest of theirs.
   */
  variationLabel?: string | null;
  variations?: ParsedVariation[];
  /** The lists you pick one from (flavour). Undefined when the form did not carry them: they are left as they are. */
  options?: ParsedOptionGroup[];
  /** Extras. Undefined when the form did not carry them: they are left as they are. */
  extras?: ParsedExtra[];
  /** Quantity prices, in order of quantity. Undefined when the form did not carry them: they are left as they are. */
  priceBreaks?: ParsedPriceBreak[];
  /** The steps it is made in, in order. Undefined when the form did not carry them: they are left as they are. */
  steps?: ParsedStep[];
  /** What it costs to make: the lines and how many a batch makes. Undefined when the form did not carry them: they are left as they are. */
  costs?: ParsedCosts;
  /** The cost lines of the extras the maker changed, each by the extra's place among the product's extras. Undefined when the form carried none. */
  extraCosts?: ParsedExtraCosts;
};

export type Product = ProductFields & { id: string; organisationId: string; archived: boolean };

export type ProductFieldName = "kind" | "name" | "description" | "unitPrice" | "unit" | "photo" | "vatStatus";
export type ProductFieldErrors = Partial<Record<ProductFieldName, string>> & {
  /** Problems with the variations: their name, the list, and each row by its key. */
  variations?: VariationErrors;
  /** Problems with the lists, by list and choice. */
  options?: OptionErrors;
  /** Problems with the extras, by extra. */
  extras?: ExtraErrors;
  /** Problems with the quantity prices, by row. */
  priceBreaks?: PriceBreakErrors;
  /** Problems with the steps, by row. */
  steps?: StepErrors;
  /** Problems with the cost lines and the batch size. */
  costs?: CostErrors;
  /** Problems with the extras' own cost lines. */
  extraCosts?: ExtraCostsErrors;
};

export type ParsedProductForm =
  | { ok: true; value: ProductFields }
  | { ok: false; errors: ProductFieldErrors };

export function validateProductName(input: unknown): ValidationResult<string> {
  const text = typeof input === "string" ? input : "";
  const r = optionalText(text, PRODUCT_NAME_MAX, "Names");
  if (!r.ok) return r;
  if (r.value === null) return { ok: false, error: "Give it a name, like “Wedding cake” or “Design time”." };
  return { ok: true, value: r.value };
}

function readJson(raw: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(typeof raw === "string" ? raw : "");
  } catch {
    return null;
  }
}

const keyOf = (row: unknown): string[] =>
  typeof row === "object" && row !== null && typeof (row as { key?: unknown }).key === "string" ? [(row as { key: string }).key] : [];

/** The keys of the rows in a JSON list of rows, in order. */
function keysOf(raw: FormDataEntryValue | null): string[] {
  const rows = readJson(raw);
  return Array.isArray(rows) ? rows.flatMap(keyOf) : [];
}

/** The keys of the variations, lists and extras on the form, in the order they are sent: what a step's conditions point at. */
function stepChoicesOf(variations: FormDataEntryValue | null, options: FormDataEntryValue | null, extras: FormDataEntryValue | null): StepChoices {
  const list = (raw: FormDataEntryValue | null): unknown[] => {
    const rows = readJson(raw);
    return Array.isArray(rows) ? rows : [];
  };
  return {
    variations: list(variations).flatMap(keyOf),
    lists: list(options).map((g) => ({
      key: keyOf(g)[0] ?? "",
      values: Array.isArray((g as { values?: unknown }).values) ? ((g as { values: unknown[] }).values).flatMap(keyOf) : [],
    })),
    extras: list(extras).flatMap(keyOf),
  };
}

/** Turns the product form into validated values. */
export function parseProductForm(
  form: FormData,
  /** The units of the business's materials, by id: a cost line's unit must measure the same kind of thing. Needed only when the form carries cost lines. */
  materialUnits: ReadonlyMap<string, UnitCode> = new Map(),
): ParsedProductForm {
  const errors: ProductFieldErrors = {};

  const kindRaw = form.get("kind");
  const kind: ProductKind | null = kindRaw === "service" ? "service" : kindRaw === "product" || kindRaw === null ? "product" : null;
  if (kind === null) errors.kind = "Choose product or service.";

  const name = validateProductName(form.get("name"));
  if (!name.ok) errors.name = name.error;

  const description = optionalMultiline(form.get("description"), PRODUCT_DESCRIPTION_MAX, "The description");
  if (!description.ok) errors.description = description.error;

  const unit = optionalText(form.get("unit"), PRODUCT_UNIT_MAX, "The unit");
  if (!unit.ok) errors.unit = unit.error;

  // The photo is attached by its id (the picture was uploaded when it was chosen). Services have none.
  let photoImageId: string | null | undefined;
  const photoRaw = form.get("photoImageId");
  if (photoRaw !== null) {
    const text = typeof photoRaw === "string" ? photoRaw.trim() : "";
    if (text === "" || kind === "service") photoImageId = null;
    else if (isImageId(text)) photoImageId = text;
    else errors.photo = "That photo could not be used. Choose it again.";
  }

  // VAT treatment: only a VAT-registered business's form carries it.
  let vatStatus: VatStatus | undefined;
  const vatRaw = form.get("vatStatus");
  if (vatRaw !== null) {
    // The picker's first entry (standard-rated) is an empty value.
    if (vatRaw === "" || vatRaw === "standard") vatStatus = "standard";
    else if (vatRaw === "zero" || vatRaw === "exempt") vatStatus = vatRaw;
    else errors.vatStatus = "Choose how VAT applies to this.";
  }

  // Variations: only when the form carried them (a JSON list in one field).
  let variationLabel: string | null | undefined;
  let variations: ParsedVariation[] | undefined;
  const variationsRaw = form.get("variations");
  if (variationsRaw !== null) {
    let rows: unknown = null;
    try {
      rows = JSON.parse(typeof variationsRaw === "string" ? variationsRaw : "");
    } catch {
      rows = null;
    }
    const parsed = parseVariations(form.get("variationLabel"), rows);
    if (parsed.ok) {
      variationLabel = parsed.label;
      variations = parsed.variations;
    } else errors.variations = parsed.errors;
  }
  // Options and extras: the same way, in their own field.
  let options: ParsedOptionGroup[] | undefined;
  const optionsRaw = form.get("options");
  if (optionsRaw !== null) {
    let rows: unknown = null;
    try {
      rows = JSON.parse(typeof optionsRaw === "string" ? optionsRaw : "");
    } catch {
      rows = null;
    }
    // The variation rows as sent, in order: an option priced by variation refers to them by place.
    let variationRows: unknown = [];
    try {
      variationRows = JSON.parse(typeof variationsRaw === "string" ? variationsRaw : "[]");
    } catch {
      variationRows = [];
    }
    const variationKeys = Array.isArray(variationRows)
      ? variationRows.flatMap((r) => (typeof r === "object" && r !== null && typeof (r as { key?: unknown }).key === "string" ? [(r as { key: string }).key] : []))
      : [];
    const variationNames = Array.isArray(variationRows)
      ? variationRows.flatMap((r) => (typeof r === "object" && r !== null && typeof (r as { key?: unknown }).key === "string" ? [String((r as { name?: unknown }).name ?? "")] : []))
      : [];
    const parsed = parseOptionGroups(rows, variationKeys, variationNames);
    if (parsed.ok) options = parsed.groups;
    else errors.options = parsed.errors;
  }

  // Extras: the same way, in their own field. A price by variation refers to the variation rows by place.
  let extras: ParsedExtra[] | undefined;
  const extrasRaw = form.get("extras");
  if (extrasRaw !== null) {
    let rows: unknown = null;
    try {
      rows = JSON.parse(typeof extrasRaw === "string" ? extrasRaw : "");
    } catch {
      rows = null;
    }
    let variationRows: unknown = [];
    try {
      variationRows = JSON.parse(typeof variationsRaw === "string" ? variationsRaw : "[]");
    } catch {
      variationRows = [];
    }
    const variationKeys = Array.isArray(variationRows)
      ? variationRows.flatMap((r) => (typeof r === "object" && r !== null && typeof (r as { key?: unknown }).key === "string" ? [(r as { key: string }).key] : []))
      : [];
    const parsed = parseExtras(rows, variationKeys);
    if (parsed.ok) extras = parsed.extras;
    else errors.extras = parsed.errors;
  }

  // Production steps: the same way, in their own field.
  let steps: ParsedStep[] | undefined;
  const stepsRaw = form.get("steps");
  if (stepsRaw !== null) {
    let rows: unknown = null;
    try {
      rows = JSON.parse(typeof stepsRaw === "string" ? stepsRaw : "");
    } catch {
      rows = null;
    }
    const parsed = parseSteps(rows, stepChoicesOf(variationsRaw, optionsRaw, extrasRaw));
    if (parsed.ok) steps = parsed.steps;
    else errors.steps = parsed.errors;
  }

  // What it costs to make: the same way, in their own field, with how many a batch makes beside them.
  let costs: ParsedCosts | undefined;
  const costLinesRaw = form.get("costLines");
  if (costLinesRaw !== null) {
    const parsed = parseCosts(readJson(costLinesRaw), form.get("makes"), stepChoicesOf(variationsRaw, optionsRaw, extrasRaw), materialUnits);
    if (parsed.ok) costs = parsed.costs;
    else errors.costs = parsed.errors;
  }

  // The extras' own cost lines: only the extras the maker changed are read; each is named by its place among the extras.
  let extraCosts: ParsedExtraCosts | undefined;
  const extraCostsRaw = form.get("extraCosts");
  if (extraCostsRaw !== null) {
    const parsed = parseExtraCosts(readJson(extraCostsRaw), stepChoicesOf(variationsRaw, optionsRaw, extrasRaw).extras, materialUnits);
    if (parsed.ok) extraCosts = parsed.extras;
    else errors.extraCosts = parsed.errors;
  }

  const hasVariations = (variations?.length ?? 0) > 0 || (errors.variations !== undefined && variationsRaw !== null && variationsRaw !== "[]");

  // With variations each has its own price, and the product's is the lowest of theirs.
  const priceRaw = form.get("unitPrice");
  const priceText = typeof priceRaw === "string" ? priceRaw : "";
  const price = hasVariations
    ? ({ ok: true, value: variations && variations.length > 0 ? Math.min(...variations.map((v) => v.priceCents)) : 0 } as const)
    : parseMoney(priceText);
  if (!price.ok) {
    errors.unitPrice = priceText.trim() === "" ? "Enter a price. Use 0 if it is free." : price.error;
  }

  // Quantity prices: the same way, in their own field. They are checked against the prices they come off (an amount
  // must be less than its price), so this comes after the price is known.
  let priceBreaks: ParsedPriceBreak[] | undefined;
  const breaksRaw = form.get("priceBreaks");
  if (breaksRaw !== null) {
    const parsed = parsePriceBreaks(
      readJson(breaksRaw),
      keysOf(variationsRaw),
      { single: price.ok && !hasVariations ? price.value : undefined, variations: variations?.map((v) => v.priceCents) ?? [] },
    );
    if (parsed.ok) priceBreaks = parsed.breaks;
    else errors.priceBreaks = parsed.errors;
  }

  if (Object.keys(errors).length > 0 || kind === null || !name.ok || !description.ok || !unit.ok || !price.ok) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      kind,
      name: name.value,
      description: description.value,
      unitPriceCents: price.value,
      unit: unit.value,
      photoImageId,
      vatStatus,
      ...(variations === undefined ? {} : { variationLabel, variations }),
      ...(options === undefined ? {} : { options }),
      ...(extras === undefined ? {} : { extras }),
      ...(priceBreaks === undefined ? {} : { priceBreaks }),
      ...(steps === undefined ? {} : { steps }),
      ...(costs === undefined ? {} : { costs }),
      ...(extraCosts === undefined ? {} : { extraCosts }),
    },
  };
}

/** A row of the products list: just what the list shows and searches. */
export type ProductSummary = {
  id: string;
  organisationId: string;
  kind: ProductKind;
  name: string;
  description: string | null;
  unitPriceCents: Cents;
  unit: string | null;
  archived: boolean;
  /** The photo's id, or null. Shown small in lists, and on quotes. */
  photoImageId: string | null;
  /** How VAT treats it; a quote item made from it starts with this. */
  vatStatus: VatStatus;
  /** The maker's word for the variations ("Size"), or null when there are none. */
  variationLabel: string | null;
  /** In the maker's order. Empty when the product has a single price. */
  variations: ProductVariation[];
  /** The lists you pick one from (flavour), in the maker's order. */
  options: OptionGroup[];
  /** Extras, in the maker's order. */
  extras: ExtraSummary[];
  /** Quantity prices, for each price in order of quantity (a variation's by its id; null is the product's own). Empty when the price is the same whatever the quantity. */
  priceBreaks: PriceBreak[];
  /** The steps it is made in, in order, with when each applies. Empty when it has none. */
  steps: StepSummary[];
  /** How many one batch makes (thousandths); the cost lines are for a batch. */
  makesMilli: number;
  /** What goes into a batch, in the maker's order. Empty when no costs are entered. */
  costLines: CostLineSummary[];
};

/** Does a list row match what the person typed in the search box? */
export function productMatchesSearch(product: ProductSummary, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  return `${product.name} ${product.description ?? ""}`.toLowerCase().includes(q);
}
