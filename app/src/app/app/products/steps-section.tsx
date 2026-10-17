"use client";

import { useEffect, useRef } from "react";
import { ChevronDownIcon, ChevronUpIcon, Trash2Icon } from "lucide-react";
import { AddButton } from "@/components/add-button";
import { ChoiceCards } from "@/components/choice-cards";
import { Section, SelectField, TextField } from "@/components/form-fields";
import { QuantityField } from "@/components/quantity-field";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  moveStep,
  STEP_CONDITIONS_MAX,
  STEPS_MAX,
  type StepConditionFormRow,
  type StepErrors,
  type StepFormRow,
  type StepLogic,
} from "@/lib/products/steps";

// New rows' keys come from one counter that is never reset (the form keeps rows by key).
let keyCounter = 0;
export const newStepKey = () => `step-new-${(keyCounter += 1)}`;
const newConditionKey = () => `cond-new-${(keyCounter += 1)}`;

/** What a condition can point at: the value is "variation:KEY", "value:LISTKEY/VALUEKEY" or "extra:KEY". */
export type StepChoiceOption = { value: string; label: string };

const QUANTITY = "quantity";

/**
 * "Production steps" (docs/plans/quantity-prices-and-steps.md): the steps a product is made in, in order. A job made
 * from it shows them for each item, with how many have been through each. Move up and move down are buttons: they
 * work by keyboard and on a phone, where dragging does not. A step can be made only for some items (slice 4): each
 * condition is a choice made on the item (a variation, a choice in a list, an extra) or a quantity, with "all of these"
 * or "any of these" when there are several.
 */
export function StepsSection({
  title,
  tracked,
  onTrackedChange,
  rows,
  errors,
  choices,
  unit,
  fid,
  onChange,
}: {
  title: string;
  /** True: counted step by step on a job. False (the usual): counted as a whole, and the steps below are not shown. */
  tracked: boolean;
  onTrackedChange: (tracked: boolean) => void;
  rows: StepFormRow[];
  errors: StepErrors | undefined;
  /** The variations, list choices and extras the product has, named. */
  choices: StepChoiceOption[];
  /** What the product is counted in ("dozen"), written after a quantity. */
  unit?: string;
  fid: (key: string) => string;
  onChange: (rows: StepFormRow[]) => void;
}) {
  // Where focus goes after a row is added, moved or removed (once it is on the screen).
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingFocus.current) return;
    document.getElementById(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  });
  const setName = (key: string, name: string) => onChange(rows.map((r) => (r.key === key ? { ...r, name } : r)));
  const nameId = (key: string) => fid(`step-${key}-name`);
  const setRow = (key: string, change: Partial<StepFormRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...change } : r)));

  return (
    <Section title={title}>
      <ChoiceCards
        legend="How do you track it on a job?"
        value={tracked ? "steps" : "whole"}
        onChange={(v) => onTrackedChange(v === "steps")}
        idFor={(v) => fid(`tracked-${v}`)}
        choices={[
          { value: "whole", title: "As a whole", hint: "Count how many are made." },
          { value: "steps", title: "As steps", hint: "Count how many have been through each step." },
        ]}
      />
      {tracked && rows.length > 0 && (
        <ol className="space-y-3" aria-label={title}>
          {rows.map((row, i) => {
            const name = row.name.trim() || `step ${i + 1}`;
            return (
              <li key={row.key} className="grid grid-cols-[1fr_auto] items-start gap-x-2 gap-y-1">
                <TextField
                  id={nameId(row.key)}
                  label={`Step ${i + 1}`}
                  autoComplete="off"
                  maxLength={120}
                  placeholder={i === 0 ? "e.g. Bake" : undefined}
                  value={row.name}
                  error={errors?.rows[row.key]?.name}
                  onChange={(v) => setName(row.key, v)}
                />
                <div className="mt-8 flex">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Move ${name} up`}
                    disabled={i === 0}
                    onClick={() => {
                      onChange(moveStep(rows, i, -1));
                      pendingFocus.current = nameId(row.key);
                    }}
                  >
                    <ChevronUpIcon aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Move ${name} down`}
                    disabled={i === rows.length - 1}
                    onClick={() => {
                      onChange(moveStep(rows, i, 1));
                      pendingFocus.current = nameId(row.key);
                    }}
                  >
                    <ChevronDownIcon aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    aria-label={`Remove ${name}`}
                    onClick={() => {
                      const next = rows.filter((r) => r.key !== row.key);
                      onChange(next);
                      pendingFocus.current = next.length > 0 ? nameId(next[Math.max(0, i - 1)].key) : fid("add-step");
                    }}
                  >
                    <Trash2Icon aria-hidden="true" />
                  </Button>
                </div>
                <Conditions
                  row={row}
                  stepName={name}
                  choices={choices}
                  unit={unit}
                  errors={errors?.rows[row.key]}
                  fid={fid}
                  onChange={(change) => setRow(row.key, change)}
                />
              </li>
            );
          })}
        </ol>
      )}
      {tracked && errors?.list && (
        <p id={fid("steps-error")} tabIndex={-1} className="text-sm text-destructive">
          {errors.list}
        </p>
      )}
      {tracked && rows.length < STEPS_MAX && (
        <AddButton
          id={fid("add-step")}
          className="self-start"
          onClick={() => {
            const row: StepFormRow = { key: newStepKey(), name: "", logic: "all", conditions: [] };
            onChange([...rows, row]);
            pendingFocus.current = nameId(row.key);
          }}
        >
          {rows.length === 0 ? "Add a step" : "Add another step"}
        </AddButton>
      )}
    </Section>
  );
}

function Conditions({
  row,
  stepName,
  choices,
  unit,
  errors,
  fid,
  onChange,
}: {
  row: StepFormRow;
  stepName: string;
  choices: StepChoiceOption[];
  unit?: string;
  errors: StepErrors["rows"][string] | undefined;
  fid: (key: string) => string;
  onChange: (change: Partial<StepFormRow>) => void;
}) {
  const { conditions } = row;
  const base = fid(`step-${row.key}`);
  // Where focus goes after a condition is added or removed (once it is on the screen).
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingFocus.current) return;
    document.getElementById(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  });
  const setCondition = (key: string, change: Partial<StepConditionFormRow>) =>
    onChange({ conditions: conditions.map((c) => (c.key === key ? { ...c, ...change } : c)) });

  return (
    <div className="col-span-2 space-y-3">
      {conditions.length > 0 && (
        <div role="group" aria-label={`When to make ${stepName}`} className="space-y-3 border-l-2 border-border pl-3">
          {conditions.length > 1 && (
            <Field>
              <FieldLabel htmlFor={`${base}-logic`}>Make this step when</FieldLabel>
              <NativeSelect id={`${base}-logic`} value={row.logic} onChange={(e) => onChange({ logic: e.target.value as StepLogic })}>
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
