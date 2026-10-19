"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganisation } from "@/lib/auth/dal";
import { parseMaterialForm, type Material, type MaterialFieldErrors, type MaterialFields } from "@/lib/materials";
import { createClient } from "@/lib/supabase/server";

/** A material just added from another screen (a cost line), as that screen's list of materials holds them. */
export type AddedMaterial = Pick<Material, "id" | "name" | "unit" | "archived" | "boughtQuantityMilli" | "priceCents" | "vatTreatment">;

export type MaterialSaveState =
  | { status: "idle" }
  | { status: "saved"; material?: AddedMaterial }
  | { status: "error"; message?: string; errors?: MaterialFieldErrors };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC_ERROR = "Something went wrong saving that. Please try again.";
const TAKEN = "You already have a material with that name. Give this one its own name, or change that one.";
const LIST = "/app/products/materials";

function toRow(m: MaterialFields) {
  return {
    name: m.name,
    unit: m.unit,
    bought_quantity_milli: m.boughtQuantityMilli,
    price_cents: m.priceCents,
    vat_treatment: m.vatTreatment,
    supplier: m.supplier,
  };
}

/** Adds the material from the form, or says what is wrong. The one place a material is inserted. */
async function insertMaterial(formData: FormData): Promise<{ ok: true; id: string; fields: MaterialFields } | { ok: false; state: MaterialSaveState }> {
  const { organisation, profile } = await requireOrganisation();
  const parsed = parseMaterialForm(formData, { vatRegistered: profile.vatRegistered });
  if (!parsed.ok) return { ok: false, state: { status: "error", errors: parsed.errors } };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("materials")
    .insert({ organisation_id: organisation.id, ...toRow(parsed.value) })
    .select("id")
    .single();
  if (error?.code === "23505") return { ok: false, state: { status: "error", errors: { name: TAKEN } } };
  if (error?.code === "54000") {
    return { ok: false, state: { status: "error", message: "You have reached the limit of 2000 materials. Archive some you no longer use to make room." } };
  }
  if (error || !data) {
    console.error("could not add material:", error?.code, error?.message);
    return { ok: false, state: { status: "error", message: GENERIC_ERROR } };
  }
  revalidatePath(LIST);
  return { ok: true, id: data.id, fields: parsed.value };
}

/** Adds a material, then shows the list. Any member of the business can. */
export async function createMaterial(_previous: MaterialSaveState, formData: FormData): Promise<MaterialSaveState> {
  const made = await insertMaterial(formData);
  if (!made.ok) return made.state;
  redirect(`${LIST}?added=${made.id}`);
}

/**
 * Adds a material from where it is needed (a cost line on a product), and hands it back instead of leaving the screen:
 * what the maker has typed there is kept, and the new material is chosen for the line.
 */
export async function createMaterialHere(_previous: MaterialSaveState, formData: FormData): Promise<MaterialSaveState> {
  const made = await insertMaterial(formData);
  if (!made.ok) return made.state;
  const m = made.fields;
  return {
    status: "saved",
    material: { id: made.id, name: m.name, unit: m.unit, archived: false, boughtQuantityMilli: m.boughtQuantityMilli, priceCents: m.priceCents, vatTreatment: m.vatTreatment },
  };
}

/** Saves changes to a material. */
export async function updateMaterial(id: string, _previous: MaterialSaveState, formData: FormData): Promise<MaterialSaveState> {
  if (!UUID.test(id)) return { status: "error", message: GENERIC_ERROR };
  const { organisation, profile } = await requireOrganisation();
  const parsed = parseMaterialForm(formData, { vatRegistered: profile.vatRegistered });
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("materials")
    .update(toRow(parsed.value))
    .eq("id", id)
    .eq("organisation_id", organisation.id)
    .select("id");
  if (error?.code === "23505") return { status: "error", errors: { name: TAKEN } };
  if (error || !data || data.length !== 1) {
    console.error("could not save material:", error?.code, error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath(LIST);
  return { status: "saved" };
}

export type MaterialArchiveState = { status: "idle" } | { status: "error"; message: string };

/** Archives or restores a material. Materials are never deleted: processes and jobs will refer to them. */
export async function setMaterialArchived(id: string, archived: boolean): Promise<MaterialArchiveState> {
  const { organisation } = await requireOrganisation();
  if (!UUID.test(id)) redirect(LIST);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("materials")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("organisation_id", organisation.id)
    .select("id");
  if (error?.code === "54000") {
    return { status: "error", message: "You already have 2000 materials that are not archived, so this one cannot be restored. Archive another first." };
  }
  if (error?.code === "23505") {
    return { status: "error", message: "Another material has this name now. Give one of them a different name, then restore it." };
  }
  if (error || !data || data.length !== 1) {
    console.error("could not archive or restore material:", error?.code, error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath(LIST);
  if (archived) redirect(LIST);
  return { status: "idle" };
}
