"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useFieldError } from "./form-errors";
import { parseQuantity, type NumberStyle } from "@/lib/money";
import { stepQuantityText } from "@/lib/quotes/units";

/**
 * How the app asks for "how many" or "how much" (docs/ux-inputs.md, "Quantity"): a number box with the decimal keypad
 * and, where a few more or fewer is the usual change, minus and plus buttons beside it (the same buttons as counting
 * what is made on a job). The unit, when there is one, is written after the box. The value is the text typed; the
 * form reads it with `parseQuantity`.
 */
export function QuantityField({
  id,
  name,
  label,
  hint,
  value,
  onChange,
  error: errorProp,
  unit,
  stepper = false,
  numberStyle,
  min = 1000,
  labelHidden = false,
  placeholder,
}: {
  id: string;
  name?: string;
  label: string;
  /** Help under the label (above the box), tied to the box for screen readers. */
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /** "kg", "dozen": written after the box. */
  unit?: string;
  /** Minus and plus buttons. Needs `numberStyle` (to write the number the way the country does). */
  stepper?: boolean;
  numberStyle?: NumberStyle;
  /** The least a tap on minus gives (thousandths): 1000 is one. */
  min?: number;
  labelHidden?: boolean;
  placeholder?: string;
}) {
  const { error, markEdited } = useFieldError(id, errorProp);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");
  const current = parseQuantity(value);
  const step = (direction: 1 | -1) => {
    if (!numberStyle) return;
    markEdited();
    onChange(stepQuantityText(value, direction, numberStyle, min));
  };
  return (
    <Field data-invalid={!!error}>
      <FieldLabel id={`${id}-label`} htmlFor={id} className={labelHidden ? "sr-only" : undefined}>
        {label}
      </FieldLabel>
      {hint && (
        <p id={`${id}-hint`} className="-mt-1 text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      <div className="flex items-center gap-2">
        {stepper && numberStyle && (
          <Button type="button" variant="outline" size="icon" aria-label="One less" aria-describedby={`${id}-label`} disabled={current.ok && current.value <= min} onClick={() => step(-1)}>
            <MinusIcon aria-hidden="true" />
          </Button>
        )}
        <Input
          id={id}
          name={name ?? id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            markEdited();
            onChange(e.target.value);
          }}
          aria-invalid={!!error}
          aria-describedby={describedBy || undefined}
          className={stepper ? "min-w-0 flex-1 text-center" : undefined}
        />
        {stepper && numberStyle && (
          <Button type="button" variant="outline" size="icon" aria-label="One more" aria-describedby={`${id}-label`} onClick={() => step(1)}>
            <PlusIcon aria-hidden="true" />
          </Button>
        )}
        {unit && <span className="shrink-0 text-base text-muted-foreground">{unit}</span>}
      </div>
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  );
}
