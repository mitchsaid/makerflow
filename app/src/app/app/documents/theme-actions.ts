"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { isStarterKey, parseSpec, THEME_NAME_MAX, themeName } from "@/lib/quotes/themes";
import { createClient } from "@/lib/supabase/server";

export type ThemeResult = { status: "saved"; id: string } | { status: "error"; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC_ERROR = "Something went wrong saving that. Please try again.";
const NOT_ALLOWED = "Only owners and admins can change the themes. Ask one of them.";

/** Where a theme's changes show up: the library, quote previews and the quotes list. */
function refresh() {
  revalidatePath("/app/documents/themes");
  revalidatePath("/app/quotes", "layout");
}

/** A new theme of the business's own (from a starter, a theme, or from scratch: the studio sends the whole spec). Owners and admins only. */
export async function createTheme(name: string, spec: unknown): Promise<ThemeResult> {
  const { organisation, role } = await requireOrganisation();
  if (!canEditBusinessProfile(role)) return { status: "error", message: NOT_ALLOWED };
  const clean = themeName(name);
  if (!clean) return { status: "error", message: `Give the theme a name (up to ${THEME_NAME_MAX} letters).` };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_themes")
    .insert({ organisation_id: organisation.id, name: clean, spec: parseSpec(spec) })
    .select("id")
    .single();
  if (error?.code === "54000") {
    return { status: "error", message: "You have the most themes you can keep (30). Delete one you don't use, then save this one." };
  }
  if (error || !data) {
    console.error("could not create the theme:", error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  refresh();
  return { status: "saved", id: data.id as string };
}

/** Changes a theme's name and look. Drafts that use it show the change; sent quotes keep the look they were sent in. */
export async function saveTheme(id: string, name: string, spec: unknown): Promise<ThemeResult> {
  const { organisation, role } = await requireOrganisation();
  if (!canEditBusinessProfile(role)) return { status: "error", message: NOT_ALLOWED };
  const clean = themeName(name);
  if (!clean) return { status: "error", message: `Give the theme a name (up to ${THEME_NAME_MAX} letters).` };
  if (!UUID.test(id)) return { status: "error", message: GENERIC_ERROR };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_themes")
    .update({ name: clean, spec: parseSpec(spec) })
    .eq("id", id)
    .eq("organisation_id", organisation.id)
    .select("id");
  if (error || !data || data.length !== 1) {
    if (!error) return { status: "error", message: "That theme isn't there any more. It may have been deleted." };
    console.error("could not save the theme:", error.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  refresh();
  return { status: "saved", id };
}

/** Deletes a theme. Quotes that use it follow the usual theme from then on; sent versions are unaffected. */
export async function deleteTheme(id: string): Promise<ThemeResult> {
  const { organisation, role } = await requireOrganisation();
  if (!canEditBusinessProfile(role)) return { status: "error", message: NOT_ALLOWED };
  if (!UUID.test(id)) return { status: "error", message: GENERIC_ERROR };

  const supabase = await createClient();
  const { error } = await supabase.from("quote_themes").delete().eq("id", id).eq("organisation_id", organisation.id);
  if (error) {
    console.error("could not delete the theme:", error.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  refresh();
  return { status: "saved", id };
}

/** Sets the theme new quotes start with: one of the business's own, or a starter. */
export async function setDefaultTheme(ref: { id: string | null; starter: string | null }): Promise<ThemeResult> {
  const { organisation, role } = await requireOrganisation();
  if (!canEditBusinessProfile(role)) return { status: "error", message: NOT_ALLOWED };
  const id = ref.id !== null && UUID.test(ref.id) ? ref.id : null;
  const starter = ref.starter !== null && isStarterKey(ref.starter) ? ref.starter : null;
  if ((ref.id !== null && !id) || (ref.starter !== null && !starter) || (id === null) === (starter === null)) {
    return { status: "error", message: GENERIC_ERROR };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_profiles")
    .update({ default_theme_id: id, default_theme_starter: starter })
    .eq("organisation_id", organisation.id)
    .select("organisation_id");
  if (error?.code === "23503") return { status: "error", message: "That theme isn't there any more." };
  if (error || !data || data.length !== 1) {
    console.error("could not set the default theme:", error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  refresh();
  revalidatePath("/app", "layout");
  return { status: "saved", id: id ?? starter! };
}
