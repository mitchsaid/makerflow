"use client";

import { useState, useTransition } from "react";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { Section, TextField } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { FormErrorScope } from "@/components/form-errors";

export type DefaultAmountKind = "none" | "ask" | "percent" | "fixed";
export type DefaultAmountState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message?: string; errors?: Partial<Record<string, string>> };

/**
 * Quotes and invoices: what a new quote starts with for something that is nothing, a percentage of the total or an amount
 * (the deposit, the discount on the whole quote). One form for both, so they ask the same way; each says its own words.
 * Changing it here never changes a quote that exists, and each quote can change it.
 */
export function DefaultAmountForm({
  formId,
  title,
  intro,
  selectId,
  selectLabel,
  options,
  valueId,
  valueLabels,
  valueErrorKey,
  summaryLabel,
  submitLabel,
  initial,
  symbol,
  save,
}: {
  formId: string;
  title: string;
  intro: string;
  selectId: string;
  /** The select's label: it names what it is for ("Deposit on a new quote"), as the page has more than one. */
  selectLabel: string;
  /** The choices, in order; "percent" and "fixed" ask for an amount. */
  options: { value: DefaultAmountKind; label: string }[];
  valueId: string;
  valueLabels: { percent: string; fixed: string };
  /** Which key of the action's errors belongs to the amount. */
  valueErrorKey: string;
  /** What the form summary calls the amount ("Deposit"). */
  summaryLabel: string;
  submitLabel: string;
  initial: { kind: DefaultAmountKind; value: string };
  symbol: string;
  save: (values: { kind: DefaultAmountKind; value: string }) => Promise<DefaultAmountState>;
}) {
  const [choice, setChoice] = useState<DefaultAmountKind>(initial.kind);
  const hasAmount = choice === "percent" || choice === "fixed";
  const [value, setValue] = useState(initial.value);
  const [state, setState] = useState<DefaultAmountState>({ status: "idle" });
  const [tries, setTries] = useState(0);
  const [editedSinceSave, setEditedSinceSave] = useState(false);
  const [pending, startTransition] = useTransition();

  const errors = state.status === "error" ? (state.errors ?? {}) : {};
  const amountError = errors[valueErrorKey];
  const problems: FormProblem[] = amountError ? [{ fieldId: valueId, label: summaryLabel, message: amountError }] : [];

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditedSinceSave(false);
    startTransition(async () => {
      try {
        setState(await save({ kind: choice, value: hasAmount ? value : "" }));
      } catch {
        setState({ status: "error", message: "Couldn't reach the server, so nothing was saved. Try again." });
      }
      setTries((n) => n + 1);
    });
  }

  return (
    <FormErrorScope epoch={tries}>
      <form onSubmit={submit} className="space-y-4" noValidate id={formId}>
        <Section title={title}>
          <p className="text-base text-muted-foreground">{intro}</p>
          <FormSummary problems={problems} trigger={tries} />
          {state.status === "error" && state.message && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}
          <Field>
            <FieldLabel htmlFor={selectId}>{selectLabel}</FieldLabel>
            <NativeSelect
              id={selectId}
              value={choice}
              onChange={(e) => {
                setEditedSinceSave(true);
                // A different kind starts again: the old "enter a percentage" no longer applies.
                setState((s) => (s.status === "error" ? { status: "idle" } : s));
                const next = options.find((o) => o.value === e.target.value)?.value ?? "none";
                setChoice(next);
                setValue("");
              }}
            >
              {options.map((o) => (
                <NativeSelectOption key={o.value} value={o.value}>
                  {o.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          {hasAmount && (
            <TextField
              id={valueId}
              label={choice === "percent" ? valueLabels.percent : valueLabels.fixed}
              startText={choice === "fixed" ? symbol : undefined}
              inputMode="decimal"
              autoComplete="off"
              value={value}
              error={amountError}
              onChange={(v) => {
                setEditedSinceSave(true);
                setValue(v);
              }}
            />
          )}
        </Section>
        <div className="flex items-center gap-4">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </Button>
          {state.status === "saved" && !editedSinceSave && (
            <p role="status" className="text-base">
              Saved.
            </p>
          )}
        </div>
      </form>
    </FormErrorScope>
  );
}
