"use client";

import { useEffect, useState, useTransition } from "react";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { Section, TextField } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SaveButton } from "@/components/save-button";
import { formatDocumentNumber, parseNumbering, type NumberingErrors } from "@/lib/quotes/numbering";
import { saveCreditNoteNumbering, saveInvoiceNumbering, saveQuoteNumbering, type NumberingState } from "./numbering-actions";
import { FormErrorScope } from "@/components/form-errors";

/**
 * Quote settings > Quote numbers. A quote is numbered the first time it is saved, from this
 * prefix and counter. Continue from another system by setting the next number.
 *
 * Also shown in a sheet over a new quote ("Change numbering" beside the number it is about to get): `embedded` then
 * hands the saved numbering back instead of staying on a page, and keeps the submit from reaching the quote's form.
 */
export type EmbeddedNumberingForm = {
  onDone: (numbering: { prefix: string; nextNumber: number }) => void;
  onCancel: () => void;
  /** The sheet must not close while a save is on its way: the result would be lost. */
  onPendingChange: (pending: boolean) => void;
};

export function QuoteNumberingForm({
  docType = "quote",
  initialPrefix,
  initialNext,
  minDigits,
  lastIssued,
  embedded,
}: {
  /** Quotes (the default) or invoices: each business has one run of numbers for each. */
  docType?: "quote" | "invoice" | "credit_note";
  initialPrefix: string;
  initialNext: number;
  minDigits: number;
  lastIssued: number | null;
  embedded?: EmbeddedNumberingForm;
}) {
  const noun = docType === "credit_note" ? "credit note" : docType;
  // The forms can be on one page together: their fields differ in id and in name.
  const ids =
    docType === "invoice"
      ? { prefix: "invoiceNumberPrefix", next: "invoiceNextNumber" }
      : docType === "credit_note"
        ? { prefix: "creditNoteNumberPrefix", next: "creditNoteNextNumber" }
        : { prefix: "numberPrefix", next: "nextNumber" };
  const labels =
    docType === "invoice"
      ? { prefix: "Invoice prefix", next: "Invoice next number" }
      : docType === "credit_note"
        ? { prefix: "Credit note prefix", next: "Credit note next number" }
        : { prefix: "Prefix", next: "Next number" };
  const save = docType === "invoice" ? saveInvoiceNumbering : docType === "credit_note" ? saveCreditNoteNumbering : saveQuoteNumbering;
  const [prefix, setPrefix] = useState(initialPrefix);
  const [next, setNext] = useState(String(initialNext));
  const [state, setState] = useState<NumberingState>({ status: "idle" });
  const [tries, setTries] = useState(0);
  const [editedSinceSave, setEditedSinceSave] = useState(false);
  const [pending, startTransition] = useTransition();

  const errors: NumberingErrors = state.status === "error" ? (state.errors ?? {}) : {};
  const problems: FormProblem[] = [
    ...(errors.prefix ? [{ fieldId: ids.prefix, label: labels.prefix, message: errors.prefix }] : []),
    ...(errors.nextNumber ? [{ fieldId: ids.next, label: labels.next, message: errors.nextNumber }] : []),
  ];

  // What the next quote will be called, while the typed values make sense.
  const preview = parseNumbering({ prefix, nextNumber: next }, lastIssued);
  const previewText = preview.ok ? formatDocumentNumber(preview.prefix, preview.nextNumber, minDigits) : null;

  // Tell whoever opened the sheet while a save is on its way.
  useEffect(() => {
    embedded?.onPendingChange(pending);
    // Only when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // In a sheet this form sits inside the quote's form in the React tree: the submit must not save the quote too.
    event.stopPropagation();
    setEditedSinceSave(false);
    startTransition(async () => {
      try {
        const result = await save({ prefix, nextNumber: next });
        setState(result);
        if (result.status === "saved" && embedded) embedded.onDone({ prefix: prefix.trim(), nextNumber: Number(next.trim()) });
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
      <Fields embedded={!!embedded} title={docType === "invoice" ? "Invoice numbers" : docType === "credit_note" ? "Credit note numbers" : "Quote numbers"}>
        <p className="text-base text-muted-foreground">
          {docType === "invoice"
            ? "Each invoice gets the next number when it is issued, with none skipped. To carry on from another system, set the next number."
            : docType === "credit_note"
              ? "Each credit note gets the next number when it is issued, with none skipped. To carry on from another system, set the next number."
              : "Each quote is numbered when first saved. To carry on from another system, set the next number."}
        </p>
        <FormSummary problems={problems} trigger={tries} />
        {state.status === "error" && state.message && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}
        <TextField
          id={ids.prefix}
          name="prefix"
          label={labels.prefix}
          autoComplete="off"
          value={prefix}
          error={errors.prefix}
          onChange={(v) => {
            setEditedSinceSave(true);
            setPrefix(v);
          }}
        />
        <TextField
          id={ids.next}
          name="nextNumber"
          label={labels.next}
          inputMode="numeric"
          autoComplete="off"
          value={next}
          error={errors.nextNumber}
          onChange={(v) => {
            setEditedSinceSave(true);
            setNext(v);
          }}
        />
        <p className="text-base" aria-live="polite" data-testid={docType === "invoice" ? "invoice-number-preview" : docType === "credit_note" ? "credit-note-number-preview" : "number-preview"}>
          {previewText ? (
            <>
              Your next {noun} will be <strong>{previewText}</strong>.
            </>
          ) : (
            `Fix the details above to see your next ${noun} number.`
          )}
        </p>
        {lastIssued !== null && (
          <p className="text-sm text-muted-foreground">
            Numbers up to {formatDocumentNumber(initialPrefix, lastIssued, minDigits)} have been used.
          </p>
        )}
      </Fields>
      {embedded ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : `Save ${noun} numbers`}
          </Button>
          <Button type="button" variant="outline" size="lg" disabled={pending} onClick={embedded.onCancel}>
            Cancel
          </Button>
          {state.status === "saved" && !editedSinceSave && (
            <p role="status" className="text-base">
              Saved.
            </p>
          )}
        </div>
      ) : (
        <>
          {state.status === "saved" && !editedSinceSave && (
            <p role="status" className="text-base">
              Saved.
            </p>
          )}
          <SaveButton what={`${noun} numbers`} pending={pending} />
        </>
      )}
    </form>
    </FormErrorScope>
  );
}

/** The fields in their own titled card on the page, or plain in a sheet (which has its own title). */
function Fields({ embedded, title, children }: { embedded: boolean; title: string; children: React.ReactNode }) {
  return embedded ? <div className="space-y-4">{children}</div> : <Section title={title}>{children}</Section>;
}
