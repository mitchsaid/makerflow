"use client";

import { useState, useTransition } from "react";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { Section, TextAreaField, TextField } from "@/components/form-fields";
import { TermsStarters } from "@/components/terms-starters";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { QUOTE_PAYMENT_MAX, QUOTE_SIGN_OFF_MAX, QUOTE_TERMS_MAX } from "@/lib/quotes";
import { saveQuoteWording, type WordingErrors, type WordingState, type WordingValues } from "./wording-actions";

/**
 * Business profile > Quote wording: what every new quote starts with. Each quote can change its
 * own copy; changing these never changes a quote that already exists.
 */
export function QuoteWordingForm({ initial }: { initial: WordingValues }) {
  const [values, setValues] = useState(initial);
  const [state, setState] = useState<WordingState>({ status: "idle" });
  const [tries, setTries] = useState(0);
  const [editedSinceSave, setEditedSinceSave] = useState(false);
  const [pending, startTransition] = useTransition();

  const errors: WordingErrors = state.status === "error" ? (state.errors ?? {}) : {};
  const problems: FormProblem[] = (
    [
      ["wordingSignOff", "Sign-off", errors.signOff],
      ["wordingPayment", "Other ways to pay", errors.paymentInstructions],
      ["wordingTerms", "Terms", errors.terms],
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
        <TextField
          id="wordingSignOff"
          name="signOff"
          label="Sign-off (optional)"
          autoComplete="off"
          maxLength={QUOTE_SIGN_OFF_MAX}
          value={values.signOff}
          error={errors.signOff}
          onChange={set("signOff")}
          hint="Like “Yours in sweetness”. Shown at the end of the quote, with your business name."
        />
        <TextAreaField
          id="wordingPayment"
          name="paymentInstructions"
          label="Other ways to pay (optional)"
          hint="SnapScan, PayShap, or “pay on collection”. Your bank details are kept above, and print first."
          value={values.paymentInstructions}
          error={errors.paymentInstructions}
          onChange={set("paymentInstructions")}
          maxLength={QUOTE_PAYMENT_MAX}
        />
        <TextAreaField
          id="wordingTerms"
          name="terms"
          label="Terms (optional)"
          hint="Shown in small print at the end of the quote."
          value={values.terms}
          error={errors.terms}
          onChange={set("terms")}
          maxLength={QUOTE_TERMS_MAX}
        />
        <TermsStarters terms={values.terms} onChange={set("terms")} />
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
  );
}
