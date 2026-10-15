"use client";

import { useState, useTransition } from "react";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { Section, TextField } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { saveDepositDefault, type DepositDefaultState } from "./deposit-actions";
import { FormErrorScope } from "@/components/form-errors";

/**
 * Quotes and invoices > Deposit: what a new quote starts with. Each quote can change it or switch it
 * off; changing it here never changes a quote that exists.
 */
export function DepositDefaultForm({
  initial,
  symbol,
}: {
  initial: { kind: "none" | "percent" | "fixed" | "ask"; value: string };
  symbol: string;
}) {
  const [choice, setChoice] = useState<"none" | "percent" | "fixed" | "ask">(initial.kind);
  const hasAmount = choice === "percent" || choice === "fixed";
  const [value, setValue] = useState(initial.value);
  const [state, setState] = useState<DepositDefaultState>({ status: "idle" });
  const [tries, setTries] = useState(0);
  const [editedSinceSave, setEditedSinceSave] = useState(false);
  const [pending, startTransition] = useTransition();

  const errors = state.status === "error" ? (state.errors ?? {}) : {};
  const problems: FormProblem[] = errors.depositValue ? [{ fieldId: "defaultDepositValue", label: "Deposit", message: errors.depositValue }] : [];

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditedSinceSave(false);
    startTransition(async () => {
      try {
        setState(await saveDepositDefault({ kind: choice, value: hasAmount ? value : "" }));
      } catch {
        setState({ status: "error", message: "Couldn't reach the server, so nothing was saved. Check your connection and try again." });
      }
      setTries((n) => n + 1);
    });
  }

  return (
    <FormErrorScope epoch={tries}>
    <form onSubmit={submit} className="space-y-4" noValidate id="deposit-default">
      <Section title="Deposit">
        <p className="text-base text-muted-foreground">
          Set what every new quote starts with, or choose “I decide on each quote” and a new quote opens with the
          deposit choice in front of you. You can change it on any quote.
        </p>
        <FormSummary problems={problems} trigger={tries} />
        {state.status === "error" && state.message && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}
        <Field>
          <FieldLabel htmlFor="defaultDepositKind">On a new quote</FieldLabel>
          <NativeSelect
            id="defaultDepositKind"
            value={choice}
            onChange={(e) => {
              setEditedSinceSave(true);
              // A different kind of deposit starts again: the old "enter a percentage" no longer applies.
              setState((s) => (s.status === "error" ? { status: "idle" } : s));
              const next = e.target.value;
              setChoice(next === "percent" || next === "fixed" || next === "ask" ? next : "none");
              setValue("");
            }}
          >
            <NativeSelectOption value="none">No deposit</NativeSelectOption>
            <NativeSelectOption value="ask">I decide on each quote</NativeSelectOption>
            <NativeSelectOption value="percent">A percentage of the total</NativeSelectOption>
            <NativeSelectOption value="fixed">A fixed amount</NativeSelectOption>
          </NativeSelect>
        </Field>
        {hasAmount && (
          <TextField
            id="defaultDepositValue"
            label={choice === "percent" ? "Percentage (%)" : "Amount"}
            startText={choice === "fixed" ? symbol : undefined}
            inputMode="decimal"
            autoComplete="off"
            value={value}
            error={errors.depositValue}
            onChange={(v) => {
              setEditedSinceSave(true);
              setValue(v);
            }}
          />
        )}
      </Section>
      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save deposit"}
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
