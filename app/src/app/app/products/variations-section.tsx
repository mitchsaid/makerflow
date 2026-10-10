"use client";

import { useEffect, useRef } from "react";
import { SelectField, TextField } from "@/components/form-fields";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VariationErrors, VariationFormRow } from "@/lib/products/variations";

// New rows' keys come from one counter that is never reset (the product form starts the first rows too).
let rowKeyCounter = 0;
export const newVariationKey = () => `new-${(rowKeyCounter += 1)}`;

/**
 * What a product that is priced by size or version looks like (docs/plans/product-extras.md): the maker names the
 * variation ("Size", "Tiers"; the business type's first suggestion is shown as an example), and each choice has
 * its own price. It replaces the
 * product's single price (the first row starts with the typed price, and the one left gives its price back when
 * the last is removed). One choice can be the usual one, chosen for you on a quote.
 */
export function PricedVariations({
  label,
  rows,
  suggestions,
  errors,
  priceLabel,
  currencySymbol,
  fid,
  onChange,
}: {
  label: string;
  rows: VariationFormRow[];
  suggestions: string[];
  errors: VariationErrors | undefined;
  priceLabel: string;
  currencySymbol: string;
  fid: (key: string) => string;
  onChange: (change: { label?: string; rows?: VariationFormRow[] }) => void;
}) {
  // Where focus goes after adding or removing a row (once the row is on the screen).
  const pendingFocus = useRef<string | null>(null);
  const setFocusKey = (id: string | null) => {
    pendingFocus.current = id;
  };
  useEffect(() => {
    if (!pendingFocus.current) return;
    document.getElementById(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  });

  const word = label.trim() || "variation";
  const blank = (): VariationFormRow => ({ key: newVariationKey(), id: "", name: "", price: "", usual: false });
  const setRow = (key: string, change: Partial<VariationFormRow>) =>
    onChange({ rows: rows.map((r) => (r.key === key ? { ...r, ...change } : r)) });
  // A usual row whose name was cleared can't be shown in the list, so it reads as none until named.
  const usualKey = rows.find((r) => r.usual && r.name.trim() !== "")?.key ?? "none";

  return (
    <div className="space-y-4">
      <TextField
        id={fid("variationLabel")}
        label="Variation name"
        placeholder={suggestions[0] ? `e.g. ${suggestions[0]}` : undefined}
        autoComplete="off"
        maxLength={40}
        value={label}
        error={errors?.label}
        onChange={(v) => onChange({ label: v })}
      />

      {/* One line each: the name, its price and a remove button, under shared headings. */}
      <div className="space-y-2">
        <div aria-hidden="true" className="grid grid-cols-[1fr_7.5rem_2.75rem] items-end gap-2 text-sm font-medium">
          <span>Choice</span>
          <span>{priceLabel}</span>
          <span />
        </div>
        <ol className="space-y-2">
          {rows.map((row, i) => {
            const rowErrors = errors?.rows[row.key];
            const title = row.name.trim() || `${word} ${i + 1}`;
            return (
              <li key={row.key} className="grid grid-cols-[1fr_7.5rem_2.75rem] items-start gap-2">
                <TextField
                  id={fid(`variation-${row.key}-name`)}
                  label={`${word} ${i + 1}`}
                  labelHidden
                  autoComplete="off"
                  maxLength={80}
                  value={row.name}
                  error={rowErrors?.name}
                  onChange={(v) => setRow(row.key, { name: v })}
                />
                <TextField
                  id={fid(`variation-${row.key}-price`)}
                  label={priceLabel.replace(/^Price/, `${word} ${i + 1} price`)}
                  labelHidden
                  startText={currencySymbol}
                  inputMode="decimal"
                  autoComplete="off"
                  value={row.price}
                  error={rowErrors?.price}
                  onChange={(v) => setRow(row.key, { price: v })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  aria-label={`Remove ${title}`}
                  onClick={() => {
                    const next = rows.filter((r) => r.key !== row.key);
                    onChange({ rows: next });
                    // With none left this section goes away, and the form puts focus on the "No" answer.
                    setFocusKey(next.length > 0 ? fid(`variation-${next[Math.max(0, i - 1)].key}-name`) : null);
                  }}
                >
                  <Trash2Icon aria-hidden="true" />
                </Button>
              </li>
            );
          })}
        </ol>
      </div>

      <SelectField
        id={fid("variationUsual")}
        label={`Usual ${word.toLowerCase()}`}
        hint="Chosen for you when you add it to a quote. With none, you choose each time."
        value={usualKey === "none" ? "" : usualKey}
        onChange={(key) => onChange({ rows: rows.map((r) => ({ ...r, usual: r.key === key })) })}
        placeholder="None: I choose each time"
        options={rows.filter((r) => r.name.trim() !== "").map((r) => r.key)}
        optionLabels={Object.fromEntries(rows.map((r) => [r.key, r.name.trim()]))}
      />

      {errors?.list && (
        <p id={fid("variations")} tabIndex={-1} className="text-sm text-destructive">
          {errors.list}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() => {
          const row = blank();
          onChange({ rows: [...rows, row] });
          setFocusKey(fid(`variation-${row.key}-name`));
        }}
      >
        Add another choice
      </Button>
    </div>
  );
}
