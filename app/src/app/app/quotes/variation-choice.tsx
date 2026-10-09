"use client";

import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export type VariationOption = { key: string; name: string; priceText: string; note?: string };

/**
 * "Choose a size": the product's variations as large rows with their prices (docs/plans/product-choices.md).
 * The first one's id is the target of the summary's link when nothing is chosen.
 */
export function VariationChoice({
  id,
  word,
  options,
  value,
  error,
  onChange,
}: {
  id: string;
  /** The product's word for the list ("Size"). */
  word: string;
  options: VariationOption[];
  /** The chosen option's key, or "" for none. */
  value: string;
  error?: string;
  onChange: (key: string) => void;
}) {
  const legend = `Choose a ${word.toLowerCase()}`;
  return (
    <FieldSet data-invalid={!!error}>
      <FieldLegend variant="label" className="text-base">
        {legend}
      </FieldLegend>
      <RadioGroup
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={!!error}
        value={value}
        onValueChange={onChange}
        className="gap-2"
      >
        {options.map((o, i) => (
          <Field
            key={o.key}
            orientation="horizontal"
            className="items-center rounded-xl border border-border px-3 py-2.5 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
          >
            <RadioGroupItem id={i === 0 ? id : `${id}-${o.key}`} value={o.key} />
            <FieldLabel htmlFor={i === 0 ? id : `${id}-${o.key}`} className="flex w-full items-baseline justify-between gap-3 text-base">
              <span>
                {o.name}
                {o.note && <span className="block text-sm font-normal text-muted-foreground">{o.note}</span>}
              </span>
              <span className="shrink-0 font-medium">{o.priceText}</span>
            </FieldLabel>
          </Field>
        ))}
      </RadioGroup>
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </FieldSet>
  );
}
