"use client";

import { useEffect, useState, useTransition } from "react";
import { FormErrorScope } from "@/components/form-errors";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { Section, TextField } from "@/components/form-fields";
import { ImageField } from "@/components/image-field";
import { SaveButton } from "@/components/save-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { getLocalePack } from "@/lib/locale";
import {
  wayToPayKind,
  type PaymentMethod,
  type PaymentMethodErrors,
  type PaymentMethodFormValues,
} from "@/lib/payments";
import { removePaymentMethod, savePaymentMethod } from "./payment-actions";

/** Set when the form is shown in a sheet over a quote: it hands the saved way back instead of staying put. */
export type EmbeddedPaymentMethodForm = {
  onDone: (method: PaymentMethod) => void;
  onCancel: () => void;
  onPendingChange: (pending: boolean) => void;
};

/**
 * One way to pay other than the bank account (docs/plans/payment-methods.md): a name the customer recognises, the
 * details its kind needs (from the country's locale pack), and whether new quotes show it. Used for a card on the
 * Business profile's Ways to pay tab (`method` set: change or remove it) and in the sheet over a quote (`embedded`).
 * Only the owner can change them; a sent document keeps the way as it showed it.
 */
export function PaymentMethodForm({
  method,
  kind: kindKey,
  countryCode,
  idPrefix = "",
  embedded,
  onSaved,
  onRemoved,
}: {
  /** The way being changed, or null when adding one. */
  method: PaymentMethod | null;
  /** The kind being added (a way being changed keeps its own). */
  kind: string;
  countryCode: string;
  idPrefix?: string;
  embedded?: EmbeddedPaymentMethodForm;
  onSaved?: (method: PaymentMethod) => void;
  onRemoved?: (id: string) => void;
}) {
  const locale = getLocalePack(countryCode);
  const kind = wayToPayKind(method?.kind ?? kindKey, locale);
  const [values, setValues] = useState<PaymentMethodFormValues>({
    kind: method?.kind ?? kindKey,
    name: method?.name ?? kind?.defaultName ?? "",
    fields: method?.details ?? {},
    imageId: method?.imageId ?? "",
    onNewQuotes: method?.onNewQuotes ?? true,
  });
  const [errors, setErrors] = useState<PaymentMethodErrors>({ fields: {} });
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [tries, setTries] = useState(0);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [pending, startTransition] = useTransition();
  // A QR picture on its way counts as busy too: a sheet must not close under it.
  const [uploading, setUploading] = useState(false);
  const fid = (key: string) => `${idPrefix}pay-${method?.id ?? "new"}-${key}`;

  useEffect(() => embedded?.onPendingChange(pending || uploading), [pending, uploading, embedded]);
  if (!kind) return null;

  const setField = (key: string) => (value: string) => {
    setSaved(false);
    setValues((v) => ({ ...v, fields: { ...v.fields, [key]: value } }));
  };

  const problems: FormProblem[] = [
    ...(errors.name
      ? [{ fieldId: fid("name"), label: "Name", message: errors.name }]
      : []),
    ...(errors.image
      ? [{ fieldId: fid("image"), label: "QR code picture", message: errors.image }]
      : []),
    ...kind.fields.flatMap((f) =>
      errors.fields[f.key]
        ? [
            {
              fieldId: fid(f.key),
              label: f.label,
              message: errors.fields[f.key],
            },
          ]
        : [],
    ),
  ];

  function submit(event: React.FormEvent<HTMLFormElement>) {
    // In a sheet this form sits over the quote's own form: its submit must not reach it.
    event.preventDefault();
    event.stopPropagation();
    setMessage(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const result = await savePaymentMethod(method?.id ?? null, values);
        setTries((n) => n + 1);
        if (result.status === "saved") {
          setErrors({ fields: {} });
          setSaved(true);
          onSaved?.(result.method);
          embedded?.onDone(result.method);
        } else {
          setErrors(result.errors ?? { fields: {} });
          setMessage(result.message ?? null);
        }
      } catch {
        setTries((n) => n + 1);
        setMessage(
          "Couldn't reach the server, so nothing was saved. Try again. Nothing you typed is lost.",
        );
      }
    });
  }

  function remove() {
    if (!method) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await removePaymentMethod(method.id);
        if (result.status === "removed") onRemoved?.(method.id);
        else {
          setConfirmingRemove(false);
          setMessage(result.message);
        }
      } catch {
        setConfirmingRemove(false);
        setMessage(
          "Couldn't reach the server, so nothing was removed. Try again.",
        );
      }
    });
  }

  return (
    <FormErrorScope epoch={tries}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Section
          title={method ? method.name : kind.label}
          description={method ? kind.label : kind.description}
        >
          <FormSummary problems={problems} trigger={tries} />
          {message && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          <TextField
            id={fid("name")}
            name="name"
            label="Name"
            hint="What the customer sees."
            autoComplete="off"
            maxLength={60}
            value={values.name}
            error={errors.name}
            onChange={(name) => {
              setSaved(false);
              setValues((v) => ({ ...v, name }));
            }}
          />
          {kind.picture && (
            <ImageField
              id={fid("image")}
              label="QR code picture"
              hint="Save the QR code from your payment app, then choose it here."
              kind="payment-qr"
              shape="free"
              value={values.imageId}
              alt={`QR code for ${values.name || kind.label}`}
              error={errors.image}
              onPendingChange={setUploading}
              onChange={(imageId) => {
                setSaved(false);
                setValues((v) => ({ ...v, imageId }));
              }}
            />
          )}
          {kind.fields.map((field) => (
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
              error={errors.fields[field.key]}
              onChange={setField(field.key)}
            />
          ))}
          <Field orientation="horizontal" className="items-start py-2.5">
            <Checkbox
              id={fid("onNewQuotes")}
              name="onNewQuotes"
              checked={values.onNewQuotes}
              onCheckedChange={(checked) => {
                setSaved(false);
                setValues((v) => ({ ...v, onNewQuotes: checked === true }));
              }}
            />
            <FieldLabel htmlFor={fid("onNewQuotes")} className="text-base">
              Show on new quotes and invoices
            </FieldLabel>
          </Field>
        </Section>
        {embedded ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Saving…" : "Save way to pay"}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              disabled={pending}
              onClick={embedded.onCancel}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {saved && (
              <p role="status" className="text-base">
                Saved.
              </p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <SaveButton
                what={method ? `${method.name}` : "way to pay"}
                pending={pending}
              />
              {method && !confirmingRemove && (
                <Button
                  type="button"
                  variant="danger"
                  disabled={pending}
                  onClick={() => setConfirmingRemove(true)}
                >
                  Remove<span className="sr-only"> {method.name}</span>
                </Button>
              )}
            </div>
            {method && confirmingRemove && (
              <div
                className="space-y-3 rounded-xl border border-destructive/50 p-3"
                role="alertdialog"
                aria-label={`Remove ${method.name}?`}
              >
                <p className="text-base">
                  Stop offering {method.name}? Quotes and invoices already sent
                  keep it.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={pending}
                    onClick={remove}
                  >
                    Yes, remove it
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() => setConfirmingRemove(false)}
                  >
                    Keep it
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </form>
    </FormErrorScope>
  );
}
