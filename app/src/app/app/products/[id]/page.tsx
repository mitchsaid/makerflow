import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requireOrganisation } from "@/lib/auth/dal";
import { getLocalePack, priceEntryLabel, vatSettingsFor } from "@/lib/locale";
import { getProduct } from "@/lib/products/data";
import { updateProduct } from "../actions";
import { ProductForm } from "../product-form";
import { listHref, valuesFromProduct } from "../product-values";
import { ProductArchiveButton } from "./archive-button";

export default async function ProductPage({ params }: PageProps<"/app/products/[id]">) {
  const { id } = await params;
  // The product loads beside the workspace check, not after it.
  const [product, { organisation, profile }] = await Promise.all([getProduct(id), requireOrganisation()]);
  if (product.organisationId !== organisation.id) notFound();
  const locale = getLocalePack(profile.countryCode);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <div className="space-y-1">
        <Link href={listHref(product.kind)} className="text-sm text-muted-foreground underline">
          {product.kind === "service" ? "Services" : "Products"}
        </Link>
        <h1 className="text-xl font-semibold">{product.name}</h1>
      </div>
      {product.archived && (
        <Alert data-testid="archived-notice">
          <AlertDescription>
            This {product.kind} is archived, so it is hidden from your list. Restore it below to use it
            again.
          </AlertDescription>
        </Alert>
      )}
      <ProductForm
        key={product.id}
        mode="edit"
        action={updateProduct.bind(null, product.id)}
        initial={valuesFromProduct(product, locale.numberStyle)}
        priceLabel={priceEntryLabel(vatSettingsFor(profile, locale), locale.tax.name)}
      />
      <ProductArchiveButton id={product.id} archived={product.archived} kind={product.kind} />
    </main>
  );
}
