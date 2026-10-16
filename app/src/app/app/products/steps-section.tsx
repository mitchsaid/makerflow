"use client";

import { useEffect, useRef } from "react";
import { ChevronDownIcon, ChevronUpIcon, Trash2Icon } from "lucide-react";
import { AddButton } from "@/components/add-button";
import { Section, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { moveStep, STEPS_MAX, type StepErrors, type StepFormRow } from "@/lib/products/steps";

// New rows' keys come from one counter that is never reset (the form keeps rows by key).
let keyCounter = 0;
export const newStepKey = () => `step-new-${(keyCounter += 1)}`;

/**
 * "Production steps" (docs/plans/quantity-prices-and-steps.md): the steps a product is made in, in order. A job made
 * from it shows them for each item, with how many have been through each. Move up and move down are buttons: they
 * work by keyboard and on a phone, where dragging does not.
 */
export function StepsSection({
  title,
  description,
  rows,
  errors,
  fid,
  onChange,
}: {
  title: string;
  description: string;
  rows: StepFormRow[];
  errors: StepErrors | undefined;
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

  return (
    <Section title={title}>
      <p className="-mt-2 text-base text-muted-foreground">{description}</p>
      {rows.length > 0 && (
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
              </li>
            );
          })}
        </ol>
      )}
      {errors?.list && (
        <p id={fid("steps-error")} tabIndex={-1} className="text-sm text-destructive">
          {errors.list}
        </p>
      )}
      {rows.length < STEPS_MAX && (
        <AddButton
          id={fid("add-step")}
          className="self-start"
          onClick={() => {
            const row: StepFormRow = { key: newStepKey(), name: "" };
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
