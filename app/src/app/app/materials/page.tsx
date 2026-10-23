import { AddLink } from "@/components/add-button";
import { requireOrganisation } from "@/lib/auth/dal";
import { getLocalePack, vatSettingsFor } from "@/lib/locale";
import { getMaterials } from "@/lib/materials/data";
import { forOrganisation } from "@/lib/scope";
import { MaterialList } from "./material-list";

/**
 * Materials: what the business buys to make things, with what it paid (docs/plans/costs-and-recipes.md). A place of its
 * own since 2026-10-23 (it was the third switch on the Products tab), because stock will grow here.
 */
export default async function MaterialsPage({ searchParams }: PageProps<"/app/materials">) {
  // The materials query runs beside the workspace check, not after it.
  const [allMaterials, { organisation, profile }, params] = await Promise.all([getMaterials(), requireOrganisation(), searchParams]);
  const materials = forOrganisation(allMaterials, organisation.id);
  const locale = getLocalePack(profile.countryCode);
  const vat = vatSettingsFor(profile, locale);
  const added = typeof params.added === "string" ? params.added : undefined;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Materials</h1>
        {materials.length > 0 && (
          <AddLink href="/app/materials/new" variant="default">
            Add material
          </AddLink>
        )}
      </div>
      <MaterialList
        materials={materials}
        addedName={materials.find((m) => m.id === added)?.name}
        currencyCode={profile.currencyCode}
        numberStyle={locale.numberStyle}
        vatRateBp={vat.registered ? vat.standardRateBp : null}
        taxName={locale.tax.name}
      />
    </main>
  );
}
