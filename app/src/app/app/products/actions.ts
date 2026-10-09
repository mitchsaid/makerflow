"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganisation } from "@/lib/auth/dal";
import {
  parseProductForm,
  type ProductFieldErrors,
  type ProductFields,
  type ProductSummary,
} from "@/lib/products";
import { findProduct } from "@/lib/products/data";
import { optionsPayload } from "@/lib/products/options";
import { createClient } from "@/lib/supabase/server";

export type ProductSaveState =
  | { status: "idle" }
  | { status: "saved"; product: ProductSummary }
  /** Added from inside a quote: nothing is redirected, the quote keeps what was typed. */
  | { status: "created"; product: ProductSummary }
  | { status: "error"; message?: string; errors?: ProductFieldErrors };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC_ERROR = "Something went wrong saving that. Please try again.";

/** What save_product takes: the product, and its variations when the form carried them (null leaves them alone). */
function toPayload(p: ProductFields) {
  return {
    product: {
      kind: p.kind,
      name: p.name,
      description: p.description ?? "",
      unit_price_cents: p.unitPriceCents,
      unit: p.unit ?? "",
      variation_label: p.variationLabel ?? "",
      // Only when the form carried a photo field: otherwise the saved photo is left alone.
      ...(p.photoImageId === undefined ? {} : { photo_image_id: p.photoImageId ?? "" }),
      // Only when the form carried a VAT choice (a VAT-registered business): otherwise it is left alone.
      ...(p.vatStatus === undefined ? {} : { vat_status: p.vatStatus }),
    },
    options: p.options === undefined ? null : optionsPayload(p.options),
    variations:
      p.variations === undefined
        ? null
        : p.variations.map((v) => ({ ...(v.id ? { id: v.id } : {}), name: v.name, price_cents: v.priceCents, usual: v.usual })),
  };
}

/**
 * Saves a product and its variations in one go (save_product, under the person's own access), then reads
 * it back: the result carries the ids of new variations, and whatever the form left alone.
 */
async function saveProduct(
  id: string | null,
  formData: FormData,
): Promise<{ ok: true; product: ProductSummary } | { ok: false; state: ProductSaveState }> {
  const { organisation } = await requireOrganisation();
  const parsed = parseProductForm(formData);
  if (!parsed.ok) return { ok: false, state: { status: "error", errors: parsed.errors } };

  const payload = toPayload(parsed.value);
  const supabase = await createClient();
  const { data: savedId, error } = await supabase.rpc("save_product", {
    p_org: organisation.id,
    p_product_id: id,
    p_product: payload.product,
    p_variations: payload.variations,
    p_options: payload.options,
  });
  if (error?.code === "23503") {
    return { ok: false, state: { status: "error", errors: { photo: "That photo could not be used. Choose it again." } } };
  }
  if (error?.code === "P0002") {
    return { ok: false, state: { status: "error", message: "This product could not be found. Go back to your products and open it again." } };
  }
  if (error || typeof savedId !== "string") {
    console.error("could not save product:", error?.code, error?.message);
    return { ok: false, state: { status: "error", message: GENERIC_ERROR } };
  }

  revalidatePath("/app/products");
  const product = await findProduct(savedId);
  if (!product || product.organisationId !== organisation.id) {
    return { ok: false, state: { status: "error", message: GENERIC_ERROR } };
  }
  return { ok: true, product };
}

/** Adds a product from the Products screen, then shows the list. Any member can. */
export async function createProduct(
  _previous: ProductSaveState,
  formData: FormData,
): Promise<ProductSaveState> {
  const result = await saveProduct(null, formData);
  if (!result.ok) return result.state;
  const view = result.product.kind === "service" ? "&view=services" : "";
  redirect(`/app/products?added=${result.product.id}${view}`);
}

/** Adds a product from inside a quote and hands it back, so it can go straight onto a line. */
export async function createProductInQuote(
  _previous: ProductSaveState,
  formData: FormData,
): Promise<ProductSaveState> {
  const result = await saveProduct(null, formData);
  return result.ok ? { status: "created", product: result.product } : result.state;
}

/** Saves changes to a product. Quote lines keep their own copy, so they do not change. */
export async function updateProduct(
  id: string,
  _previous: ProductSaveState,
  formData: FormData,
): Promise<ProductSaveState> {
  if (!UUID.test(id)) return { status: "error", message: GENERIC_ERROR };
  const result = await saveProduct(id, formData);
  return result.ok ? { status: "saved", product: result.product } : result.state;
}

export type ProductArchiveState = { status: "idle" } | { status: "error"; message: string };

/** Archives or restores a product. Products are never deleted: quote lines refer to them. */
export async function setProductArchived(
  id: string,
  archived: boolean,
  kind: "product" | "service" = "product",
): Promise<ProductArchiveState> {
  const { organisation } = await requireOrganisation();
  if (!UUID.test(id)) redirect("/app/products");

  const supabase = await createClient();
  const { data: saved, error } = await supabase
    .from("products")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("organisation_id", organisation.id)
    .select("id");
  if (error || !saved || saved.length !== 1) {
    console.error("could not archive or restore product:", error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  revalidatePath("/app/products");
  if (archived) redirect(kind === "service" ? "/app/products?view=services" : "/app/products");
  return { status: "idle" };
}
