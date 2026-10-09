import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "../supabase/server";
import type { VatStatus } from "../money";
import type { OptionCharge, OptionKind } from "./options";
import type { ProductKind, ProductSummary } from "./index";

/**
 * Product reads. Row-level security limits every query to businesses the signed-in person
 * belongs to; pages keep only the current business's rows (see lib/scope.ts).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = {
  id: string;
  organisation_id: string;
  kind: ProductKind;
  name: string;
  description: string | null;
  unit_price_cents: number;
  unit: string | null;
  archived_at: string | null;
  photo_image_id: string | null;
  vat_status: VatStatus;
  variation_label: string | null;
  product_variations: { id: string; name: string; price_cents: number | string; usual: boolean; sort_order: number }[] | null;
  product_option_groups:
    | {
        id: string;
        name: string;
        kind: OptionKind;
        required: boolean;
        charge: OptionCharge;
        text_price_cents: number | string;
        text_max: number;
        sort_order: number;
        product_option_values: { id: string; name: string; price_cents: number | string; usual: boolean; sort_order: number }[] | null;
      }[]
    | null;
};

const COLUMNS = "id, organisation_id, kind, name, description, unit_price_cents, unit, archived_at, photo_image_id, vat_status, variation_label,\n  product_variations ( id, name, price_cents, usual, sort_order ),\n  product_option_groups ( id, name, kind, required, charge, text_price_cents, text_max, sort_order,\n    product_option_values ( id, name, price_cents, usual, sort_order ) )";

function fromRow(row: Row): ProductSummary {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    kind: row.kind,
    name: row.name,
    description: row.description,
    unitPriceCents: Number(row.unit_price_cents),
    unit: row.unit,
    archived: row.archived_at !== null,
    photoImageId: row.photo_image_id,
    vatStatus: row.vat_status,
    variationLabel: row.variation_label,
    variations: [...(row.product_variations ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => ({ id: v.id, name: v.name, priceCents: Number(v.price_cents), usual: v.usual })),
    options: [...(row.product_option_groups ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((g) => ({
        id: g.id,
        name: g.name,
        kind: g.kind,
        required: g.required,
        charge: g.charge,
        textPriceCents: Number(g.text_price_cents),
        textMax: g.text_max,
        values: [...(g.product_option_values ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((v) => ({ id: v.id, name: v.name, priceCents: Number(v.price_cents), usual: v.usual })),
      })),
  };
}

/** Every product of the business, archived ones included, A to Z. One query. */
export async function getProducts(): Promise<ProductSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(COLUMNS)
    .order("name", { ascending: true })
    .limit(5000);
  if (error) throw new Error(`Could not load products: ${error.message}`);
  return (data as Row[]).map(fromRow);
}

/** One product, or null for a bad id or one this person cannot see. */
export async function findProduct(id: string): Promise<ProductSummary | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load the product: ${error.message}`);
  return data ? fromRow(data as Row) : null;
}

/** One product. Shows the "not found" page for a bad or foreign id. */
export async function getProduct(id: string): Promise<ProductSummary> {
  const product = await findProduct(id);
  if (!product) notFound();
  return product;
}
