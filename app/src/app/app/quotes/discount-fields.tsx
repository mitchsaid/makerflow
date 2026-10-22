"use client";

import { TextField } from "@/components/form-fields";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { DiscountKind } from "@/lib/quotes";

/**
 * "Discount on the whole document": none, a percentage or an amount, and its value. Shared by the quote and the invoice,
 * so the two ask for it the same way.
 */
export function DiscountFields({
  kind,
  value,
  symbol,
  error,
  noun = "quote",
  onKindChange,
  onValueChange,
}: {
  kind: DiscountKind;
  value: string;
  symbol: string;
  error?: string;
  /** What the discount is on, for the label: "quote" or "invoice". */
  noun?: "quote" | "invoice";
  onKindChange: (kind: DiscountKind) => void;
  onValueChange: (value: string) => void;
}) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor="discountKind">Discount on the whole {noun}</FieldLabel>
        <NativeSelect id="discountKind" value={kind} onChange={(e) => onKindChange(e.target.value as DiscountKind)}>
          <NativeSelectOption value="none">No discount</NativeSelectOption>
          <NativeSelectOption value="percent">A percentage</NativeSelectOption>
          <NativeSelectOption value="fixed">An amount</NativeSelectOption>
        </NativeSelect>
      </Field>
      {kind !== "none" && (
        <TextField
          id="discountValue"
          label={kind === "percent" ? "Discount (%)" : "Discount amount"}
          startText={kind === "fixed" ? symbol : undefined}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          error={error}
          onChange={onValueChange}
        />
      )}
    </>
  );
}
