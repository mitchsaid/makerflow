"use client";

import { useState, useTransition } from "react";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { TextField } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { SetupAnswers } from "@/lib/quotes/setup";
import { saveQuoteSetup, skipQuoteSetup, type QuoteSetupState } from "./setup-actions";

/**
 * The first New quote of a business: two questions that set what a new quote starts with (a deposit, and
 * delivery or collection). Shown instead of the empty form, once, to owners and admins. When it is done
 * the page shows the form, started the way they said. Nothing is locked: each quote can change both.
 */
export function QuoteSetup() {
  const [deposit, setDeposit] = useState<SetupAnswers["deposit"]>("no");
  const [percent, setPercent] = useState("50");
  const [fulfilment, setFulfilment] = useState<SetupAnswers["fulfilment"]>("varies");
  const [state, setState] = useState<QuoteSetupState | null>(null);
  const [tries, setTries] = useState(0);
  const [pending, startTransition] = useTransition();

  const errors = state?.status === "error" ? (state.errors ?? {}) : {};
  const problems: FormProblem[] = errors.depositValue
    ? [{ fieldId: "setupDepositPercent", label: "Deposit", message: errors.depositValue }]
    : [];

  function run(action: () => Promise<QuoteSetupState>) {
    startTransition(async () => {
      try {
        setState(await action());
      } catch {
        setState({ status: "error", message: "Couldn't reach the server, so nothing was saved. Check your connection and try again." });
      }
      setTries((n) => n + 1);
    });
  }

  return (
    <form
      noValidate
      className="space-y-4"
      aria-labelledby="quote-setup-title"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => saveQuoteSetup({ deposit, depositPercent: percent, fulfilment }));
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle id="quote-setup-title" className="text-lg">
            Two quick questions
          </CardTitle>
          <CardDescription className="text-base">
            So your quotes start the way you work. They only set where a new quote begins: you can change anything on a
            quote, and change these answers any time under Quotes and invoices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <FormSummary problems={problems} trigger={tries} />
          {state?.status === "error" && state.message && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}

          <FieldSet>
            <FieldLegend variant="label" className="text-base">
              Do you usually ask for a deposit?
            </FieldLegend>
            <RadioGroup aria-label="Do you usually ask for a deposit?" value={deposit} onValueChange={(v) => setDeposit(v as SetupAnswers["deposit"])}>
              {(
                [
                  ["no", "No"],
                  ["yes", "Yes, to start work"],
                ] as const
              ).map(([value, label]) => (
                <Field key={value} orientation="horizontal" className="items-start py-2.5">
                  <RadioGroupItem id={`setup-deposit-${value}`} value={value} />
                  <FieldLabel htmlFor={`setup-deposit-${value}`} className="text-base">
                    {label}
                  </FieldLabel>
                </Field>
              ))}
            </RadioGroup>
            {deposit === "yes" && (
              <TextField
                id="setupDepositPercent"
                label="How much, as a percentage of the total?"
                hint="You can change this on any quote."
                inputMode="decimal"
                autoComplete="off"
                value={percent}
                error={errors.depositValue}
                onChange={setPercent}
              />
            )}
          </FieldSet>

          <FieldSet>
            <FieldLegend variant="label" className="text-base">
              How do customers get their order?
            </FieldLegend>
            <RadioGroup
              aria-label="How do customers get their order?"
              value={fulfilment}
              onValueChange={(v) => setFulfilment(v as SetupAnswers["fulfilment"])}
            >
              {(
                [
                  ["collection", "They collect it"],
                  ["delivery", "I deliver it"],
                  ["varies", "It varies"],
                ] as const
              ).map(([value, label]) => (
                <Field key={value} orientation="horizontal" className="items-start py-2.5">
                  <RadioGroupItem id={`setup-fulfilment-${value}`} value={value} />
                  <FieldLabel htmlFor={`setup-fulfilment-${value}`} className="text-base">
                    {label}
                  </FieldLabel>
                </Field>
              ))}
            </RadioGroup>
          </FieldSet>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Saving…" : "Save and start my quote"}
            </Button>
            <Button type="button" size="lg" variant="outline" disabled={pending} onClick={() => run(skipQuoteSetup)}>
              Skip for now
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
