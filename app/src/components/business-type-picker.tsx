"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { BUSINESS_TYPES, type BusinessType } from "@/lib/business-types";

/**
 * The ticks for "what do you make or sell?" Any number can be ticked (a baker who also runs workshops
 * ticks both). Used on the sign-up step, the Business profile and the policies prompt.
 */
export function BusinessTypePicker({
  value,
  onChange,
  idPrefix,
  labelledBy,
}: {
  value: readonly BusinessType[];
  onChange: (value: BusinessType[]) => void;
  idPrefix: string;
  /** The id of the heading or legend that names this group, for screen readers. */
  labelledBy: string;
}) {
  const toggle = (key: BusinessType, on: boolean) =>
    onChange(BUSINESS_TYPES.map((t) => t.key).filter((k) => (k === key ? on : value.includes(k))));
  return (
    <div role="group" aria-labelledby={labelledBy} className="space-y-0">
      {BUSINESS_TYPES.map((t) => (
        <Field key={t.key} orientation="horizontal" className="items-start py-2.5">
          <Checkbox
            id={`${idPrefix}-${t.key}`}
            name="businessTypes"
            value={t.key}
            checked={value.includes(t.key)}
            onCheckedChange={(checked) => toggle(t.key, checked === true)}
          />
          <FieldLabel htmlFor={`${idPrefix}-${t.key}`} className="text-base">
            {t.label}
          </FieldLabel>
        </Field>
      ))}
    </div>
  );
}
