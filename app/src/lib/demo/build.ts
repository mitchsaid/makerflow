import "server-only";
import { insertImage } from "../images/data";
import { processImage } from "../images/process";
import { getLocalePack } from "../locale";
import { createClient } from "../supabase/server";
import type { Workspace } from "../auth/dal";
import { demoContent, type DemoCostLine, type DemoProduct } from "./content";
import { demoLogoPng } from "./logo";

/**
 * Fills a demo business with its sample content (docs/plans/demo-accounts.md): the business details and logo,
 * materials, customers, and products with variations, extras and what they cost to make. It runs as the visitor, under
 * their own access, through the same tables and `save_product_layers` a maker uses, so nothing is written that the
 * app could not. It **refuses to run on a business that is not a demo** (checked here, from the business's own flag),
 * and runs once: a demo that already has products is left alone.
 */

export class NotADemoError extends Error {
  constructor() {
    super("the demo builder only runs on a demo business");
  }
}

function costsPayload(costs: NonNullable<DemoProduct["costs"]>, materialIds: ReadonlyMap<string, string>) {
  return {
    makes_milli: costs.makesMilli,
    lines: costs.lines.map((l: DemoCostLine) => {
      const common = { logic: "all", conditions: [] };
      if (l.kind === "material") {
        const id = materialIds.get(l.material);
        if (!id) throw new Error(`demo content names a material that is not there: ${l.material}`);
        return { kind: "material", material_id: id, amount_milli: l.amountMilli, unit: l.unit, ...common };
      }
      if (l.kind === "time") return { kind: "time", minutes: l.minutes, ...common };
      return { kind: "other", name: l.name, cents: l.cents, ...common };
    }),
  };
}

export async function buildDemoBusiness(workspace: Workspace): Promise<void> {
  if (!workspace.demo) throw new NotADemoError();
  const content = demoContent(workspace.demo.kind);
  const orgId = workspace.organisation.id;
  const supabase = await createClient();

  // Once only: a second call (a double tap, a retry) finds the products and leaves everything as it is.
  const { count, error: countError } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("organisation_id", orgId);
  if (countError) throw new Error(`could not check the demo: ${countError.message}`);
  if ((count ?? 0) > 0) return;

  const locale = getLocalePack(workspace.profile.countryCode);

  // The business: details, what it makes, what time is worth, the margin it aims for.
  const { error: profileError } = await supabase
    .from("business_profiles")
    .update({
      owner_name: content.ownerName,
      phone: content.phone,
      email: content.email,
      address_line1: content.addressLine1,
      address_line2: content.addressLine2 ?? null,
      city: content.city,
      region: content.region,
      postal_code: content.postalCode,
      vat_registered: content.vatNumber !== undefined,
      vat_number: content.vatNumber ?? null,
      prices_include_vat: true,
      business_types: content.businessTypes,
      labour_rate_cents: content.labourRateCents,
      target_margin_bp: content.targetMarginBp,
    })
    .eq("organisation_id", orgId);
  if (profileError) throw new Error(`could not fill in the demo business: ${profileError.message}`);

  // The logo, stored like any other picture.
  const png = await demoLogoPng(workspace.demo.kind, content.logo);
  const processed = await processImage(png, "logo");
  if (processed.ok) {
    const imageId = await insertImage(orgId, "logo", processed.value);
    const { error } = await supabase.from("business_profiles").update({ logo_image_id: imageId }).eq("organisation_id", orgId);
    if (error) throw new Error(`could not set the demo logo: ${error.message}`);
  }

  const { data: materials, error: materialsError } = await supabase
    .from("materials")
    .insert(
      content.materials.map((m) => ({
        organisation_id: orgId,
        name: m.name,
        unit: m.unit,
        bought_quantity_milli: m.boughtQuantityMilli,
        price_cents: m.priceCents,
        vat_treatment: content.vatNumber ? "included" : "none",
        supplier: m.supplier ?? null,
      })),
    )
    .select("id, name");
  if (materialsError) throw new Error(`could not add the demo materials: ${materialsError.message}`);
  const idByName = new Map((materials ?? []).map((m) => [m.name, m.id as string]));
  const materialIds = new Map(content.materials.map((m) => [m.key, idByName.get(m.name) ?? ""]));

  const { error: customersError } = await supabase.from("customers").insert(
    content.customers.map((c) => ({
      organisation_id: orgId,
      name: c.name,
      kind: "individual",
      email: c.email,
      phone: c.phone,
      address_line1: c.addressLine1,
      city: c.city,
      region: locale.address.regions.includes(c.region) ? c.region : null,
      postal_code: c.postalCode,
      delivery_same_as_main: true,
      notes: c.notes ?? null,
    })),
  );
  if (customersError) throw new Error(`could not add the demo customers: ${customersError.message}`);

  for (const p of content.products) {
    const { error } = await supabase.rpc("save_product_layers", {
      p_org: orgId,
      p_product_id: null,
      p_product: {
        kind: p.kind,
        name: p.name,
        description: p.description,
        unit_price_cents: p.priceCents,
        unit: p.unit ?? "",
        variation_label: p.variationLabel ?? "",
      },
      p_variations: (p.variations ?? []).map((v) => ({ name: v.name, price_cents: v.priceCents, usual: v.usual ?? false })),
      p_options: null,
      p_extras: p.extras
        ? p.extras.map((x) => ({ name: x.name, price_cents: x.priceCents, asks_for_wording: false, text_max: null, shared: false, changed: true, price_by_variation: false }))
        : null,
      p_price_breaks: null,
      p_steps: null,
      p_costs: p.costs ? costsPayload(p.costs, materialIds) : null,
    });
    if (error) throw new Error(`could not add the demo product ${p.name}: ${error.message}`);
  }
}
