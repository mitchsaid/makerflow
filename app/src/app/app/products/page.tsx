import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { requireOrganisation } from "@/lib/auth/dal";
import { getLocalePack } from "@/lib/locale";
import { getProducts } from "@/lib/products/data";
import { forOrganisation } from "@/lib/scope";
import { ProductList } from "./product-list";

export default async function ProductsPage({ searchParams }: PageProps<"/app/products">) {
  // The products query runs beside the workspace check, not after it.
  const [allProducts, { organisation, profile }, params] = await Promise.all([
    getProducts(),
    requireOrganisation(),
    searchParams,
  ]);
  const products = forOrganisation(allProducts, organisation.id);
  const added = typeof params.added === "string" ? params.added : undefined;
  const addedName = products.find((p) => p.id === added)?.name;
  const locale = getLocalePack(profile.countryCode);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Products</h1>
        {products.length > 0 && (
          <Link href="/app/products/new" className={buttonVariants()}>
            Add product
          </Link>
        )}
      </div>
      <ProductList
        products={products}
        addedName={addedName}
        currencyCode={profile.currencyCode}
        numberStyle={locale.numberStyle}
      />
    </main>
  );
}
