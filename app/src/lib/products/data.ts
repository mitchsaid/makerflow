import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "../supabase/server";
import type { VatStatus } from "../money";
import { isUnitCode } from "../materials/units";
import type { ProductKind, ProductSummary } from "./index";
import type { CostLineSummary } from "./costs";

/**
 * Product reads. Row-level security limits every query to businesses the signed-in person
 * belongs to; pages keep only the current business's rows (see lib/scope.ts).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ExtraCostLineRow = {
  id: string;
  sort_order: number;
  kind: "material" | "time" | "other";
  material_id: string | null;
  amount_milli: number | string | null;
  unit: string | null;
  minutes: number | null;
  name: string | null;
  cents: number | string | null;
};

/** One saved cost line (of a product or of an extra) as the app holds it; null when the row is not one of the three kinds. */
export function costLineOf(
  l: ExtraCostLineRow,
  rest: { logic: "all" | "any"; conditions: CostLineSummary["conditions"] },
): CostLineSummary | null {
  const common = { id: l.id, logic: rest.logic, conditions: rest.conditions };
  if (l.kind === "material" && l.material_id && l.amount_milli !== null && l.unit !== null && isUnitCode(l.unit)) {
    return { ...common, kind: "material", materialId: l.material_id, amountMilli: Number(l.amount_milli), unit: l.unit };
  }
  if (l.kind === "time" && l.minutes !== null) return { ...common, kind: "time", minutes: l.minutes };
  if (l.kind === "other" && l.name !== null && l.cents !== null) return { ...common, kind: "other", name: l.name, cents: Number(l.cents) };
  return null;
}

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
  makes_milli: number | string;
  product_cost_lines:
    | {
        id: string;
        sort_order: number;
        kind: "material" | "time" | "other";
        condition_logic: "all" | "any";
        material_id: string | null;
        amount_milli: number | string | null;
        unit: string | null;
        minutes: number | null;
        name: string | null;
        cents: number | string | null;
        product_cost_line_conditions:
          | {
              sort_order: number;
              kind: "chosen" | "quantity_at_least";
              negate: boolean;
              variation_id: string | null;
              option_value_id: string | null;
              extra_id: string | null;
              quantity_milli: number | string | null;
            }[]
          | null;
      }[]
    | null;
  product_variations: { id: string; name: string; price_cents: number | string; usual: boolean; sort_order: number; image_id: string | null }[] | null;
  product_steps:
    | {
        name: string;
        sort_order: number;
        condition_logic: "all" | "any";
        product_step_conditions:
          | {
              sort_order: number;
              kind: "chosen" | "quantity_at_least";
              negate: boolean;
              variation_id: string | null;
              option_value_id: string | null;
              extra_id: string | null;
              quantity_milli: number | string | null;
            }[]
          | null;
      }[]
    | null;
  product_price_breaks: { variation_id: string | null; from_quantity_milli: number | string; percent_off_bp: number | null; amount_off_cents: number | string | null }[] | null;
  product_option_groups:
    | {
        id: string;
        name: string;
        price_by_variation: boolean;
        sort_order: number;
        product_option_values:
          | {
              id: string;
              name: string;
              price_cents: number | string;
              usual: boolean;
              sort_order: number;
              image_id: string | null;
              product_option_value_prices: { variation_id: string; price_cents: number | string }[] | null;
              product_option_value_exclusions: { variation_id: string }[] | null;
            }[]
          | null;
      }[]
    | null;
  product_extras:
    | {
        sort_order: number;
        extras: {
          id: string;
          name: string;
          price_cents: number | string;
          asks_for_wording: boolean;
          text_max: number;
          product_id: string | null;
          price_by_variation: boolean;
          extra_cost_lines: ExtraCostLineRow[] | null;
          extra_variation_prices: { variation_id: string; price_cents: number | string }[] | null;
          product_extras: { count: number }[] | null;
        } | null;
      }[]
    | null;
};

