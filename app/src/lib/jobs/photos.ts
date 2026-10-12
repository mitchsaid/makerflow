import type { ProductSummary } from "@/lib/products";
import type { LineFormValues } from "@/lib/quotes";

/**
 * The picture of what was chosen on an item: its variation's, else its first choice's, else the product's own (the
 * same order a quote uses). The form shows it, and the server works it out again from the business's own products
 * when the job is made: a picture sent by the browser is never believed.
 */
export function jobItemPhoto(line: LineFormValues, products: readonly ProductSummary[]): string | null {
  const product = line.productId ? products.find((p) => p.id === line.productId) : undefined;
  if (!product) return null;
  const variation = product.variations.find((v) => v.id === line.variationId);
  if (variation?.imageId) return variation.imageId;
  for (const o of line.options ?? []) {
    if (o.kind !== "one") continue;
    const value = product.options.find((g) => g.id === o.groupId)?.values.find((v) => v.id === o.valueId);
    if (value?.imageId) return value.imageId;
  }
  return product.photoImageId ?? null;
}
