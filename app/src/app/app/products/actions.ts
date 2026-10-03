"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganisation } from "@/lib/auth/dal";
import { parseProductForm, type ProductFieldErrors, type ProductFields } from "@/lib/products";
import { createClient } from "@/lib/supabase/server";

export type ProductSaveState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message?: string; errors?: ProductFieldErrors };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC_ERROR = "Something went wrong saving that. Please try again.";

function toRow(p: ProductFields) {
  return {
    kind: p.kind,
    name: p.name,
    description: p.description,
    unit_price_cents: p.unitPriceCents,
  };
}

/** Adds a product, then shows the list. Any member of the business can. */
export async function createProduct(
  _previous: ProductSaveState,
  formData: FormData,
): Promise<ProductSaveState> {
  const { organisation } = await requireOrganisation();
  const parsed = parseProductForm(formData);
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("products")
    .insert({ organisation_id: organisation.id, ...toRow(parsed.value) })
    .select("id")
    .single();
  if (error || !created) {
    console.error("could not add product:", error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  revalidatePath("/app/products");
  redirect(`/app/products?added=${created.id}`);
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
    .select("id");
  if (error || !saved || saved.length !== 1) {
    console.error("could not save product:", error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  revalidatePath("/app/products");
  return { status: "saved" };
}

export type ProductArchiveState = { status: "idle" } | { status: "error"; message: string };

/** Archives or restores a product. Products are never deleted: quote lines refer to them. */
export async function setProductArchived(id: string, archived: boolean): Promise<ProductArchiveState> {
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
  if (archived) redirect("/app/products");
  return { status: "idle" };
}
