import { notFound } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requireOrganisation } from "@/lib/auth/dal";
import { getLocalePack, vatSettingsFor } from "@/lib/locale";
import { getMaterial } from "@/lib/materials/data";
import { currencySymbol, moneyToInput, quantityToInput } from "@/lib/money";
import { updateMaterial } from "../actions";
import { MaterialForm } from "../material-form";
import { MaterialArchiveButton } from "./archive-button";
import { PageHeader } from "@/components/page-header";

export default async function MaterialPage({ params }: PageProps<"/app/products/materials/[id]">) {
  const { id } = await params;
  // The material loads beside the workspace check, not after it.
  const [material, { organisation, profile }] = await Promise.all([getMaterial(id), requireOrganisation()]);
  if (material.organisationId !== organisation.id) notFound();
  const locale = getLocalePack(profile.countryCode);
  const vat = vatSettingsFor(profile, locale);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <PageHeader back={{ href: "/app/products/materials", label: "Materials" }}>
        <h1 className="text-xl font-semibold">{material.name}</h1>
      </PageHeader>
      {material.archived && (
        <Alert data-testid="archived-notice">
          <AlertDescription>Archived: hidden from your list. Restore it below to use it again.</AlertDescription>
        </Alert>
      )}
      <MaterialForm
        key={material.id}
        mode="edit"
        action={updateMaterial.bind(null, material.id)}
        initial={{
          name: material.name,
          unit: material.unit,
          quantity: quantityToInput(material.boughtQuantityMilli, locale.numberStyle),
          price: moneyToInput(material.priceCents, locale.numberStyle),
          vatTreatment: material.vatTreatment,
          supplier: material.supplier ?? "",
        }}
        vatRateBp={vat.registered ? vat.standardRateBp : null}
        taxName={locale.tax.name}
        currencyCode={profile.currencyCode}
        numberStyle={locale.numberStyle}
        currencySymbol={currencySymbol(profile.currencyCode, locale.numberStyle)}
      />
      <MaterialArchiveButton id={material.id} archived={material.archived} />
    </main>
  );
}
