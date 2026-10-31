"use client";

import Link from "@/components/app-link";
import { PhotoThumb } from "@/components/photo-thumb";
import { useState } from "react";
import { ComingSoonSection } from "@/components/coming-soon";
import { EmptyState, NoMatches } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatMoney, type NumberStyle } from "@/lib/money";
import { productMatchesSearch, type ProductKind, type ProductSummary } from "@/lib/products";
import { KIND_WORDS, newHref } from "./product-values";
import { AddLink } from "@/components/add-button";

/** The products list: search as you type, archived products hidden until asked for. */
export function ProductList({
  kind,
  products: allProducts,
  addedName,
  currencyCode,
  numberStyle,
}: {
  /** Which list this is: products or services. */
  kind: ProductKind;
  products: ProductSummary[];
  addedName?: string;
  currencyCode: string;
  numberStyle: NumberStyle;
}) {
  const [query, setQuery] = useState("");
  const products = allProducts.filter((p) => p.kind === kind);
  const words = KIND_WORDS[kind];
  const [view, setView] = useState<"current" | "archived">("current");

  const archivedCount = products.filter((p) => p.archived).length;
  const visible = products.filter((p) => (view === "archived" ? p.archived : !p.archived) && productMatchesSearch(p, query));

  if (products.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          title={`No ${words.many} yet`}
          line={kind === "service" ? "Save the work you charge for, like design time or setup, with its price." : "Save what you make, with prices, to add to quotes quickly."}
        >
          <AddLink href={newHref(kind)} variant="default">
            Add your first {words.one}
          </AddLink>
        </EmptyState>
        {kind === "product" && (
          <ComingSoonSection
            title="Import from Shopify or a CSV"
            description="Bring in a product list you already have."
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {addedName && (
        <p role="status" className="text-sm font-medium" data-testid="product-added">
          Added {addedName}.
        </p>
      )}
      <Field>
        <FieldLabel htmlFor="product-search">Search {words.many}</FieldLabel>
        <Input
          id="product-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name or description"
          autoComplete="off"
        />
      </Field>
      {archivedCount > 0 && (
        <FilterBar
          label={`Show ${words.many}`}
          options={[
            { key: "current", label: "Current", count: products.length - archivedCount },
            { key: "archived", label: "Archived", count: archivedCount },
          ]}
          value={view}
          onChange={setView}
        />
      )}
      <p className="text-sm text-muted-foreground" aria-live="polite" data-testid="product-count">
        {visible.length === 1 ? `1 ${words.one}` : `${visible.length} ${words.many}`}
      </p>
      {visible.length === 0 ? (
        <NoMatches
          message={query.trim() !== "" ? `No ${words.many} match “${query.trim()}”.` : view === "archived" ? `No archived ${words.many}.` : `All your ${words.many} are archived.`}
          clearLabel={query.trim() === "" && view === "current" ? "Show archived" : undefined}
          onClear={() => setView("archived")}
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((p) => (
            <li key={p.id}>
              <Link
                href={`/app/products/${p.id}`}
                className="block rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <PhotoThumb imageId={p.photoImageId} />
                    <span className="truncate text-base font-medium">{p.name}</span>
                    {p.archived && (
                      <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                        Archived
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-base">{p.variations.length > 0 ? "from " : ""}{formatMoney(p.unitPriceCents, currencyCode, numberStyle)}</span>
                </span>
                {p.description && (
                  <span className="mt-0.5 block truncate text-sm text-muted-foreground">{p.description}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
