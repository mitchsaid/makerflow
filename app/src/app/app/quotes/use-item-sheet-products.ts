"use client";

import { useRef, useState } from "react";
import type { ProductSummary } from "@/lib/products";

/**
 * What every screen that uses the item sheet (LineSheet) keeps beside it: the business's products, which the sheet
 * can add to or change, and a source of fresh keys for the items it makes.
 */
export function useItemSheetProducts(initial: ProductSummary[]) {
  const [products, setProducts] = useState(initial);
  const nextKey = useRef(1);
  const newKey = () => `n-${nextKey.current++}`;
  function productSaved(product: ProductSummary) {
    setProducts((list) =>
      list.some((p) => p.id === product.id)
        ? // An edit never changes whether a product is archived.
          list.map((p) => (p.id === product.id ? { ...product, archived: p.archived } : p))
        : [...list, product],
    );
  }
  return { products, productSaved, newKey };
}
