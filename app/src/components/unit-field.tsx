"use client";

import { TextField, type ExtraInputProps } from "@/components/form-fields";
import { useBusinessTypes } from "@/components/business-types-context";
import { rankForTypes } from "@/lib/business-types";
import { UNIT_SUGGESTIONS } from "@/lib/quotes/units";

/**
 * A short optional label for what one is ("kg", "dozen", "hour"), with common ones suggested
 * as you type. Anything can be typed; blank means a plain count.
 */
export function UnitField({
  id,
  name,
  label = "Unit (optional)",
  error,
  value,
  onChange,
  hint,
  ...props
}: ExtraInputProps & {
  id: string;
  name?: string;
  label?: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const listId = `${id}-suggestions`;
  const suggestions = rankForTypes(UNIT_SUGGESTIONS, useBusinessTypes());
  return (
    <>
      <TextField
        id={id}
        name={name}
        label={label}
        error={error}
        hint={hint}
        value={value}
        onChange={onChange}
        list={listId}
        autoComplete="off"
        maxLength={20}
        {...props}
      />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s.unit} value={s.unit} />
        ))}
      </datalist>
    </>
  );
}
