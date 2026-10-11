import { requireOrganisation } from "@/lib/auth/dal";
import { getLocalePack } from "@/lib/locale";
import type { ProductKind } from "@/lib/products";
import { getProducts } from "@/lib/products/data";
import { forOrganisation } from "@/lib/scope";
import { ProductList } from "./product-list";
import { ProductsSwitch } from "./products-switch";
import { KIND_WORDS, newHref } from "./product-values";
import { AddLink } from "@/components/add-button";

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
  const hasAny = products.some((p) => p.kind === kind);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Products &amp; services</h1>
        {hasAny && (
          <AddLink href={newHref(kind)} variant="default">
            Add {KIND_WORDS[kind].one}
          </AddLink>
        )}
      </div>
      <ProductsSwitch active={kind} />
      <ProductList
        key={kind}
        kind={kind}
        products={products}
        addedName={addedName}
        currencyCode={profile.currencyCode}
        numberStyle={locale.numberStyle}
      />
    </main>
  );
}
