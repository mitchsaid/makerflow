import "server-only";
import { cache } from "react";
import { createClient } from "../supabase/server";
import { parseSpec, type SavedTheme } from "./themes";

type ThemeRow = { id: string; name: string; spec: unknown };

const toSaved = (row: ThemeRow): SavedTheme => ({ id: row.id, name: row.name, spec: parseSpec(row.spec) });

/** All of the signed-in business's themes, oldest first (row-level security keeps it to their own). */
export const getThemes = cache(async (): Promise<SavedTheme[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("quote_themes").select("id, name, spec").order("created_at");
  if (error) throw new Error(`Could not load the themes: ${error.message}`);
  return ((data ?? []) as ThemeRow[]).map(toSaved);
});
