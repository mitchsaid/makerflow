"use client";

import { AddLink } from "@/components/add-button";
import { SectionSwitch, useSectionState, type SectionLink } from "@/components/section-switch";
import type { NumberStyle } from "@/lib/money";
import type { ProductKind, ProductSummary } from "@/lib/products";
import { ProductList } from "./product-list";
import { KIND_WORDS, newHref } from "./product-values";

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
  currencyCode,
  numberStyle,
}: {
  initialKind: ProductKind;
  products: ProductSummary[];
  addedName?: string;
  currencyCode: string;
  numberStyle: NumberStyle;
}) {
  const [kind, select] = useSectionState(VIEWS, initialKind);
  const hasAny = products.some((p) => p.kind === kind);

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Products &amp; services</h1>
        {hasAny && (
          <AddLink href={newHref(kind)} variant="default">
            Add {KIND_WORDS[kind].one}
          </AddLink>
        )}
      </div>
      <SectionSwitch label="Products or services" items={VIEWS} active={kind} onSelect={select} />
      <ProductList key={kind} kind={kind} products={products} addedName={addedName} currencyCode={currencyCode} numberStyle={numberStyle} />
    </>
  );
}
