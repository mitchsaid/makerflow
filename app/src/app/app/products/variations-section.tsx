"use client";

import { useEffect, useRef, useState } from "react";
import { SelectField, TextField } from "@/components/form-fields";
import { Trash2Icon } from "lucide-react";
import { ChoiceImage } from "@/components/choice-image";
import { Button } from "@/components/ui/button";
import type { VariationErrors, VariationFormRow } from "@/lib/products/variations";
import { AddButton } from "@/components/add-button";
import type { NumberStyle } from "@/lib/money";
import type { PriceBreakErrors, PriceBreakFormRow } from "@/lib/products/price-breaks";
import { QuantityPrices } from "./quantity-prices-section";

// New rows' keys come from one counter that is never reset (the product form starts the first rows too).
let rowKeyCounter = 0;
export const newVariationKey = () => `new-${(rowKeyCounter += 1)}`;

/**
 * What a product with variations that set its price looks like (docs/plans/product-extras.md): the maker names the
 * variation ("Size", "Tiers"; the business type's first suggestion is shown as an example), and each choice has
 * its own price. It replaces the product's single price (the first row starts with the typed price, and the one
 * left gives its price back when the last is removed). One choice can be the default one, chosen for you on a quote.
 */
export function PricedVariations({
  label,
  rows,
  suggestions,
  errors,
  priceLabel,
  currencySymbol,
  currencyCode,
  numberStyle,
  unit,
  breaks,
  breakErrors,
  onBreaksChange,
  fid,
  onPendingChange,
  onImage,
  onChange,
}: {
  label: string;
  rows: VariationFormRow[];
  suggestions: string[];
  errors: VariationErrors | undefined;
  priceLabel: string;
  currencySymbol: string;
  currencyCode: string;
  numberStyle: NumberStyle;
  /** The product's unit, written beside quantities. */
  unit: string;
  /** All the quantity prices of the form: each choice shows and changes its own. */
  breaks: PriceBreakFormRow[];
  breakErrors: PriceBreakErrors | undefined;
  onBreaksChange: (rows: PriceBreakFormRow[]) => void;
  fid: (key: string) => string;
  /** A choice's picture is on its way (true) or has arrived (false), so the form can wait for it before saving. */
  onPendingChange: (pending: boolean) => void;
  /** A choice's picture chosen or removed. The form applies it by the row's key to what the form holds now. */
  onImage: (rowKey: string, imageId: string) => void;
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

  // The choices are called by the variation's name once it has one ("Size 1"), "Choice" until then.
  // What went wrong with a choice's picture, by row.
  const [problems, setProblems] = useState<Record<string, string>>({});
  const setProblem = (key: string, message: string | null) =>
    setProblems((p) => {
      const rest = { ...p };
      delete rest[key];
      return message ? { ...rest, [key]: message } : rest;
    });

  const word = label.trim() || "Choice";
  const blank = (): VariationFormRow => ({ key: newVariationKey(), id: "", name: "", price: "", usual: false });
  const setRow = (key: string, change: Partial<VariationFormRow>) =>
    onChange({ rows: rows.map((r) => (r.key === key ? { ...r, ...change } : r)) });
  // A default row whose name was cleared can't be shown in the list, so it reads as none until named.
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

      {/* Each choice: its picture, its name and a remove button, then its price (and a way to remove the picture). */}
      <ol className="space-y-3">
        {rows.map((row, i) => {
          const rowErrors = errors?.rows[row.key];
          const title = row.name.trim() || `${word} ${i + 1}`;
          const picture = row.imageId ?? "";
          const problem = problems[row.key];
          return (
            <li key={row.key} className="grid grid-cols-[2.75rem_1fr_2.75rem] items-start gap-x-2 gap-y-2">
              <ChoiceImage
                id={fid(`variation-${row.key}-image`)}
                label={title}
                value={picture}
                onChange={(imageId) => {
                  setProblem(row.key, null);
                  onImage(row.key, imageId);
                }}
                onProblem={(message) => setProblem(row.key, message)}
                onPendingChange={onPendingChange}
              />
              <TextField
                id={fid(`variation-${row.key}-name`)}
                label={`${word} ${i + 1}`}
                labelHidden
                placeholder="Name"
                autoComplete="off"
                maxLength={80}
                value={row.name}
                error={rowErrors?.name}
                onChange={(v) => setRow(row.key, { name: v })}
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
              <div className="col-start-2 col-span-2 flex items-start gap-2">
                <div className="w-40">
                  <TextField
                    id={fid(`variation-${row.key}-price`)}
                    label={priceLabel.replace(/^Price/, `${word} ${i + 1} price`)}
                    labelHidden
                    placeholder="Price"
                    startText={currencySymbol}
                    inputMode="decimal"
                    autoComplete="off"
                    value={row.price}
                    error={rowErrors?.price}
                    onChange={(v) => setRow(row.key, { price: v })}
                  />
                </div>
                {picture !== "" && (
                  <Button type="button" variant="outline" onClick={() => onImage(row.key, "")}>
                    Remove picture<span className="sr-only"> of {title}</span>
                  </Button>
                )}
              </div>
              <div className="col-start-2 col-span-2">
                <QuantityPrices
                  rows={breaks}
                  scope={row.key}
                  scopeName={title}
                  priceText={row.price}
                  unit={unit}
                  currencyCode={currencyCode}
                  currencySymbol={currencySymbol}
                  numberStyle={numberStyle}
                  errors={breakErrors}
                  fid={fid}
                  onChange={onBreaksChange}
                />
              </div>
              {problem && (
                <p role="alert" className="col-start-2 col-span-2 text-sm text-destructive">
                  {problem}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {errors?.list && (
        <p id={fid("variations")} tabIndex={-1} className="text-sm text-destructive">
          {errors.list}
        </p>
      )}
      <AddButton
        className="self-start"
        onClick={() => {
          const row = blank();
          onChange({ rows: [...rows, row] });
          setFocusKey(fid(`variation-${row.key}-name`));
        }}
      >
        Add another choice
      </AddButton>
      <SelectField
        id={fid("variationUsual")}
        label={`Default ${word.toLowerCase()}`}
        hint="Chosen for you on a quote. Without one, you choose each time."
        value={usualKey === "none" ? "" : usualKey}
        onChange={(key) => onChange({ rows: rows.map((r) => ({ ...r, usual: r.key === key })) })}
        placeholder="None: I choose each time"
        options={rows.filter((r) => r.name.trim() !== "").map((r) => r.key)}
        optionLabels={Object.fromEntries(rows.map((r) => [r.key, r.name.trim()]))}
      />
    </div>
  );
}
