"use client";

import { useState, useTransition } from "react";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { Section, TextField } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDocumentNumber, parseNumbering, type NumberingErrors } from "@/lib/quotes/numbering";
import { saveQuoteNumbering, type NumberingState } from "./numbering-actions";

/**
 * Business profile > Quote numbers. A quote is numbered the first time it is saved, from this
 * prefix and counter. Continue from another system by setting the next number.
 */
export function QuoteNumberingForm({
  initialPrefix,
  initialNext,
  minDigits,
  lastIssued,
}: {
  initialPrefix: string;
  initialNext: number;
  minDigits: number;
  lastIssued: number | null;
}) {
  const [prefix, setPrefix] = useState(initialPrefix);
  const [next, setNext] = useState(String(initialNext));
  const [state, setState] = useState<NumberingState>({ status: "idle" });
  const [tries, setTries] = useState(0);
  const [editedSinceSave, setEditedSinceSave] = useState(false);
  const [pending, startTransition] = useTransition();

  const errors: NumberingErrors = state.status === "error" ? (state.errors ?? {}) : {};
  const problems: FormProblem[] = [
    ...(errors.prefix ? [{ fieldId: "numberPrefix", label: "Prefix", message: errors.prefix }] : []),
    ...(errors.nextNumber ? [{ fieldId: "nextNumber", label: "Next number", message: errors.nextNumber }] : []),
  ];

  // What the next quote will be called, while the typed values make sense.
  const preview = parseNumbering({ prefix, nextNumber: next }, lastIssued);
  const previewText = preview.ok ? formatDocumentNumber(preview.prefix, preview.nextNumber, minDigits) : null;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditedSinceSave(false);
    startTransition(async () => {
      try {
        setState(await saveQuoteNumbering({ prefix, nextNumber: next }));
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
      <Section title="Quote numbers">
        <p className="text-base text-muted-foreground">
          Every quote gets a number the first time you save it, and keeps it when you revise it. To
          carry on from another system, set the next number.
        </p>
        <FormSummary problems={problems} trigger={tries} />
        {state.status === "error" && state.message && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}
        <TextField
          id="numberPrefix"
          name="prefix"
          label="Prefix"
          autoComplete="off"
          value={prefix}
          error={errors.prefix}
          onChange={(v) => {
            setEditedSinceSave(true);
            setPrefix(v);
          }}
        />
        <TextField
          id="nextNumber"
          name="nextNumber"
          label="Next number"
          inputMode="numeric"
          autoComplete="off"
          value={next}
          error={errors.nextNumber}
          onChange={(v) => {
            setEditedSinceSave(true);
            setNext(v);
          }}
        />
        <p className="text-base" aria-live="polite" data-testid="number-preview">
          {previewText ? (
            <>
              Your next quote will be <strong>{previewText}</strong>.
            </>
          ) : (
            "Fix the details above to see your next quote number."
          )}
        </p>
        {lastIssued !== null && (
          <p className="text-sm text-muted-foreground">
            Numbers up to {formatDocumentNumber(initialPrefix, lastIssued, minDigits)} have been used.
          </p>
        )}
      </Section>
      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save quote numbers"}
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
