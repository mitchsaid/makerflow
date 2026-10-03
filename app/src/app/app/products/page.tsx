import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { requireOrganisation } from "@/lib/auth/dal";
import { getLocalePack } from "@/lib/locale";
import type { ProductKind } from "@/lib/products";
import { getProducts } from "@/lib/products/data";
import { forOrganisation } from "@/lib/scope";
import { ProductList } from "./product-list";
import { KIND_WORDS, listHref, newHref } from "./product-values";

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
          <Link href={newHref(kind)} className={buttonVariants()}>
            Add {KIND_WORDS[kind].one}
          </Link>
        )}
      </div>
      <nav aria-label="Products or services" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {(["product", "service"] as const).map((k) => (
          <Link
            key={k}
            href={listHref(k)}
            aria-current={k === kind ? "page" : undefined}
            className={`flex min-h-11 items-center justify-center rounded-md text-base font-medium ${
              k === kind ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {k === "product" ? "Products" : "Services"}
          </Link>
        ))}
      </nav>
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
