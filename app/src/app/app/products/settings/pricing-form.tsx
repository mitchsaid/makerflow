"use client";

import { useState, useTransition } from "react";
import { FormErrorScope } from "@/components/form-errors";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { Section, TextField } from "@/components/form-fields";
import { SaveButton } from "@/components/save-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { savePricing, type PricingSaveState } from "./pricing-actions";

type Values = { labourRate: string; targetMargin: string };

/**
 * Product settings > Pricing: what an hour of your time is worth (costs "Your time" lines on products) and the margin
 * you aim for (says where a price stands and suggests one). Both optional, saved together with one Save. They moved
 * here from the Business profile, which holds facts about the business (docs/plans/ux-pass-2.md, E).
 */
export function PricingForm({ initial, currencySymbol }: { initial: Values; currencySymbol: string }) {
  const [values, setValues] = useState<Values>(initial);
  const [state, setState] = useState<PricingSaveState | null>(null);
  const [editedSinceSave, setEditedSinceSave] = useState(false);
  const [pending, startTransition] = useTransition();
  const errors = state?.status === "error" ? (state.errors ?? {}) : {};
  const problems: FormProblem[] = (
    [
      ["labourRate", "Price of an hour of your time"],
      ["targetMargin", "Margin you aim for"],
    ] as const
  ).flatMap(([field, label]) => {
    const message = errors[field];
    return message ? [{ fieldId: field, label, message }] : [];
  });

  const set = (key: keyof Values) => (value: string) => {
    setEditedSinceSave(true);
    setValues((v) => ({ ...v, [key]: value }));
  };

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditedSinceSave(false);
    startTransition(async () => {
      try {
        setState(await savePricing(values));
      } catch {
        setState({ status: "error", message: "Couldn't reach the server, so nothing was saved. Try again. Nothing you typed is lost." });
      }
    });
  }

  return (
    <FormErrorScope epoch={state}>
      <form onSubmit={submit} className="space-y-6" noValidate>
        <Section title="What your time is worth">
          <TextField
            id="labourRate"
            label="Price of an hour of your time"
            hint="Used to cost your time on products."
            inputMode="decimal"
            autoComplete="off"
            startText={currencySymbol}
            value={values.labourRate}
            error={errors.labourRate}
            onChange={set("labourRate")}
          />
        </Section>
        <Section title="The margin you aim for">
          <TextField
            id="targetMargin"
            label="Margin you aim for (%)"
            hint="What is left of the price after costs. Used to suggest prices."
            inputMode="decimal"
            autoComplete="off"
            value={values.targetMargin}
            error={errors.targetMargin}
            onChange={set("targetMargin")}
          />
        </Section>
        {state?.status === "error" && state.message && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}
        <FormSummary problems={problems} trigger={state} />
        {state?.status === "saved" && !pending && !editedSinceSave && (
          <p role="status" className="text-base">
            Saved.
          </p>
        )}
        <SaveButton what="pricing" pending={pending} />
      </form>
    </FormErrorScope>
  );
}
