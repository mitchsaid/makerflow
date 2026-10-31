"use client";

import { useState, useTransition } from "react";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import Link from "@/components/app-link";
import { Section, SelectField, TextAreaField, TextField } from "@/components/form-fields";
import { isSignOffAs, SIGN_OFF_CHOICES, SIGN_OFF_OTHER_MAX, signOffChoiceLabels } from "@/lib/quotes/sign-off";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SaveButton } from "@/components/save-button";
import { QUOTE_DESCRIPTION_MAX, QUOTE_PAYMENT_MAX, QUOTE_SIGN_OFF_MAX } from "@/lib/quotes";
import { saveQuoteWording, type WordingErrors, type WordingState, type WordingValues } from "./wording-actions";
import { FormErrorScope } from "@/components/form-errors";

/**
 * Quote settings > Quote wording: what every new quote starts with. Each quote can change its
 * own copy; changing these never changes a quote that already exists.
 */
export function QuoteWordingForm({
  initial,
  paymentNotesHint,
  signers,
}: {
  initial: WordingValues;
  paymentNotesHint: string;
  /** The names a quote can be signed with: the business's, and the owner's when one is saved. */
  signers: { business: string; owner: string | null };
}) {
  const [values, setValues] = useState(initial);
  const [state, setState] = useState<WordingState>({ status: "idle" });
  const [tries, setTries] = useState(0);
  const [editedSinceSave, setEditedSinceSave] = useState(false);
  const [pending, startTransition] = useTransition();

  const errors: WordingErrors = state.status === "error" ? (state.errors ?? {}) : {};
  const problems: FormProblem[] = (
    [
      ["wordingDescription", "Intro", errors.description],
      ["wordingSignOff", "Sign-off", errors.signOff],
      ["wordingSignOffOther", "Name to sign with", errors.signOffOther],
      ["wordingPayment", "Payment notes", errors.paymentInstructions],
    ] as const
  ).flatMap(([fieldId, label, message]) => (message ? [{ fieldId, label, message }] : []));

  const set =
    <K extends Exclude<keyof WordingValues, "signOffAs">>(key: K) =>
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
          message: "Couldn't reach the server, so nothing was saved. Try again.",
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
          What a new quote starts with.
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
          label="Intro (optional)"
          hint="A line or two above your items, like a thank-you or what the price includes."
          value={values.description}
          error={errors.description}
          onChange={set("description")}
          maxLength={QUOTE_DESCRIPTION_MAX}
        />
        <TextAreaField
          id="wordingSignOff"
          name="signOff"
          label="Sign-off (optional)"
          rows={3}
          maxLength={QUOTE_SIGN_OFF_MAX}
          value={values.signOff}
          error={errors.signOff}
          onChange={set("signOff")}
          hint="A friendly closing line, like a thank-you or an invitation to ask questions."
        />
        <SelectField
          id="wordingSignOffAs"
          name="signOffAs"
          label="Sign with"
          value={values.signOffAs}
          onChange={(choice) => {
            setEditedSinceSave(true);
            setValues((v) => ({ ...v, signOffAs: isSignOffAs(choice) ? choice : "business" }));
          }}
          options={SIGN_OFF_CHOICES}
          optionLabels={signOffChoiceLabels(signers.business, signers.owner)}
        />
        {values.signOffAs === "other" && (
          <TextField
            id="wordingSignOffOther"
            name="signOffOther"
            label="Name to sign with"
            autoComplete="off"
            maxLength={SIGN_OFF_OTHER_MAX}
            value={values.signOffOther}
            error={errors.signOffOther}
            onChange={set("signOffOther")}
          />
        )}
        {values.signOffAs === "owner" && !signers.owner && (
          <p className="text-sm text-muted-foreground" data-testid="no-owner-name">
            No owner&apos;s name is saved yet.{" "}
            <Link href="/app/business" className="underline">
              Add it in the Business profile
            </Link>
            , or choose another name.
          </p>
        )}
        <TextAreaField
          id="wordingPayment"
          name="paymentInstructions"
          label="Payment notes (optional)"
          hint={paymentNotesHint}
          value={values.paymentInstructions}
          error={errors.paymentInstructions}
          onChange={set("paymentInstructions")}
          maxLength={QUOTE_PAYMENT_MAX}
        />
      </Section>
      {state.status === "saved" && !editedSinceSave && (
        <p role="status" className="text-base">
          Saved.
        </p>
      )}
      <SaveButton what="quote wording" pending={pending} />
    </form>
    </FormErrorScope>
  );
}
