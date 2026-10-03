import { moneyToInput, type NumberStyle } from "@/lib/money";
import type { Product, ProductKind } from "@/lib/products";

/** What the product form holds while it is being filled in (plain module: pages use it too). */
export type ProductFormValues = {
  kind: ProductKind;
  name: string;
  unitPrice: string;
  description: string;
};

export const EMPTY_PRODUCT: ProductFormValues = { kind: "product", name: "", unitPrice: "", description: "" };

export function valuesFromProduct(p: Product, style: NumberStyle): ProductFormValues {
  return {
    kind: p.kind,
    name: p.name,
    unitPrice: moneyToInput(p.unitPriceCents, style),
    description: p.description ?? "",
  };
}
