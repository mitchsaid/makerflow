"use client";

import type { ReactNode } from "react";
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

/**
 * Pick one of a few, each on its own bordered row with an optional line of help (docs/ux-inputs.md, "Choose one of a
 * few"): the answer to a question about the thing being edited, such as "Does it come in variations?" The chosen row
 * is outlined. The question is the fieldset's legend, and `idFor` gives each row's id (so a summary can jump to it).
 */
export function ChoiceCards<T extends string>({
  legend,
  value,
  onChange,
  choices,
  idFor,
  invalid,
  children,
}: {
  legend: ReactNode;
  value: T;
  onChange: (value: T) => void;
  choices: readonly { value: T; title: string; hint?: string }[];
  idFor: (value: T) => string;
  invalid?: boolean;
  /** Anything that belongs under the choices (a note). */
  children?: ReactNode;
}) {
  return (
    <FieldSet data-invalid={invalid}>
      <FieldLegend variant="label" className="text-base">
        {legend}
      </FieldLegend>
      <RadioGroup value={value} onValueChange={(v) => onChange(v as T)} className="gap-2">
        {choices.map((c) => (
          <Field
            key={c.value}
            orientation="horizontal"
            className="items-center rounded-xl border border-border px-3 py-2.5 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
          >
            <RadioGroupItem id={idFor(c.value)} value={c.value} />
            <FieldLabel htmlFor={idFor(c.value)} className="flex w-full flex-col items-start gap-0.5 text-base">
              <span>{c.title}</span>
              {c.hint && <span className="text-sm font-normal text-muted-foreground">{c.hint}</span>}
            </FieldLabel>
          </Field>
        ))}
      </RadioGroup>
      {children}
    </FieldSet>
  );
}
