import { notFound } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requireOrganisation } from "@/lib/auth/dal";
import { currencySymbol } from "@/lib/money";
import { getLocalePack, priceEntryLabel, vatSettingsFor } from "@/lib/locale";
import { getProduct } from "@/lib/products/data";
import { updateProduct } from "../actions";
import { vatChoicesFor } from "@/lib/quotes/vat-choices";
import { variationSuggestions } from "@/lib/products/variations";
import { ProductForm } from "../product-form";
import { listHref, valuesFromProduct } from "../product-values";
import { ProductArchiveButton } from "./archive-button";
import { PageHeader } from "@/components/page-header";
import { getMaterials } from "@/lib/materials/data";
import { forOrganisation } from "@/lib/scope";

export default async function ProductPage({ params }: PageProps<"/app/products/[id]">) {
  const { id } = await params;
  // The product loads beside the workspace check, not after it.
  const [product, { organisation, profile }, materials] = await Promise.all([getProduct(id), requireOrganisation(), getMaterials()]);
  if (product.organisationId !== organisation.id) notFound();
  const locale = getLocalePack(profile.countryCode);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <PageHeader back={{ href: listHref(product.kind), label: product.kind === "service" ? "Services" : "Products" }}>
        <h1 className="text-xl font-semibold">{product.name}</h1>
      </PageHeader>
      {product.archived && (
        <Alert data-testid="archived-notice">
          <AlertDescription>
            This {product.kind} is archived: hidden from your list. Restore it below to use it again.
          </AlertDescription>
        </Alert>
      )}
      <ProductForm
        key={product.id}
        mode="edit"
        action={updateProduct.bind(null, product.id)}
        initial={valuesFromProduct(product, locale.numberStyle)}
        priceLabel={priceEntryLabel(vatSettingsFor(profile, locale), locale.tax.name)}
        variationSuggestions={variationSuggestions(profile.businessTypes, product.kind)}
        vatChoices={vatChoicesFor(vatSettingsFor(profile, locale), locale.tax.statuses, locale.numberStyle)}
        currencySymbol={currencySymbol(profile.currencyCode, locale.numberStyle)}
        currencyCode={profile.currencyCode}
        numberStyle={locale.numberStyle}
        costing={{ materials: forOrganisation(materials, organisation.id), hourlyRateCents: profile.labourRateCents, vat: vatSettingsFor(profile, locale) }}
      />
      <ProductArchiveButton id={product.id} archived={product.archived} kind={product.kind} />
    </main>
  );
}