const COLUMNS = "id, organisation_id, kind, name, description, unit_price_cents, unit, archived_at, photo_image_id, vat_status, variation_label, makes_milli,\n  product_cost_lines ( id, sort_order, kind, condition_logic, material_id, amount_milli, unit, minutes, name, cents,\n    product_cost_line_conditions ( sort_order, kind, negate, variation_id, option_value_id, extra_id, quantity_milli ) ),\n  product_price_breaks ( variation_id, from_quantity_milli, percent_off_bp, amount_off_cents ),\n  product_steps ( name, sort_order, condition_logic,\n    product_step_conditions ( sort_order, kind, negate, variation_id, option_value_id, extra_id, quantity_milli ) ),\n  product_variations ( id, name, price_cents, usual, sort_order, image_id ),\n  product_option_groups ( id, name, price_by_variation, sort_order,\n    product_option_values ( id, name, price_cents, usual, sort_order, image_id, product_option_value_prices ( variation_id, price_cents ), product_option_value_exclusions ( variation_id ) ) ),\n  product_extras ( sort_order,\n    extras ( id, name, price_cents, asks_for_wording, text_max, product_id, price_by_variation,\n      extra_cost_lines ( id, sort_order, kind, material_id, amount_milli, unit, minutes, name, cents ),\n      extra_variation_prices ( variation_id, price_cents ), product_extras ( count ) ) )";

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
    makesMilli: Number(row.makes_milli),
    costLines: [...(row.product_cost_lines ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .flatMap((l): CostLineSummary[] => {
        const conditions = [...(l.product_cost_line_conditions ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((c) =>
            c.kind === "quantity_at_least"
              ? { kind: "quantity" as const, negate: c.negate, quantityMilli: Number(c.quantity_milli) }
              : { kind: "chosen" as const, negate: c.negate, variationId: c.variation_id, optionValueId: c.option_value_id, extraId: c.extra_id },
          );
        const line = costLineOf(l, { logic: l.condition_logic, conditions });
        return line ? [line] : [];
      }),
    steps: [...(row.product_steps ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((x) => ({
        name: x.name,
        logic: x.condition_logic,
        conditions: [...(x.product_step_conditions ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((c) =>
            c.kind === "quantity_at_least"
              ? { kind: "quantity" as const, negate: c.negate, quantityMilli: Number(c.quantity_milli) }
              : { kind: "chosen" as const, negate: c.negate, variationId: c.variation_id, optionValueId: c.option_value_id, extraId: c.extra_id },
          ),
      })),
    priceBreaks: [...(row.product_price_breaks ?? [])]
      .map((b) => ({
        variationId: b.variation_id,
        fromMilli: Number(b.from_quantity_milli),
        off: b.amount_off_cents !== null ? ({ kind: "amount", cents: Number(b.amount_off_cents) } as const) : ({ kind: "percent", bp: b.percent_off_bp ?? 0 } as const),
      }))
      .sort((a, b) => a.fromMilli - b.fromMilli),
    variations: [...(row.product_variations ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => ({ id: v.id, name: v.name, priceCents: Number(v.price_cents), usual: v.usual, imageId: v.image_id })),
    options: [...(row.product_option_groups ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((g) => ({
        id: g.id,
        name: g.name,
        kind: "one" as const,
        priceByVariation: g.price_by_variation,
        values: [...(g.product_option_values ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((v) => ({
            id: v.id,
            name: v.name,
            priceCents: Number(v.price_cents),
            usual: v.usual,
            imageId: v.image_id,
            prices: Object.fromEntries((v.product_option_value_prices ?? []).map((p) => [p.variation_id, Number(p.price_cents)])),
            notOffered: (v.product_option_value_exclusions ?? []).map((x) => x.variation_id),
          })),
      })),
    extras: [...(row.product_extras ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .flatMap((pe) => {
        const x = pe.extras;
        if (!x) return [];
        return [
          {
            id: x.id,
            name: x.name,
            priceCents: Number(x.price_cents),
            asksForWording: x.asks_for_wording,
            textMax: x.text_max,
            shared: x.product_id === null,
            usedOn: Math.max(1, x.product_extras?.[0]?.count ?? 1),
            priceByVariation: x.price_by_variation,
            prices: Object.fromEntries((x.extra_variation_prices ?? []).map((p) => [p.variation_id, Number(p.price_cents)])),
            costLines: [...(x.extra_cost_lines ?? [])]
              .sort((a, b) => a.sort_order - b.sort_order)
              .flatMap((l) => costLineOf(l, { logic: "all", conditions: [] }) ?? []),
          },
        ];
      }),
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
  return (data as unknown as Row[]).map(fromRow);
}

/** The products with these ids (those this person can see), with their costs. One query. */
export async function getProductsByIds(ids: readonly string[]): Promise<ProductSummary[]> {
  const wanted = [...new Set(ids)].filter((id) => UUID.test(id));
  if (wanted.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select(COLUMNS).in("id", wanted);
  if (error) throw new Error(`Could not load the products: ${error.message}`);
  return (data as unknown as Row[]).map(fromRow);
}

/** One product, or null for a bad id or one this person cannot see. */
export async function findProduct(id: string): Promise<ProductSummary | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load the product: ${error.message}`);
  return data ? fromRow(data as unknown as Row) : null;
}

/** One product. Shows the "not found" page for a bad or foreign id. */
export async function getProduct(id: string): Promise<ProductSummary> {
  const product = await findProduct(id);
  if (!product) notFound();
  return product;
}
