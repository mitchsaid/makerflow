"use client";

import Link from "next/link";
import { useState } from "react";
import { ComingSoonSection } from "@/components/coming-soon";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatMoney, type NumberStyle } from "@/lib/money";
import { productMatchesSearch, type ProductSummary } from "@/lib/products";

/** The products list: search as you type, archived products hidden until asked for. */
export function ProductList({
  products,
  addedName,
  currencyCode,
  numberStyle,
}: {
  products: ProductSummary[];
  addedName?: string;
  currencyCode: string;
  numberStyle: NumberStyle;
}) {
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const archivedCount = products.filter((p) => p.archived).length;
  const visible = products.filter((p) => (showArchived || !p.archived) && productMatchesSearch(p, query));

  if (products.length === 0) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-4">
            <p className="text-base font-medium">No products yet</p>
            <p className="text-muted-foreground">
              Save the things you make and the services you offer, with their prices, so a quote
              is a few taps away.
            </p>
            <Link href="/app/products/new" className={buttonVariants()}>
              Add your first product
            </Link>
          </CardContent>
        </Card>
        <ComingSoonSection
          title="Import from Shopify or a CSV"
          description="Bring in a product list you already have, instead of typing it again."
        />
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
        <FieldLabel htmlFor="product-search">Search products</FieldLabel>
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
        <Field orientation="horizontal" className="min-h-11 items-center">
          <Checkbox
            id="show-archived"
            checked={showArchived}
            onCheckedChange={(checked) => setShowArchived(checked)}
          />
          <FieldLabel htmlFor="show-archived" className="text-base">
            Show archived ({archivedCount})
          </FieldLabel>
        </Field>
      )}
      <p className="text-sm text-muted-foreground" aria-live="polite" data-testid="product-count">
        {visible.length === 1 ? "1 product" : `${visible.length} products`}
      </p>
      {visible.length === 0 ? (
        <p className="text-muted-foreground">No products match &ldquo;{query}&rdquo;.</p>
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
                    <span className="truncate text-base font-medium">{p.name}</span>
                    {p.kind === "service" && (
                      <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                        Service
                      </span>
                    )}
                    {p.archived && (
                      <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                        Archived
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-base">{formatMoney(p.unitPriceCents, currencyCode, numberStyle)}</span>
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
