"use client";

import { useEffect, useState, useTransition } from "react";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { Section, SelectField, TextField } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { getLocalePack } from "@/lib/locale";
import type { BankDetails, BankFieldErrors, BankFormValues } from "@/lib/bank";
import { saveBankDetails } from "./bank-actions";

/** Set when the form is shown in a sheet over a quote: it hands the saved details back instead of staying put. */
export type EmbeddedBankForm = {
  onDone: (bank: BankDetails) => void;
  onCancel: () => void;
  onPendingChange: (pending: boolean) => void;
};

/**
 * Business profile > Bank details: where customers send money, written once and shown on every
 * quote (and, later, invoice). The fields follow the business's country. Only the owner can change
 * them, and documents that were already sent keep what they showed.
 */
export function BankDetailsForm({
  initial,
  countryCode,
  lastChanged,
  idPrefix = "",
  embedded,
}: {
  initial: BankFormValues;
  countryCode: string;
  /** "3 Oct 2026, 14:05", already written for the business's time zone, or null when never saved. */
  lastChanged: string | null;
  idPrefix?: string;
  embedded?: EmbeddedBankForm;
}) {
  const locale = getLocalePack(countryCode);
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<BankFieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [tries, setTries] = useState(0);
  const [pending, startTransition] = useTransition();
  const fid = (key: string) => `${idPrefix}bank-${key}`;

  useEffect(() => embedded?.onPendingChange(pending), [pending, embedded]);

  const setField = (key: string) => (value: string) => {
    setSaved(false);
    setValues((v) => ({ ...v, fields: { ...v.fields, [key]: value } }));
  };

  const problems: FormProblem[] = locale.payment.bankFields.flatMap((f) =>
    errors[f.key] ? [{ fieldId: fid(f.key), label: f.label, message: errors[f.key] }] : [],
  );

  function submit(event: React.FormEvent<HTMLFormElement>) {
    // In a sheet this form sits over the quote's own form: its submit must not reach it.
    event.preventDefault();
    event.stopPropagation();
    setMessage(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const result = await saveBankDetails(values);
        setTries((n) => n + 1);
        if (result.status === "saved") {
          setErrors({});
          setSaved(true);
          embedded?.onDone(result.bank);
        } else {
          setErrors(result.errors ?? {});
          setMessage(result.message ?? null);
        }
      } catch {
        setTries((n) => n + 1);
        setMessage("Couldn't reach the server, so nothing was saved. Check your connection and try again. Nothing you typed is lost.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Section title="Bank details">
        <p className="text-base text-muted-foreground">
          Where customers pay you by bank transfer. They are shown under “How to pay” on your quotes. Changing
          them affects new quotes only: a quote you have already sent keeps the details it showed.
        </p>
        <FormSummary problems={problems} trigger={tries} />
        {message && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        {locale.payment.bankFields.map((field) =>
          field.options ? (
            <SelectField
              key={field.key}
              id={fid(field.key)}
              name={field.key}
              label={field.label}
              placeholder={`Choose the ${field.label.toLowerCase()}`}
              options={field.options}
              value={values.fields[field.key] ?? ""}
              error={errors[field.key]}
              onChange={setField(field.key)}
            />
          ) : (
            <TextField
              key={field.key}
              id={fid(field.key)}
              name={field.key}
              label={field.label}
              hint={field.hint ?? undefined}
              autoComplete="off"
              inputMode={field.inputMode}
              maxLength={field.maxLength}
              value={values.fields[field.key] ?? ""}
              error={errors[field.key]}
              onChange={setField(field.key)}
            />
          ),
        )}
        <Field orientation="horizontal" className="items-start py-2.5">
          <Checkbox
            id={fid("useReference")}
            name="useReference"
            checked={values.useReference}
            onCheckedChange={(checked) => {
              setSaved(false);
              setValues((v) => ({ ...v, useReference: checked === true }));
            }}
          />
          <FieldLabel htmlFor={fid("useReference")} className="text-base">
            Ask customers to use the document number as their payment reference
          </FieldLabel>
        </Field>
        <FieldDescription>
          So “QT-0042” appears on the quote as the reference, and you can tell who has paid.
        </FieldDescription>
        {lastChanged && <p className="text-sm text-muted-foreground">Last changed {lastChanged}.</p>}
      </Section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save bank details"}
        </Button>
        {embedded && (
          <Button type="button" size="lg" variant="outline" disabled={pending} onClick={embedded.onCancel}>
            Cancel
          </Button>
        )}
        {saved && !embedded && (
          <p role="status" className="text-base">
            Saved.
          </p>
        )}
      </div>
    </form>
  );
}
