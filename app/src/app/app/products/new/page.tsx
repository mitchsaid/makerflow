import Link from "next/link";
import { requireOrganisation } from "@/lib/auth/dal";
import { getLocalePack, priceEntryLabel, vatSettingsFor } from "@/lib/locale";
import { createProduct } from "../actions";
import { ProductForm } from "../product-form";
import { emptyOfKind, KIND_WORDS, listHref } from "../product-values";
import type { ProductKind } from "@/lib/products";

export default async function NewProductPage({ searchParams }: PageProps<"/app/products/new">) {
  const [{ profile }, params] = await Promise.all([requireOrganisation(), searchParams]);
  const kind: ProductKind = params.kind === "service" ? "service" : "product";
  const locale = getLocalePack(profile.countryCode);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <div className="space-y-1">
        <Link href={listHref(kind)} className="text-sm text-muted-foreground underline">
          {kind === "service" ? "Services" : "Products"}
        </Link>
        <h1 className="text-xl font-semibold">Add a {KIND_WORDS[kind].one}</h1>
        <p className="text-muted-foreground">A name and a price are enough to start.</p>
      </div>
      <ProductForm
        mode="add"
        action={createProduct}
        initial={emptyOfKind(kind)}
        priceLabel={priceEntryLabel(vatSettingsFor(profile, locale), locale.tax.name)}
      />
    </main>
  );
}
