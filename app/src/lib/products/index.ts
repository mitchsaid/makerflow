import { optionalMultiline, optionalText } from "../form-values";
import { isImageId } from "../images";
import { parseMoney, type Cents } from "../money";
import type { ValidationResult } from "../validation";

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
};

export type Product = ProductFields & { id: string; organisationId: string; archived: boolean };

export type ProductFieldName = "kind" | "name" | "description" | "unitPrice" | "unit" | "photo";
export type ProductFieldErrors = Partial<Record<ProductFieldName, string>>;

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

/** Turns the product form into validated values. */
export function parseProductForm(form: FormData): ParsedProductForm {
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

  const priceRaw = form.get("unitPrice");
  const priceText = typeof priceRaw === "string" ? priceRaw : "";
  const price = parseMoney(priceText);
  if (!price.ok) {
    errors.unitPrice = priceText.trim() === "" ? "Enter a price. Use 0 if it is free." : price.error;
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
};

/** Does a list row match what the person typed in the search box? */
export function productMatchesSearch(product: ProductSummary, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  return `${product.name} ${product.description ?? ""}`.toLowerCase().includes(q);
}
