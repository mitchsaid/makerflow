"use client";

import { useEffect, useRef } from "react";
import { Section, SelectField, TextField } from "@/components/form-fields";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VariationErrors, VariationFormRow } from "@/lib/products/variations";

/**
 * "Variations": versions of the product, each with its own price (docs/plans/product-choices.md). The maker
 * names the list ("Size", "Tiers") from suggestions or their own word. With variations the product's
 * single price goes; each row has its own (the first starts with the product's price, and the last one
 * left gives its price back when it is removed). One can be the usual one, chosen for you on a quote.
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
  children,
}: {
  children?: React.ReactNode;
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
        <p className="text-base text-muted-foreground">What does it come in? Sizes, flavours or other versions.</p>
        <div className="space-y-1">
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
          <p className="text-sm text-muted-foreground">
            Versions that each have their own price, like Small, Medium and Large.
          </p>
        </div>
        {children}
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

      {/* One line each: the name, its price and a remove button, under shared headings. */}
      <div className="space-y-2">
        <div aria-hidden="true" className="grid grid-cols-[1fr_7.5rem_2.75rem] items-end gap-2 text-sm font-medium">
          <span>{word.charAt(0).toUpperCase() + word.slice(1)}</span>
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
                    setFocusKey(next.length > 0 ? fid(`variation-${next[Math.max(0, i - 1)].key}-name`) : fid("add-variations"));
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
        Add another {word.toLowerCase()}
      </Button>
      {children && <div className="space-y-4 border-t border-border pt-4">{children}</div>}
    </Section>
  );
}
