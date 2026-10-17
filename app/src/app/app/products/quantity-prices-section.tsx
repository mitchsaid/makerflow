"use client";

import { useEffect, useRef } from "react";
import { Trash2Icon } from "lucide-react";
import { AddButton } from "@/components/add-button";
import { TextField } from "@/components/form-fields";
import { QuantityField } from "@/components/quantity-field";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatMoney, parseMoney, parsePercent, type NumberStyle } from "@/lib/money";
import { PRICE_BREAKS_MAX, priceAfter, type PriceBreakErrors, type PriceBreakFormRow } from "@/lib/products/price-breaks";

// New rows' keys come from one counter that is never reset (the form keeps rows by key).
let keyCounter = 0;
export const newPriceBreakKey = () => `pb-new-${(keyCounter += 1)}`;

/**
 * Quantity prices for one price (docs/plans/quantity-prices-and-steps.md): lower it when more is ordered. They sit with
 * the price they lower: under the product's price when it has one, and under each variation's price when it has
 * several. A row is a quantity and what is taken off, a percent or an amount, with the price that leaves written
 * beside it. All the rows of the form are passed in and handed back, so the rows of other prices are kept.
 */
export function QuantityPrices({
  rows,
  scope,
  scopeName,
  priceText,
  unit,
  currencyCode,
  currencySymbol,
  numberStyle,
  errors,
  fid,
  onChange,
}: {
  rows: PriceBreakFormRow[];
  /** The key of the variation these rows belong to, or "" for the product's own price. */
  scope: string;
  /** The variation's name, for screen readers; empty for the product's own price. */
  scopeName: string;
  /** The price as typed, which the rows come off. */
  priceText: string;
  /** The product's unit ("dozen", "kg"), shown beside the quantity. Empty for a plain count. */
  unit: string;
  currencyCode: string;
  currencySymbol: string;
  numberStyle: NumberStyle;
  errors: PriceBreakErrors | undefined;
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
  const own = rows.filter((r) => r.variationKey === scope);
  const setRow = (key: string, change: Partial<PriceBreakFormRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...change } : r)));
  const unitWord = unit.trim();
  const base = parseMoney(priceText);
  const forName = scopeName ? ` for ${scopeName}` : "";
  const base0 = scope === "" ? "" : `-${scope}`;

  /** The price each that a row leaves, in words, when the row and the price can be read. */
  function finalText(row: PriceBreakFormRow): string | null {
    if (!base.ok) return null;
    if (row.kind === "percent") {
      const p = parsePercent(row.value);
      if (!p.ok || p.value === 0 || p.value >= 10_000) return null;
      return `${formatMoney(priceAfter(base.value, { kind: "percent", bp: p.value }), currencyCode, numberStyle)} ${unitWord ? `per ${unitWord}` : "each"}`;
    }
    const a = parseMoney(row.value);
    if (!a.ok || a.value === 0 || a.value >= base.value) return null;
    return `${formatMoney(priceAfter(base.value, { kind: "amount", cents: a.value }), currencyCode, numberStyle)} ${unitWord ? `per ${unitWord}` : "each"}`;
  }

  return (
    <div role="group" aria-label={`Quantity prices${forName}`} className="space-y-3">
      {own.length > 0 && (
        <>
          <p className="text-base font-medium">Quantity prices</p>
          <ol className="space-y-3" aria-label={`Quantity prices${forName}`}>
            {own.map((row, i) => {
              const rowErrors = errors?.rows[row.key];
              const final = finalText(row);
              return (
                <li key={row.key} className="space-y-2 rounded-xl border border-border p-3">
                  <div className="grid grid-cols-2 items-start gap-x-3 gap-y-1">
                    <QuantityField
                      id={fid(`price-break-${row.key}-from`)}
                      label={unitWord ? `From (${unitWord})` : "From (quantity)"}
                      placeholder="10"
                      value={row.from}
                      error={rowErrors?.from}
                      onChange={(v) => setRow(row.key, { from: v })}
                    />
                    <Field>
                      <FieldLabel htmlFor={fid(`price-break-${row.key}-kind`)}>Take off</FieldLabel>
                      <NativeSelect
                        id={fid(`price-break-${row.key}-kind`)}
                        value={row.kind}
                        onChange={(e) => setRow(row.key, { kind: e.target.value === "amount" ? "amount" : "percent", value: "" })}
                      >
                        <NativeSelectOption value="percent">A percentage</NativeSelectOption>
                        <NativeSelectOption value="amount">An amount</NativeSelectOption>
                      </NativeSelect>
                    </Field>
                  </div>
                  <div className="grid grid-cols-[9rem_1fr_2.75rem] items-start gap-x-3">
                    <TextField
                      id={fid(`price-break-${row.key}-value`)}
                      label={row.kind === "percent" ? "Percent off (%)" : "Amount off"}
                      startText={row.kind === "amount" ? currencySymbol : undefined}
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder={row.kind === "percent" ? "10" : "20"}
                      value={row.value}
                      error={rowErrors?.value}
                      onChange={(v) => setRow(row.key, { value: v })}
                    />
                    <p className="mt-8 flex h-11 items-center text-sm text-muted-foreground" data-testid="quantity-price-final">
                      {final ? <span>{final}</span> : null}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-8 text-destructive"
                      aria-label={`Remove quantity price ${i + 1}${forName}`}
                      onClick={() => {
                        const next = rows.filter((r) => r.key !== row.key);
                        onChange(next);
                        const stay = next.filter((r) => r.variationKey === scope);
                        pendingFocus.current = stay.length > 0 ? fid(`price-break-${stay[Math.max(0, i - 1)].key}-from`) : fid(`add-price-break${base0}`);
                      }}
                    >
                      <Trash2Icon aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
      {own.length < PRICE_BREAKS_MAX && (
        <AddButton
          id={fid(`add-price-break${base0}`)}
          className="self-start"
          onClick={() => {
            const row: PriceBreakFormRow = { key: newPriceBreakKey(), variationKey: scope, from: "", kind: "percent", value: "" };
            onChange([...rows, row]);
            pendingFocus.current = fid(`price-break-${row.key}-from`);
          }}
        >
          {own.length === 0 ? "Add a quantity price" : "Add another quantity price"}
          {scopeName && <span className="sr-only"> for {scopeName}</span>}
        </AddButton>
      )}
    </div>
  );
}
