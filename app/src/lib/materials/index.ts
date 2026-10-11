import { parseMoney, parseQuantity, type Cents, type QuantityMilli } from "../money";
import { isUnitCode, sameKind, toBaseMilli, UNITS, type UnitCode } from "./units";

/**
 * Materials (docs/plans/costs-and-recipes.md, slice 1): what a business buys to make things. A material is bought
 * in a quantity at a price; what an amount of it costs is worked out from that, exactly, and rounded once.
 */

export const MATERIAL_NAME_MAX = 120;
export const MATERIAL_SUPPLIER_MAX = 120;

/**
 * What the price paid includes, for a VAT-registered business: "included" (what a shop till shows), "excluded",
 * or "none" (no VAT was charged, say a supplier who is not a VAT vendor). A business that is not registered
 * always has "none": the price paid is the cost.
 */
export type VatTreatment = "included" | "excluded" | "none";
export const VAT_TREATMENTS: readonly VatTreatment[] = ["included", "excluded", "none"];

export type Material = {
  id: string;
  organisationId: string;
  name: string;
  unit: UnitCode;
  /** How much was bought, in thousandths of the unit. */
  boughtQuantityMilli: QuantityMilli;
  /** What was paid for that quantity. */
  priceCents: Cents;
  vatTreatment: VatTreatment;
  supplier: string | null;
  archived: boolean;
};

/**
 * What an amount of a material costs, in whole cents WITHOUT VAT (margins are worked out without VAT), rounded once
 * at the end. `needed` is in thousandths of `neededUnit`, which must be the same kind of unit as the material's.
 * `vatRateBp` is the standard rate in basis points (from the locale pack) when the business is VAT-registered,
 * otherwise null. Returns null when the units are different kinds (litres against a material bought by the kilo).
 */
export function materialCostCents(
  neededMilli: QuantityMilli,
  neededUnit: UnitCode,
  material: Pick<Material, "unit" | "boughtQuantityMilli" | "priceCents" | "vatTreatment">,
  vatRateBp: number | null,
): Cents | null {
  if (!sameKind(neededUnit, material.unit)) return null;
  // Only an "included" price has VAT inside it to take out; a business that is not registered has none to remove.
  const stripVat = vatRateBp !== null && material.vatTreatment === "included";
  const rate = BigInt(vatRateBp ?? 0);
  const numerator = toBaseMilli(neededMilli, neededUnit) * BigInt(material.priceCents) * (stripVat ? BigInt(10_000) : BigInt(1));
  const denominator = toBaseMilli(material.boughtQuantityMilli, material.unit) * (stripVat ? BigInt(10_000) + rate : BigInt(1));
  if (denominator === BigInt(0)) return null;
  return Number((numerator * BigInt(2) + denominator) / (denominator * BigInt(2)));
}

/** What one of the material's own unit costs (without VAT): "R15,00 per kg". Null if it cannot be worked out. */
export function costPerUnitCents(
  material: Pick<Material, "unit" | "boughtQuantityMilli" | "priceCents" | "vatTreatment">,
  vatRateBp: number | null,
): Cents | null {
  return materialCostCents(1000, material.unit, material, vatRateBp);
}

/** A search over name and supplier, ignoring case. */
export function materialMatchesSearch(m: Pick<Material, "name" | "supplier">, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  return m.name.toLowerCase().includes(q) || (m.supplier ?? "").toLowerCase().includes(q);
}

export type MaterialFieldErrors = {
  name?: string;
  unit?: string;
  quantity?: string;
  price?: string;
  vatTreatment?: string;
  supplier?: string;
};

export type MaterialFields = {
  name: string;
  unit: UnitCode;
  boughtQuantityMilli: QuantityMilli;
  priceCents: Cents;
  vatTreatment: VatTreatment;
  supplier: string | null;
};

const tidy = (text: string) => text.trim().replace(/\s+/g, " ");

/**
 * Checks the form, saying how to fix each problem at its field. `vatRegistered`: only then is "what the price
 * includes" asked; otherwise it is always "none" whatever was sent.
 */
export function parseMaterialForm(
  form: FormData,
  options: { vatRegistered: boolean },
): { ok: true; value: MaterialFields } | { ok: false; errors: MaterialFieldErrors } {
  const text = (key: string) => {
    const v = form.get(key);
    return typeof v === "string" ? v : "";
  };
  const errors: MaterialFieldErrors = {};

  const name = tidy(text("name"));
  if (name === "") errors.name = "Give it a name, like “Cake flour”.";
  else if (name.length > MATERIAL_NAME_MAX) errors.name = `Keep the name to ${MATERIAL_NAME_MAX} characters or fewer.`;

  const unitText = text("unit");
  if (!isUnitCode(unitText)) errors.unit = "Choose a unit, like kg or each.";

  const quantity = parseQuantity(text("quantity"));
  if (!quantity.ok) errors.quantity = text("quantity").trim() === "" ? "Enter how much you bought, like 12,5." : quantity.error;

  const price = parseMoney(text("price"));
  if (!price.ok) errors.price = text("price").trim() === "" ? "Enter what you paid. Use 0 if it cost nothing." : price.error;

  let vatTreatment: VatTreatment = "none";
  if (options.vatRegistered) {
    const sent = text("vatTreatment");
    if ((VAT_TREATMENTS as readonly string[]).includes(sent)) vatTreatment = sent as VatTreatment;
    else errors.vatTreatment = "Say whether the price you paid includes VAT.";
  }

  const supplier = tidy(text("supplier"));
  if (supplier.length > MATERIAL_SUPPLIER_MAX) errors.supplier = `Keep the supplier to ${MATERIAL_SUPPLIER_MAX} characters or fewer.`;

  if (Object.keys(errors).length > 0 || !quantity.ok || !price.ok || !isUnitCode(unitText)) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      unit: unitText,
      boughtQuantityMilli: quantity.value,
      priceCents: price.value,
      vatTreatment,
      supplier: supplier === "" ? null : supplier,
    },
  };
}

export { UNITS };
