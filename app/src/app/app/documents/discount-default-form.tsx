"use client";

import { useState, useTransition } from "react";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { Section, TextField } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { saveDiscountDefault, type DiscountDefaultState } from "./discount-actions";
import { FormErrorScope } from "@/components/form-errors";

type Kind = "none" | "percent" | "fixed";

/**
 * Quotes and invoices > Discount: the discount on the whole quote that a new quote starts with, for a business that
 * usually gives one. Each quote can change it or take it off; changing it here never changes a quote that exists.
 */
export function DiscountDefaultForm({ initial, symbol }: { initial: { kind: Kind; value: string }; symbol: string }) {
  const [choice, setChoice] = useState<Kind>(initial.kind);
  const hasAmount = choice !== "none";
  const [value, setValue] = useState(initial.value);
  const [state, setState] = useState<DiscountDefaultState>({ status: "idle" });
  const [tries, setTries] = useState(0);
  const [editedSinceSave, setEditedSinceSave] = useState(false);
  const [pending, startTransition] = useTransition();

  const errors = state.status === "error" ? (state.errors ?? {}) : {};
  const problems: FormProblem[] = errors.discountValue ? [{ fieldId: "defaultDiscountValue", label: "Discount", message: errors.discountValue }] : [];

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditedSinceSave(false);
    startTransition(async () => {
      try {
        setState(await saveDiscountDefault({ kind: choice, value: hasAmount ? value : "" }));
      } catch {
        setState({ status: "error", message: "Couldn't reach the server, so nothing was saved. Check your connection and try again." });
      }
      setTries((n) => n + 1);
    });
  }

  return (
    <FormErrorScope epoch={tries}>
      <form onSubmit={submit} className="space-y-4" noValidate id="discount-default">
        <Section title="Discount">
          <p className="text-base text-muted-foreground">
            If you usually give a discount, set it here and every new quote starts with it open. You can change it or
            take it off on any quote.
          </p>
          <FormSummary problems={problems} trigger={tries} />
          {state.status === "error" && state.message && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}
          <Field>
            <FieldLabel htmlFor="defaultDiscountKind">On a new quote</FieldLabel>
            <NativeSelect
              id="defaultDiscountKind"
              value={choice}
              onChange={(e) => {
                setEditedSinceSave(true);
                setState((s) => (s.status === "error" ? { status: "idle" } : s));
                const next = e.target.value;
                setChoice(next === "percent" || next === "fixed" ? next : "none");
                setValue("");
              }}
            >
              <NativeSelectOption value="none">No discount</NativeSelectOption>
              <NativeSelectOption value="percent">A percentage</NativeSelectOption>
              <NativeSelectOption value="fixed">An amount</NativeSelectOption>
            </NativeSelect>
          </Field>
          {hasAmount && (
            <TextField
              id="defaultDiscountValue"
              label={choice === "percent" ? "Discount (%)" : "Discount amount"}
              startText={choice === "fixed" ? symbol : undefined}
              inputMode="decimal"
              autoComplete="off"
              value={value}
              error={errors.discountValue}
              onChange={(v) => {
                setEditedSinceSave(true);
                setValue(v);
              }}
            />
          )}
        </Section>
        <div className="flex items-center gap-4">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : "Save discount"}
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
