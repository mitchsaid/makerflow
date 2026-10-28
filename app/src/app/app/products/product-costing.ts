import { vatSettingsFor, type LocalePack } from "@/lib/locale";
import type { Material } from "@/lib/materials";
import { forOrganisation } from "@/lib/scope";
import type { ComponentProps } from "react";
import type { ProductForm } from "./product-form";

/** What the product form's Inputs tab needs, for a page that opens the form (the Products pages, and the sheet over a quote, job or invoice). */
export function productCosting(
  materials: (Material & { organisationId: string })[],
  organisationId: string,
  profile: { labourRateCents: number | null; targetMarginBp: number | null; vatRegistered: boolean; pricesIncludeVat: boolean },
  locale: LocalePack,
): NonNullable<ComponentProps<typeof ProductForm>["costing"]> {
  return {
    materials: forOrganisation(materials, organisationId),
    hourlyRateCents: profile.labourRateCents,
    vat: vatSettingsFor(profile, locale),
    targetMarginBp: profile.targetMarginBp,
    taxName: locale.tax.name,
  };
}
