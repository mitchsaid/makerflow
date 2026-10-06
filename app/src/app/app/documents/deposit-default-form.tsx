"use client";

import { useState, useTransition } from "react";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { Section, TextField } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { saveDepositDefault, type DepositDefaultState } from "./deposit-actions";

/**
 * Quotes and invoices > Deposit: what a new quote starts with. Each quote can change it or switch it
 * off; changing it here never changes a quote that exists.
 */
export function DepositDefaultForm({
  initial,
  symbol,
}: {
  initial: { kind: "none" | "percent" | "fixed"; value: string };
  symbol: string;
}) {
  const [on, setOn] = useState(initial.kind !== "none");
  const [kind, setKind] = useState<"percent" | "fixed">(initial.kind === "fixed" ? "fixed" : "percent");
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
        setState(await saveDepositDefault({ kind: on ? kind : "none", value: on ? value : "" }));
      } catch {
        setState({ status: "error", message: "Couldn't reach the server, so nothing was saved. Check your connection and try again." });
      }
      setTries((n) => n + 1);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate id="deposit-default">
      <Section title="Deposit">
        <p className="text-base text-muted-foreground">
          If you usually ask for a deposit, set it here and every new quote starts with it. You can change it or
          switch it off on any quote.
        </p>
        <FormSummary problems={problems} trigger={tries} />
        {state.status === "error" && state.message && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}
        <Field orientation="horizontal" className="items-start py-2.5">
          <Checkbox
            id="defaultDepositOn"
            name="defaultDepositOn"
            checked={on}
            onCheckedChange={(checked) => {
              setEditedSinceSave(true);
              setOn(checked === true);
            }}
          />
          <FieldLabel htmlFor="defaultDepositOn" className="text-base">
            Ask for a deposit on new quotes
          </FieldLabel>
        </Field>
        {on && (
          <>
            <Field>
              <FieldLabel htmlFor="defaultDepositKind">Worked out as</FieldLabel>
              <NativeSelect
                id="defaultDepositKind"
                value={kind}
                onChange={(e) => {
                  setEditedSinceSave(true);
                  setKind(e.target.value === "fixed" ? "fixed" : "percent");
                  setValue("");
                }}
              >
                <NativeSelectOption value="percent">A percentage of the total</NativeSelectOption>
                <NativeSelectOption value="fixed">A fixed amount</NativeSelectOption>
              </NativeSelect>
            </Field>
            <TextField
              id="defaultDepositValue"
              label={kind === "percent" ? "Percentage (%)" : "Amount"}
              startText={kind === "fixed" ? symbol : undefined}
              inputMode="decimal"
              autoComplete="off"
              value={value}
              error={errors.depositValue}
              onChange={(v) => {
                setEditedSinceSave(true);
                setValue(v);
              }}
            />
          </>
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
  );
}
