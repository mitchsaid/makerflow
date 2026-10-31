import { PageHeader } from "@/components/page-header";
import { requireOrganisation } from "@/lib/auth/dal";
import { nameKey } from "@/lib/import/products";
import { getLocalePack, vatSettingsFor } from "@/lib/locale";
import { currencySymbol } from "@/lib/money";
import { getProducts } from "@/lib/products/data";
import { forOrganisation } from "@/lib/scope";
import { ImportProducts } from "./import-products";

/** Bring in a list of products from a spreadsheet or a file (docs/plans/import-onboarding.md). */
export default async function ImportProductsPage({ searchParams }: PageProps<"/app/products/import">) {
  const [{ organisation, profile }, allProducts, params] = await Promise.all([requireOrganisation(), getProducts(), searchParams]);
  const locale = getLocalePack(profile.countryCode);
  const vat = vatSettingsFor(profile, locale);
  const existingNames = forOrganisation(allProducts, organisation.id).map((p) => nameKey(p.name));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <PageHeader close={{ href: "/app/products", label: "Products" }}>
        <h1 className="text-xl font-semibold">Import products</h1>
        <p className="text-muted-foreground">Bring in a list you already have.</p>
      </PageHeader>
      <ImportProducts
        initialKind={params.kind === "service" ? "service" : "product"}
        currencyCode={profile.currencyCode}
        currencySymbol={currencySymbol(profile.currencyCode, locale.numberStyle)}
        numberStyle={locale.numberStyle}
        existingNames={existingNames}
        priceNote={vat.registered ? `Prices are read the way you enter them: ${vat.entry === "inclusive" ? "including" : "excluding"} ${locale.tax.name}.` : null}
      />
    </main>
  );
}
