"use client";

import { useEffect, useRef } from "react";
import { Trash2Icon } from "lucide-react";
import { AddButton } from "@/components/add-button";
import { SelectField } from "@/components/form-fields";
import { QuantityField } from "@/components/quantity-field";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { STEP_CONDITIONS_MAX, type StepConditionFormRow, type StepLogic } from "@/lib/products/steps";

let keyCounter = 0;
const newConditionKey = () => `cond-new-${(keyCounter += 1)}`;

/** What a condition can point at: the value is "variation:KEY", "value:LISTKEY/VALUEKEY" or "extra:KEY". */
export type ChoiceOption = { value: string; label: string };

const QUANTITY = "quantity";

/**
 * "Only for some items" (docs/plans/quantity-prices-and-steps.md, slice 4; shared with cost lines): each condition is
 * a choice made on the item (a variation, a choice in a list, an extra) or a quantity, chosen or not, and with several
 * the thing applies when all of them hold, or any. Used by production steps and by cost lines.
 */
export function ConditionsEditor({
  subject,
  logicLabel,
  groupLabel,
  idBase,
  logic,
  conditions,
  choices,
  unit,
  errors,
  onChange,
}: {
  /** What the conditions are on, for screen readers: the step's or cost's name. */
  subject: string;
  /** "Make this step when": the question over "All of these are true". */
  logicLabel: string;
  /** "When to make Bake": the name of the group of conditions. */
  groupLabel: string;
  /** In front of every field id here (must be unique on the form). */
  idBase: string;
  logic: StepLogic;
  conditions: StepConditionFormRow[];
  choices: ChoiceOption[];
  unit?: string;
  errors: { list?: string; conditions?: Record<string, { ref?: string; quantity?: string }> } | undefined;
  onChange: (change: { logic?: StepLogic; conditions?: StepConditionFormRow[] }) => void;
}) {
  const base = idBase;
  // Where focus goes after a condition is added or removed (once it is on the screen).
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingFocus.current) return;
    document.getElementById(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  });
  const setCondition = (key: string, change: Partial<StepConditionFormRow>) =>
    onChange({ conditions: conditions.map((c) => (c.key === key ? { ...c, ...change } : c)) });
  const stepName = subject;

  return (
    <div className="col-span-2 space-y-3">
      {conditions.length > 0 && (
        <div role="group" aria-label={groupLabel} className="space-y-3 border-l-2 border-border pl-3">
          {conditions.length > 1 && (
            <Field>
              <FieldLabel htmlFor={`${base}-logic`}>{logicLabel}</FieldLabel>
              <NativeSelect id={`${base}-logic`} value={logic} onChange={(e) => onChange({ logic: e.target.value as StepLogic })}>
                <NativeSelectOption value="all">All of these are true</NativeSelectOption>
                <NativeSelectOption value="any">Any of these is true</NativeSelectOption>
              </NativeSelect>
            </Field>
          )}
          {conditions.map((c, ci) => {
            const e = errors?.conditions?.[c.key];
            const known = c.kind === "quantity" || c.ref === "" || choices.some((x) => x.value === c.ref);
            const options = known ? choices : [...choices, { value: c.ref, label: "A choice that was removed" }];
            return (
              <div key={c.key} role="group" aria-label={`${stepName}: condition ${ci + 1}`} className="space-y-2">
                <SelectField
                  id={`${base}-c-${c.key}-ref`}
                  label="Depends on"
                  placeholder="Choose…"
                  value={c.kind === "quantity" ? QUANTITY : c.ref}
                  options={[...options.map((x) => x.value), QUANTITY]}
                  optionLabels={{ ...Object.fromEntries(options.map((x) => [x.value, x.label])), [QUANTITY]: "Quantity" }}
                  error={e?.ref}
                  onChange={(v) => setCondition(c.key, v === QUANTITY ? { kind: "quantity", ref: "" } : { kind: "chosen", ref: v })}
                />
                <Field>
                  <FieldLabel htmlFor={`${base}-c-${c.key}-negate`}>{c.kind === "quantity" ? "The quantity is" : "It is"}</FieldLabel>
                  <NativeSelect id={`${base}-c-${c.key}-negate`} value={c.negate ? "not" : "is"} onChange={(ev) => setCondition(c.key, { negate: ev.target.value === "not" })}>
                    <NativeSelectOption value="is">{c.kind === "quantity" ? "At least" : "Chosen"}</NativeSelectOption>
                    <NativeSelectOption value="not">{c.kind === "quantity" ? "Less than" : "Not chosen"}</NativeSelectOption>
                  </NativeSelect>
                </Field>
                {c.kind === "quantity" && (
                  <QuantityField
                    id={`${base}-c-${c.key}-quantity`}
                    label="Quantity"
                    unit={unit}
                    value={c.quantity}
                    error={e?.quantity}
                    onChange={(quantity) => setCondition(c.key, { quantity })}
                  />
                )}
                <Button
                  type="button"
                  variant="danger"
                  aria-label={`Remove condition ${ci + 1} of ${stepName}`}
                  onClick={() => {
                    const next = conditions.filter((x) => x.key !== c.key);
                    onChange({ conditions: next });
                    pendingFocus.current = next.length > 0 ? `${base}-c-${next[Math.max(0, ci - 1)].key}-ref` : `${base}-add-condition`;
                  }}
                >
                  <Trash2Icon aria-hidden="true" data-icon="inline-start" />
                  Remove condition
                </Button>
              </div>
            );
          })}
        </div>
      )}
      {errors?.list && <p className="text-sm text-destructive">{errors.list}</p>}
      {conditions.length < STEP_CONDITIONS_MAX && (
        <AddButton
          id={`${base}-add-condition`}
          onClick={() => {
            const added: StepConditionFormRow = { key: newConditionKey(), kind: "chosen", negate: false, ref: "", quantity: "" };
            onChange({ conditions: [...conditions, added] });
            pendingFocus.current = `${base}-c-${added.key}-ref`;
          }}
        >
          {conditions.length === 0 ? "Only for some items" : "Add a condition"}
          <span className="sr-only"> ({stepName})</span>
        </AddButton>
      )}
    </div>
  );
}
