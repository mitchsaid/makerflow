"use client";

import { AddLink } from "@/components/add-button";
import { SettingsLink } from "@/components/settings-link";
import { SectionSwitch, useSectionState, type SectionLink } from "@/components/section-switch";
import type { NumberStyle } from "@/lib/money";
import type { ProductKind, ProductSummary } from "@/lib/products";
import { ProductList } from "./product-list";
import Link from "@/components/app-link";
import { buttonVariants } from "@/components/ui/button";
import { importHref, KIND_WORDS, newHref } from "./product-values";

const VIEWS: SectionLink<ProductKind>[] = [
  { key: "product", label: "Products", href: "/app/products" },
  { key: "service", label: "Services", href: "/app/products?view=services" },
];

/**
 * The Products tab: Products and Services, switched at the top (founder, 2026-10-03). They share one table underneath,
 * and the page loads both, so the switch changes the list in the page without waiting for the server. Materials has
 * its own place (docs/plans/materials-menu-and-gaps.md).
 */
export function ProductsArea({
  initialKind,
  products,
  addedName,
  importedCount,
  importFailedCount,
  currencyCode,
  numberStyle,
}: {
  initialKind: ProductKind;
  products: ProductSummary[];
  addedName?: string;
  importedCount?: number;
  importFailedCount?: number;
  currencyCode: string;
  numberStyle: NumberStyle;
}) {
  const [kind, select] = useSectionState(VIEWS, initialKind);
  const hasAny = products.some((p) => p.kind === kind);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Products &amp; services</h1>
        <div className="flex items-center gap-2">
          {hasAny && (
            <Link href={importHref(kind)} className={buttonVariants({ variant: "outline" })} data-testid="import-link">
              Import
            </Link>
          )}
          {hasAny && (
            <AddLink href={newHref(kind)} variant="default">
              Add {KIND_WORDS[kind].one}
            </AddLink>
          )}
          {/* Your hourly rate and the margin you aim for: how prices are worked out. */}
          <SettingsLink href="/app/products/settings" label="Product settings" />
        </div>
      </div>
      <SectionSwitch label="Products or services" items={VIEWS} active={kind} onSelect={select} />
      <ProductList key={kind} kind={kind} products={products} addedName={addedName} importedCount={importedCount} importFailedCount={importFailedCount} currencyCode={currencyCode} numberStyle={numberStyle} />
    </>
  );
}
