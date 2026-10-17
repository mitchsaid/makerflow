"use server";

import { requireOrganisation } from "@/lib/auth/dal";
import { getLocalePack } from "@/lib/locale";
import { formatMoney, moneyToInput } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { costRowFromSummary, type CostFormRow } from "@/lib/products/costs";
import { costLineOf } from "@/lib/products/data";

type ExtraCostRow = Parameters<typeof costLineOf>[0] & { sort_order: number };

/** A saved (shared) extra the maker can put on another product. */
export type SharedExtraChoice = {
  id: string;
  name: string;
  /** In the price field's own form ("30,00"), and as shown ("R30,00"). */
  price: string;
  priceText: string;
  /** It adds nothing ("Message on the cake"). */
  free: boolean;
  asksForWording: boolean;
  textMax: number;
  /** Products that have it now. */
  usedOn: number;
  /** What goes into one of it, as the form holds it. */
  costLines: CostFormRow[];
};

export type SharedExtrasState = { status: "ok"; extras: SharedExtraChoice[] } | { status: "error"; message: string };

/**
 * The business's saved extras, A to Z: what "Add an extra" offers before making a new one. Read when the
 * maker asks for them, so a product page does not carry them. Row-level security limits it to the business.
 */
export async function listSharedExtras(): Promise<SharedExtrasState> {
  const { organisation, profile } = await requireOrganisation();
  const locale = getLocalePack(profile.countryCode);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("extras")
    .select("id, name, price_cents, asks_for_wording, text_max, product_extras ( count ), extra_cost_lines ( id, sort_order, kind, material_id, amount_milli, unit, minutes, name, cents )")
    .eq("organisation_id", organisation.id)
    .is("product_id", null)
    .order("name", { ascending: true })
    .limit(500);
  if (error) {
    console.error("could not list saved extras:", error.message);
    return { status: "error", message: "Couldn't load your saved extras. Try again." };
  }
  return {
    status: "ok",
    extras: (data ?? []).map((x) => {
      const cents = Number(x.price_cents);
      const links = x.product_extras as unknown as { count: number }[] | null;
      return {
        id: x.id,
        name: x.name,
        price: moneyToInput(cents, locale.numberStyle),
        priceText: formatMoney(cents, profile.currencyCode, locale.numberStyle),
        free: cents === 0,
        asksForWording: x.asks_for_wording,
        textMax: x.text_max,
        usedOn: links?.[0]?.count ?? 0,
        costLines: [...((x.extra_cost_lines as unknown as ExtraCostRow[] | null) ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .flatMap((l, i) => {
            const line = costLineOf(l, { logic: "all", conditions: [] });
            return line ? [costRowFromSummary(line, `saved-xcost-${x.id}-${i}`, locale.numberStyle)] : [];
          }),
      };
    }),
  };
}
