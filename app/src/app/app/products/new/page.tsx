import Link from "next/link";
import { requireOrganisation } from "@/lib/auth/dal";
import { getLocalePack, priceEntryLabel, vatSettingsFor } from "@/lib/locale";
import { createProduct } from "../actions";
import { ProductForm } from "../product-form";
import { EMPTY_PRODUCT } from "../product-values";

export default async function NewProductPage() {
  const { profile } = await requireOrganisation();
  const locale = getLocalePack(profile.countryCode);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <div className="space-y-1">
        <Link href="/app/products" className="text-sm text-muted-foreground underline">
          Products
        </Link>
        <h1 className="text-xl font-semibold">Add a product</h1>
        <p className="text-muted-foreground">A name and a price are enough to start.</p>
      </div>
      <ProductForm
        mode="add"
        action={createProduct}
        initial={EMPTY_PRODUCT}
        priceLabel={priceEntryLabel(vatSettingsFor(profile, locale), locale.tax.name)}
      />
    </main>
  );
}
