"use client";

import { useEffect, useRef } from "react";
import { Trash2Icon } from "lucide-react";
import { AddButton } from "@/components/add-button";
import { Section, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { PRICE_BREAKS_MAX, type PriceBreakErrors, type PriceBreakFormRow } from "@/lib/products/price-breaks";

// New rows' keys come from one counter that is never reset (the form keeps rows by key).
let keyCounter = 0;
export const newPriceBreakKey = () => `pb-new-${(keyCounter += 1)}`;

/**
 * "Quantity prices" (docs/plans/quantity-prices-and-steps.md): lower the price when more is ordered. Each row is a
 * quantity and a percent off the item's price, so it works the same for a product with one price and for one with
 * variations. On a quote the price each follows the quantity until the maker types their own.
 */
export function QuantityPricesSection({
  rows,
  errors,
  unit,
  fid,
  onChange,
}: {
  rows: PriceBreakFormRow[];
  errors: PriceBreakErrors | undefined;
  /** The product's unit ("dozen", "kg"), shown beside the quantity. Empty for a plain count. */
  unit: string;
  fid: (key: string) => string;
  onChange: (rows: PriceBreakFormRow[]) => void;
}) {
  // Where focus goes after a row is added or removed (once it is on the screen).
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingFocus.current) return;
    document.getElementById(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  });
  const setRow = (key: string, change: Partial<PriceBreakFormRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...change } : r)));
  const unitWord = unit.trim();

  return (
    <Section title="Quantity prices">
      <p className="-mt-2 text-base text-muted-foreground">Lower the price when someone orders more.</p>
      {rows.length > 0 && (
        <ol className="space-y-3" aria-label="Quantity prices">
          {rows.map((row, i) => {
            const rowErrors = errors?.rows[row.key];
            return (
              <li key={row.key} className="grid grid-cols-[1fr_1fr_2.75rem] items-start gap-x-3 gap-y-1">
                <TextField
                  id={fid(`price-break-${row.key}-from`)}
                  label={unitWord ? `From (${unitWord})` : "From (quantity)"}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="10"
                  value={row.from}
                  error={rowErrors?.from}
                  onChange={(v) => setRow(row.key, { from: v })}
                />
                <TextField
                  id={fid(`price-break-${row.key}-percent`)}
                  label="Percent off (%)"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="10"
                  value={row.percent}
                  error={rowErrors?.percent}
                  onChange={(v) => setRow(row.key, { percent: v })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-8 text-destructive"
                  aria-label={`Remove quantity price ${i + 1}`}
                  onClick={() => {
                    const next = rows.filter((r) => r.key !== row.key);
                    onChange(next);
                    pendingFocus.current = next.length > 0 ? fid(`price-break-${next[Math.max(0, i - 1)].key}-from`) : fid("add-price-break");
                  }}
                >
                  <Trash2Icon aria-hidden="true" />
                </Button>
              </li>
            );
          })}
        </ol>
      )}
      {errors?.list && (
        <p id={fid("price-breaks-error")} tabIndex={-1} className="text-sm text-destructive">
          {errors.list}
        </p>
      )}
      {rows.length < PRICE_BREAKS_MAX && (
        <AddButton
          id={fid("add-price-break")}
          className="self-start"
          onClick={() => {
            const row: PriceBreakFormRow = { key: newPriceBreakKey(), from: "", percent: "" };
            onChange([...rows, row]);
            pendingFocus.current = fid(`price-break-${row.key}-from`);
          }}
        >
          {rows.length === 0 ? "Add a quantity price" : "Add another quantity price"}
        </AddButton>
      )}
    </Section>
  );
}
