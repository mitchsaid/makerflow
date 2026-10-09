import { moneyToInput, type NumberStyle, type VatStatus } from "@/lib/money";
import type { ProductKind, ProductSummary } from "@/lib/products";
import type { VariationFormRow } from "@/lib/products/variations";

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
  return {
    kind: p.kind,
    name: p.name,
    unitPrice: moneyToInput(p.unitPriceCents, style),
    unit: p.unit ?? "",
    description: p.description ?? "",
    photoImageId: p.photoImageId ?? "",
    vatStatus: p.vatStatus ?? "standard",
    variationLabel: p.variationLabel ?? "",
    variations: p.variations.map((x) => ({ key: x.id, id: x.id, name: x.name, price: moneyToInput(x.priceCents, style), usual: x.usual })),
  };
}

/** Where "Add product" / "Add service" goes. */
export function newHref(kind: ProductKind): string {
  return kind === "service" ? "/app/products/new?kind=service" : "/app/products/new";
}
