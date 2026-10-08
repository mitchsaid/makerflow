"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganisation } from "@/lib/auth/dal";
import type { VatStatus } from "@/lib/money";
import {
  parseProductForm,
  type ProductFieldErrors,
  type ProductFields,
  type ProductSummary,
} from "@/lib/products";
import { createClient } from "@/lib/supabase/server";

export type ProductSaveState =
  | { status: "idle" }
  | { status: "saved"; product: ProductSummary }
  /** Added from inside a quote: nothing is redirected, the quote keeps what was typed. */
  | { status: "created"; product: ProductSummary }
  | { status: "error"; message?: string; errors?: ProductFieldErrors };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC_ERROR = "Something went wrong saving that. Please try again.";

function toRow(p: ProductFields) {
  return {
    kind: p.kind,
    name: p.name,
    description: p.description,
    unit_price_cents: p.unitPriceCents,
    unit: p.unit,
    // Only when the form carried a photo field: otherwise the saved photo is left alone.
    ...(p.photoImageId === undefined ? {} : { photo_image_id: p.photoImageId }),
    // Only when the form carried a VAT choice (a VAT-registered business): otherwise it is left alone.
    ...(p.vatStatus === undefined ? {} : { vat_status: p.vatStatus }),
  };
}

function summaryFor(id: string, organisationId: string, p: ProductFields, stored?: VatStatus | null): ProductSummary {
  // What the database holds wins: a form without the VAT choice leaves it as it was.
  return { id, organisationId, archived: false, ...p, photoImageId: p.photoImageId ?? null, vatStatus: stored ?? p.vatStatus ?? "standard" };
}

async function insertProduct(
  formData: FormData,
): Promise<{ ok: true; product: ProductSummary } | { ok: false; state: ProductSaveState }> {
  const { organisation } = await requireOrganisation();
  const parsed = parseProductForm(formData);
  if (!parsed.ok) return { ok: false, state: { status: "error", errors: parsed.errors } };

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("products")
    .insert({ organisation_id: organisation.id, ...toRow(parsed.value) })
    .select("id")
    .single();
  if (error?.code === "23503") {
    return { ok: false, state: { status: "error", errors: { photo: "That photo could not be used. Choose it again." } } };
  }
  if (error || !created) {
    console.error("could not add product:", error?.message);
    return { ok: false, state: { status: "error", message: GENERIC_ERROR } };
  }

  revalidatePath("/app/products");
  return { ok: true, product: summaryFor(created.id, organisation.id, parsed.value) };
}

/** Adds a product from the Products screen, then shows the list. Any member can. */
export async function createProduct(
  _previous: ProductSaveState,
  formData: FormData,
): Promise<ProductSaveState> {
  const result = await insertProduct(formData);
  if (!result.ok) return result.state;
  const view = result.product.kind === "service" ? "&view=services" : "";
  redirect(`/app/products?added=${result.product.id}${view}`);
}

/** Adds a product from inside a quote and hands it back, so it can go straight onto a line. */
export async function createProductInQuote(
  _previous: ProductSaveState,
  formData: FormData,
): Promise<ProductSaveState> {
  const result = await insertProduct(formData);
  return result.ok ? { status: "created", product: result.product } : result.state;
}

/** Saves changes to a product. Quote lines keep their own copy, so they do not change. */
export async function updateProduct(
  id: string,
  _previous: ProductSaveState,
  formData: FormData,
): Promise<ProductSaveState> {
  const { organisation } = await requireOrganisation();
  if (!UUID.test(id)) return { status: "error", message: GENERIC_ERROR };
  const parsed = parseProductForm(formData);
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  const supabase = await createClient();
  const { data: saved, error } = await supabase
    .from("products")
    .update(toRow(parsed.value))
    .eq("id", id)
    .eq("organisation_id", organisation.id)
    .select("id, vat_status");
  if (error?.code === "23503") {
    return { status: "error", errors: { photo: "That photo could not be used. Choose it again." } };
  }
  if (error || !saved || saved.length !== 1) {
    console.error("could not save product:", error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  revalidatePath("/app/products");
  return { status: "saved", product: summaryFor(id, organisation.id, parsed.value, saved[0].vat_status as VatStatus) };
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
