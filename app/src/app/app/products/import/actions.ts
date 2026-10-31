"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation } from "@/lib/auth/dal";
import { IMPORT_MAX_ROWS, nameKey } from "@/lib/import/products";
import { MAX_CENTS } from "@/lib/money";
import { PRODUCT_DESCRIPTION_MAX, PRODUCT_UNIT_MAX, validateProductName, type ProductKind } from "@/lib/products";
import { getProducts } from "@/lib/products/data";
import { forOrganisation } from "@/lib/scope";
import { createClient } from "@/lib/supabase/server";

/** One product to add, as the preview sends it. Everything is checked again here: the browser is not trusted. */
export type ImportItem = { kind: ProductKind; name: string; priceCents: number; unit: string | null; description: string | null };

export type ImportResult =
  | { status: "done"; added: number; skipped: number; failed: string[] }
  | { status: "error"; message: string };

const GENERIC = "Something went wrong adding those. Please try again.";
/** How many are saved at the same time: a list of 200 does not wait on 200 trips one after another. */
const AT_A_TIME = 10;

/**
 * Adds the products of an imported list (docs/plans/import-onboarding.md). Each goes through `save_product_layers`
 * under the person's own access, like a product added by hand, so nothing here can write what the form could not.
 * A name the business already has, or that repeats in the list, is skipped (never updated: a price set by hand stays).
 */
export async function importProducts(items: ImportItem[]): Promise<ImportResult> {
  const { organisation } = await requireOrganisation();
  if (!Array.isArray(items) || items.length === 0) return { status: "error", message: "There is nothing to add. Tick at least one row." };
  if (items.length > IMPORT_MAX_ROWS) return { status: "error", message: `Add up to ${IMPORT_MAX_ROWS} at a time. Split the list and import it in parts.` };

  const existing = new Set(forOrganisation(await getProducts(), organisation.id).map((p) => nameKey(p.name)));
  const clean: ImportItem[] = [];
  let skipped = 0;
  for (const item of items) {
    const name = validateProductName(item?.name);
    const priceOk = Number.isInteger(item?.priceCents) && item.priceCents >= 0 && item.priceCents <= MAX_CENTS;
    const kindOk = item?.kind === "product" || item?.kind === "service";
    const unit = typeof item?.unit === "string" && item.unit.trim() !== "" ? item.unit.trim() : null;
    const description = typeof item?.description === "string" && item.description.trim() !== "" ? item.description.trim() : null;
    if (!name.ok || !priceOk || !kindOk || (unit !== null && unit.length > PRODUCT_UNIT_MAX) || (description !== null && description.length > PRODUCT_DESCRIPTION_MAX)) {
      return { status: "error", message: "Some of those rows could not be read. Go back to the check and try again." };
    }
    const key = nameKey(name.value);
    if (existing.has(key)) {
      skipped++;
      continue;
    }
    existing.add(key);
    clean.push({ kind: item.kind, name: name.value, priceCents: item.priceCents, unit, description });
  }

  const supabase = await createClient();
  const failed: string[] = [];
  let added = 0;
  for (let i = 0; i < clean.length; i += AT_A_TIME) {
    const results = await Promise.all(
      clean.slice(i, i + AT_A_TIME).map(async (p) => {
        const { error } = await supabase.rpc("save_product_layers", {
          p_org: organisation.id,
          p_product_id: null,
          p_product: { kind: p.kind, name: p.name, description: p.description ?? "", unit_price_cents: p.priceCents, unit: p.unit ?? "", variation_label: "" },
          p_variations: [],
        });
        if (error) console.error("could not import a product:", error.code, error.message);
        return error ? p.name : null;
      }),
    );
    for (const r of results) {
      if (r === null) added++;
      else failed.push(r);
    }
  }
  revalidatePath("/app/products");
  if (added === 0 && failed.length > 0) return { status: "error", message: GENERIC };
  return { status: "done", added, skipped, failed };
}
