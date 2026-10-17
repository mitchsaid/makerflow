import { moneyToInput, percentToInput, quantityToInput, type NumberStyle, type VatStatus } from "@/lib/money";
import type { ProductKind, ProductSummary } from "@/lib/products";
import type { VariationFormRow } from "@/lib/products/variations";
import { EXTRA_TEXT_DEFAULT, type ExtraFormRow } from "@/lib/products/extras";
import type { OptionGroupFormRow } from "@/lib/products/options";
import type { PriceBreakFormRow } from "@/lib/products/price-breaks";
import type { StepFormRow } from "@/lib/products/steps";

/** What the product form holds while it is being filled in (plain module: pages use it too). */
export type ProductFormValues = {
  kind: ProductKind;
  name: string;
  unitPrice: string;
  /** "dozen", "kg": optional. */
  unit: string;
  description: string;
  /** The photo's id (an uploaded picture), or "". Products only. */
  photoImageId: string;
  /** How VAT treats it. Only shown, and sent, for a VAT-registered business. */
  vatStatus: VatStatus;
  /** The maker's word for the variations ("Size"), and the rows. No rows: one price. */
  variationLabel: string;
  variations: VariationFormRow[];
  /** The lists you pick one from (flavour), as the form holds them. */
  options: OptionGroupFormRow[];
  /** Extras, as the form holds them. */
  extras: ExtraFormRow[];
  /** Quantity prices, as the form holds them. */
  priceBreaks: PriceBreakFormRow[];
  /** The steps it is made in, as the form holds them. */
  steps: StepFormRow[];
};

export const EMPTY_PRODUCT: ProductFormValues = {
  kind: "product",
  name: "",
  unitPrice: "",
  unit: "",
  description: "",
  photoImageId: "",
  vatStatus: "standard",
  variationLabel: "",
  variations: [],
  options: [],
  extras: [],
  priceBreaks: [],
  steps: [],
};

export function emptyOfKind(kind: ProductKind): ProductFormValues {
  return { ...EMPTY_PRODUCT, kind };
}

/** Words that differ between a product and a service. */
export const KIND_WORDS: Record<ProductKind, { one: string; many: string; Title: string }> = {
  product: { one: "product", many: "products", Title: "Product" },
  service: { one: "service", many: "services", Title: "Service" },
};

/** The list a kind lives in: /app/products shows products, /app/products?view=services services. */
export function listHref(kind: ProductKind): string {
  return kind === "service" ? "/app/products?view=services" : "/app/products";
}

export function valuesFromProduct(p: ProductSummary, style: NumberStyle): ProductFormValues {
  const groupOfValue = new Map(p.options.flatMap((g) => g.values.map((x) => [x.id, g.id] as const)));
  return {
    kind: p.kind,
    name: p.name,
    unitPrice: moneyToInput(p.unitPriceCents, style),
    unit: p.unit ?? "",
    description: p.description ?? "",
    photoImageId: p.photoImageId ?? "",
    vatStatus: p.vatStatus ?? "standard",
    variationLabel: p.variationLabel ?? "",
    variations: p.variations.map((x) => ({ key: x.id, id: x.id, name: x.name, price: moneyToInput(x.priceCents, style), usual: x.usual, imageId: x.imageId ?? "" })),
    options: p.options.map((g) => ({
      key: g.id,
      id: g.id,
      name: g.name,
      kind: "one" as const,
      priceByVariation: g.priceByVariation,
      values: g.values.map((x) => ({
        key: x.id,
        id: x.id,
        name: x.name,
        price: x.priceCents > 0 ? moneyToInput(x.priceCents, style) : "",
        usual: x.usual,
        imageId: x.imageId ?? "",
        // By the variation's row key (a saved variation's key is its id). A zero is kept as "0": left empty, a
        // size asks what it adds.
        prices: Object.fromEntries(Object.entries(x.prices).map(([vid, cents]) => [vid, moneyToInput(cents, style)])),
      })),
    })),
    priceBreaks: p.priceBreaks.map((b, i) => ({ key: `saved-${i}`, from: quantityToInput(b.fromMilli, style), percent: percentToInput(b.percentBp, style) })),
    steps: p.steps.map((s, i) => ({
      key: `saved-step-${i}`,
      name: s.name,
      logic: s.logic,
      conditions: s.conditions.map((c, ci) => ({
        key: `saved-step-${i}-c${ci}`,
        kind: c.kind,
        negate: c.negate,
        // A saved row's key is its id, so a condition points at it by id.
        ref:
          c.kind !== "chosen"
            ? ""
            : c.variationId
              ? `variation:${c.variationId}`
              : c.optionValueId
                ? `value:${groupOfValue.get(c.optionValueId) ?? ""}/${c.optionValueId}`
                : c.extraId
                  ? `extra:${c.extraId}`
                  : "",
        quantity: c.kind === "quantity" ? quantityToInput(c.quantityMilli, style) : "",
      })),
    })),
    extras: p.extras.map((x) => ({
      key: x.id,
      id: x.id,
      name: x.name,
      price: x.priceCents > 0 ? moneyToInput(x.priceCents, style) : "",
      asksForWording: x.asksForWording,
      // The usual length shows as empty: the field is only for when it matters.
      textMax: x.textMax === EXTRA_TEXT_DEFAULT ? "" : String(x.textMax),
      shared: x.shared,
      usedOn: x.usedOn,
      edited: false,
      priceByVariation: x.priceByVariation,
      prices: Object.fromEntries(Object.entries(x.prices).map(([vid, cents]) => [vid, moneyToInput(cents, style)])),
    })),
  };
}

/** Where "Add product" / "Add service" goes. */
export function newHref(kind: ProductKind): string {
  return kind === "service" ? "/app/products/new?kind=service" : "/app/products/new";
}
