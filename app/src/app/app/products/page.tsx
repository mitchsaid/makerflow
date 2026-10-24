import { requireOrganisation } from "@/lib/auth/dal";
import { getLocalePack } from "@/lib/locale";
import type { ProductKind } from "@/lib/products";
import { getProducts } from "@/lib/products/data";
import { forOrganisation } from "@/lib/scope";
import { ProductsArea } from "./products-area";

/**
 * Products and services: one tab, two lists, switched at the top (founder, 2026-10-03). They
 * share one table underneath, so options, prices and the quote's picker are built once.
 */
export default async function ProductsPage({ searchParams }: PageProps<"/app/products">) {
  // The products query runs beside the workspace check, not after it.
  const [allProducts, { organisation, profile }, params] = await Promise.all([
    getProducts(),
    requireOrganisation(),
    searchParams,
  ]);
  const kind: ProductKind = params.view === "services" ? "service" : "product";
  const products = forOrganisation(allProducts, organisation.id);
  const added = typeof params.added === "string" ? params.added : undefined;
  const addedName = products.find((p) => p.id === added)?.name;
  const locale = getLocalePack(profile.countryCode);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <ProductsArea
        key={kind}
        initialKind={kind}
        products={products}
        addedName={addedName}
        currencyCode={profile.currencyCode}
        numberStyle={locale.numberStyle}
      />
    </main>
  );
}
