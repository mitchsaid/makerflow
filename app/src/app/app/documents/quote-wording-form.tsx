"use client";

import { useState, useTransition } from "react";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { Section, TextAreaField, TextField } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { QUOTE_DESCRIPTION_MAX, QUOTE_PAYMENT_MAX, QUOTE_SIGN_OFF_MAX } from "@/lib/quotes";
import { saveQuoteWording, type WordingErrors, type WordingState, type WordingValues } from "./wording-actions";
import { FormErrorScope } from "@/components/form-errors";

/**
 * Quotes and invoices > Quote wording: what every new quote starts with. Each quote can change its
 * own copy; changing these never changes a quote that already exists.
 */
export function QuoteWordingForm({ initial, otherWaysHint }: { initial: WordingValues; otherWaysHint: string }) {
  const [values, setValues] = useState(initial);
  const [state, setState] = useState<WordingState>({ status: "idle" });
  const [tries, setTries] = useState(0);
  const [editedSinceSave, setEditedSinceSave] = useState(false);
  const [pending, startTransition] = useTransition();

  const errors: WordingErrors = state.status === "error" ? (state.errors ?? {}) : {};
  const problems: FormProblem[] = (
    [
      ["wordingDescription", "Introduction", errors.description],
      ["wordingSignOff", "Sign-off message", errors.signOff],
      ["wordingPayment", "Notes about paying", errors.paymentInstructions],
    ] as const
  ).flatMap(([fieldId, label, message]) => (message ? [{ fieldId, label, message }] : []));

  const set =
    <K extends keyof WordingValues>(key: K) =>
    (value: string) => {
      setEditedSinceSave(true);
      setValues((v) => ({ ...v, [key]: value }));
    };

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditedSinceSave(false);
    startTransition(async () => {
      try {
        setState(await saveQuoteWording(values));
      } catch {
        setState({
          status: "error",
          message: "Couldn't reach the server, so nothing was saved. Check your connection and try again.",
        });
      }
      setTries((n) => n + 1);
    });
  }

  return (
    <FormErrorScope epoch={tries}>
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Section title="Quote wording">
        <p className="text-base text-muted-foreground">
          What every new quote starts with. You can change it on any quote, and changing it here never
          changes a quote you have already made.
        </p>
        <FormSummary problems={problems} trigger={tries} />
        {state.status === "error" && state.message && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}
        <TextAreaField
          id="wordingDescription"
          name="description"
          label="Introduction (optional)"
          hint="A short introduction, printed at the top of every new quote."
          value={values.description}
          error={errors.description}
          onChange={set("description")}
          maxLength={QUOTE_DESCRIPTION_MAX}
        />
        <TextField
          id="wordingSignOff"
          name="signOff"
          label="Sign-off message (optional)"
          autoComplete="off"
          maxLength={QUOTE_SIGN_OFF_MAX}
          value={values.signOff}
          error={errors.signOff}
          onChange={set("signOff")}
          hint="Shown at the end of the quote, with your business name."
        />
        <TextAreaField
          id="wordingPayment"
          name="paymentInstructions"
          label="Notes about paying (optional)"
          hint={`What a new quote says about paying, besides your bank details (they are kept in your Business profile and print first). For example, ${otherWaysHint}`}
          value={values.paymentInstructions}
          error={errors.paymentInstructions}
          onChange={set("paymentInstructions")}
          maxLength={QUOTE_PAYMENT_MAX}
        />
      </Section>
      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save quote wording"}
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
