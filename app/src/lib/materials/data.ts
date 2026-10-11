import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "../supabase/server";
import { isUnitCode } from "./units";
import type { Material, VatTreatment } from "./index";

/**
 * Material reads. Row-level security limits every query to businesses the signed-in person belongs to; pages keep
 * only the current business's rows (see lib/scope.ts).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = {
  id: string;
  organisation_id: string;
  name: string;
  unit: string;
  bought_quantity_milli: number | string;
  price_cents: number | string;
  vat_treatment: VatTreatment;
  supplier: string | null;
  archived_at: string | null;
};

const COLUMNS = "id, organisation_id, name, unit, bought_quantity_milli, price_cents, vat_treatment, supplier, archived_at";

function fromRow(row: Row): Material {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    name: row.name,
    // The database only allows the units in the list.
    unit: isUnitCode(row.unit) ? row.unit : "each",
    boughtQuantityMilli: Number(row.bought_quantity_milli),
    priceCents: Number(row.price_cents),
    vatTreatment: row.vat_treatment,
    supplier: row.supplier,
    archived: row.archived_at !== null,
  };
}

/** Every material of the business, archived ones included, A to Z. One query. */
export async function getMaterials(): Promise<Material[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("materials").select(COLUMNS).order("name", { ascending: true }).limit(5000);
  if (error) throw new Error(`Could not load materials: ${error.message}`);
  return (data as unknown as Row[]).map(fromRow);
}

/** One material, or null for a bad id or one this person cannot see. */
export async function findMaterial(id: string): Promise<Material | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("materials").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load the material: ${error.message}`);
  return data ? fromRow(data as unknown as Row) : null;
}

/** One material. Shows the "not found" page for a bad or foreign id. */
export async function getMaterial(id: string): Promise<Material> {
  const material = await findMaterial(id);
  if (!material) notFound();
  return material;
}
