import { requireOrganisation } from "@/lib/auth/dal";
import { getLocalePack, vatSettingsFor } from "@/lib/locale";
import { currencySymbol } from "@/lib/money";
import { createMaterial } from "../actions";
import { EMPTY_MATERIAL, MaterialForm } from "../material-form";
import { PageHeader } from "@/components/page-header";

export default async function NewMaterialPage() {
  const { profile } = await requireOrganisation();
  const locale = getLocalePack(profile.countryCode);
  const vat = vatSettingsFor(profile, locale);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <PageHeader close={{ href: "/app/materials", label: "Materials" }}>
        <h1 className="text-xl font-semibold">Add a material</h1>
        <p className="text-muted-foreground">What you buy and what you paid.</p>
      </PageHeader>
      <MaterialForm
        mode="add"
        action={createMaterial}
        initial={EMPTY_MATERIAL}
        vatRateBp={vat.registered ? vat.standardRateBp : null}
        taxName={locale.tax.name}
        currencyCode={profile.currencyCode}
        numberStyle={locale.numberStyle}
        currencySymbol={currencySymbol(profile.currencyCode, locale.numberStyle)}
      />
    </main>
  );
}
