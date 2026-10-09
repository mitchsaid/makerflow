"use client";

import { useEffect, useRef } from "react";
import { Section, SelectField, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import type { VariationErrors, VariationFormRow } from "@/lib/products/variations";

/**
 * "Variations": versions of the product, each with its own price (docs/plans/product-choices.md). The maker
 * names the list ("Size", "Tiers") from suggestions or their own word. With variations the product's
 * single price goes; each row has its own. One can be the usual one, chosen for you on a quote.
 */
export function VariationsSection({
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
  const counter = useRef(0);
  const newKey = () => `new-${(counter.current += 1)}`;
  useEffect(() => {
    if (!pendingFocus.current) return;
    document.getElementById(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  });

  const word = label.trim() || "variation";
  const blank = (): VariationFormRow => ({ key: newKey(), id: "", name: "", price: "", usual: false });
  const setRow = (key: string, change: Partial<VariationFormRow>) =>
    onChange({ rows: rows.map((r) => (r.key === key ? { ...r, ...change } : r)) });
  // A usual row whose name was cleared can't be shown in the list, so it reads as none until named.
  const usualKey = rows.find((r) => r.usual && r.name.trim() !== "")?.key ?? "none";

  if (rows.length === 0) {
    return (
      <Section title="Variations">
        <p className="text-base text-muted-foreground">
          Does it come in sizes or other versions, each with its own price? Like Small, Medium and Large.
        </p>
        <Button
          id={fid("add-variations")}
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => {
            const first = blank();
            onChange({ label: label || suggestions[0] || "Size", rows: [first, blank()] });
            setFocusKey(fid(`variation-${first.key}-name`));
          }}
        >
          Add variations
        </Button>
      </Section>
    );
  }

  return (
    <Section title="Variations">
      <p className="text-base text-muted-foreground">
        Each has its own price. On a quote you choose one.
      </p>
      <TextField
        id={fid("variationLabel")}
        label="What do you call them?"
        hint="Shown on your quotes, like “Choose a size”."
        autoComplete="off"
        maxLength={40}
        value={label}
        error={errors?.label}
        onChange={(v) => onChange({ label: v })}
      />
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Suggestions">
          {suggestions.map((s) => (
            <Button
              key={s}
              type="button"
              variant="outline"
              aria-pressed={label.trim().toLowerCase() === s.toLowerCase()}
              className="aria-pressed:border-primary aria-pressed:bg-primary/5"
              onClick={() => onChange({ label: s })}
            >
              {s}
            </Button>
          ))}
        </div>
      )}

      <ol className="space-y-4">
          {rows.map((row, i) => {
            const rowErrors = errors?.rows[row.key];
            const title = row.name.trim() || `${word} ${i + 1}`;
            return (
              <li key={row.key} className="space-y-3 rounded-xl border border-border p-3">
                <div className="grid grid-cols-[1fr_8rem] gap-3">
                  <TextField
                    id={fid(`variation-${row.key}-name`)}
                    label={`${word} ${i + 1}`}
                    autoComplete="off"
                    maxLength={80}
                    value={row.name}
                    error={rowErrors?.name}
                    onChange={(v) => setRow(row.key, { name: v })}
                  />
                  <TextField
                    id={fid(`variation-${row.key}-price`)}
                    label={priceLabel.replace(/^Price/, `${word} ${i + 1} price`)}
                    startText={currencySymbol}
                    inputMode="decimal"
                    autoComplete="off"
                    value={row.price}
                    error={rowErrors?.price}
                    onChange={(v) => setRow(row.key, { price: v })}
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => {
                      const next = rows.filter((r) => r.key !== row.key);
                      onChange({ rows: next });
                      setFocusKey(next.length > 0 ? fid(`variation-${next[Math.max(0, i - 1)].key}-name`) : fid("add-variations"));
                    }}
                  >
                    Remove<span className="sr-only"> {title}</span>
                  </Button>
                </div>
              </li>
            );
          })}
      </ol>

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
        Add another
      </Button>
    </Section>
  );
}
