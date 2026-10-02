"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { Section, SelectField, TextAreaField, TextField } from "@/components/form-fields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import type { CustomerFieldErrors } from "@/lib/customers";
import { getLocalePack } from "@/lib/locale";
import type { CustomerSaveState } from "./actions";
import type { CustomerFormValues } from "./customer-values";

const initialState: CustomerSaveState = { status: "idle" };

type Action = (previous: CustomerSaveState, formData: FormData) => Promise<CustomerSaveState>;

/**
 * Add or edit a customer. Only the name is needed; everything else is optional and can be
 * added later. Adding warns (never blocks) when the name or phone matches someone already
 * on the list.
 */
export function CustomerForm({
  action,
  initial,
  countryCode,
  mode,
}: {
  action: Action;
  initial: CustomerFormValues;
  countryCode: string;
  mode: "add" | "edit";
}) {
  const locale = getLocalePack(countryCode);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [, startTransition] = useTransition();
  const [values, setValues] = useState<CustomerFormValues>(initial);
  const [editedSinceSave, setEditedSinceSave] = useState(false);
  // The optional sections start open when editing or when there is already something in them.
  const hasMore = [
    initial.addressLine1,
    initial.addressLine2,
    initial.city,
    initial.region,
    initial.postalCode,
    initial.deliveryAddress,
    initial.notes,
  ].some((v) => v !== "");
  const [showMore, setShowMore] = useState(mode === "edit" || hasMore);

  const errors: CustomerFieldErrors = state.status === "error" ? (state.errors ?? {}) : {};
  const duplicates = state.status === "duplicate" && !editedSinceSave ? state.matches : null;

  const problems: FormProblem[] = (
    [
      ["name", "Name"],
      ["contactPerson", "Contact person"],
      ["vatNumber", locale.tax.registrationNumberLabel],
      ["companyRegistrationNumber", "Company registration number"],
      ["phone", "Phone"],
      ["email", "Email"],
      ["addressLine1", "Street address"],
      ["addressLine2", "Suburb or building"],
      ["city", "City or town"],
      ["region", locale.address.regionLabel],
      ["postalCode", "Postal code"],
      ["deliveryAddress", "Delivery address"],
      ["notes", "Private notes"],
    ] as const
  ).flatMap(([field, label]) => {
    // Business-only fields are not on screen when "this is a business" is off.
    const onScreen =
      values.isBusiness ||
      !["contactPerson", "vatNumber", "companyRegistrationNumber"].includes(field);
    const message = errors[field];
    return message && onScreen ? [{ fieldId: field, label, message }] : [];
  });

  const set =
    <K extends keyof CustomerFormValues>(key: K) =>
    (value: CustomerFormValues[K]) => {
      setEditedSinceSave(true);
      setValues((v) => ({ ...v, [key]: value }));
    };

  const text = (
    key: Exclude<keyof CustomerFormValues, "isBusiness">,
    label: string,
    props: Omit<React.ComponentProps<typeof TextField>, "id" | "label" | "value" | "onChange" | "error"> = {},
  ) => (
    <TextField
      id={key}
      label={label}
      error={errors[key]}
      value={values[key]}
      onChange={set(key)}
      {...props}
    />
  );

  // Submitted by hand (see the business profile form for why).
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    // The person has seen the "looks like someone you already have" note and chose to go on.
    if (duplicates) formData.set("confirmDuplicate", "yes");
    setEditedSinceSave(false);
    startTransition(() => formAction(formData));
  }

  const submitLabel = pending
    ? "Saving…"
    : mode === "edit"
      ? "Save changes"
      : duplicates
        ? "Add anyway"
        : "Add customer";

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Section title="Customer">
        {text("name", "Name", { autoComplete: "off", required: true, maxLength: 120 })}
        <Field orientation="horizontal" className="min-h-11 items-center">
          <Checkbox
            id="isBusiness"
            name="kind"
            value="business"
            checked={values.isBusiness}
            onCheckedChange={(checked) => set("isBusiness")(checked)}
          />
          <FieldLabel htmlFor="isBusiness" className="text-base">
            This is a business
          </FieldLabel>
        </Field>
        {values.isBusiness && (
          <>
            <FieldDescription>
              Business details are optional. A {locale.tax.registrationNumberLabel} and address
              are needed on a full tax invoice for a bigger sale to a business.
            </FieldDescription>
            {text("contactPerson", "Contact person", { autoComplete: "off" })}
            {text("vatNumber", locale.tax.registrationNumberLabel, { autoComplete: "off" })}
            {text("companyRegistrationNumber", "Company registration number", {
              autoComplete: "off",
            })}
          </>
        )}
      </Section>

      <Section title="How to reach them">
        {text("phone", "Phone", { type: "tel", autoComplete: "off" })}
        {text("email", "Email", { type: "email", inputMode: "email", autoComplete: "off" })}
      </Section>

      {showMore ? (
        <>
          <Section title="Address">
            {text("addressLine1", "Street address", { autoComplete: "off" })}
            {text("addressLine2", "Suburb or building (optional)", { autoComplete: "off" })}
            {text("city", "City or town", { autoComplete: "off" })}
            <SelectField
              id="region"
              label={locale.address.regionLabel}
              error={errors.region}
              value={values.region}
              onChange={set("region")}
              placeholder={`Choose a ${locale.address.regionLabel.toLowerCase()}`}
              options={locale.address.regions}
            />
            {text("postalCode", "Postal code", { inputMode: "numeric", autoComplete: "off" })}
          </Section>
          <Section title="Delivery">
            <TextAreaField
              id="deliveryAddress"
              label="Delivery address (optional)"
              hint="Only if it is different from the address above."
              error={errors.deliveryAddress}
              value={values.deliveryAddress}
              onChange={set("deliveryAddress")}
              maxLength={400}
            />
          </Section>
          <Section title="Private notes">
            <TextAreaField
              id="notes"
              label="Notes (optional)"
              hint="Only you and your team see these. They never appear on a quote or invoice."
              error={errors.notes}
              value={values.notes}
              onChange={set("notes")}
              maxLength={2000}
            />
          </Section>
        </>
      ) : (
        <Button type="button" variant="outline" onClick={() => setShowMore(true)}>
          Add address, delivery details or notes
        </Button>
      )}

      {state.status === "error" && state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      {duplicates && (
        <Alert data-testid="duplicate-warning" role="status">
          <AlertTitle>
            {duplicates.length === 1
              ? "You may already have this customer"
              : "You may already have these customers"}
          </AlertTitle>
          <AlertDescription>
            <span>
              Same name or phone number as{" "}
              {duplicates.map((d, i) => (
                <span key={d.id}>
                  {i > 0 && ", "}
                  <Link href={`/app/customers/${d.id}`} className="font-medium underline">
                    {d.name}
                  </Link>
                </span>
              ))}
              . Add anyway if this is a different person.
            </span>
          </AlertDescription>
        </Alert>
      )}
      <FormSummary problems={problems} trigger={state} />
      {state.status === "saved" && !pending && !editedSinceSave && (
        <p role="status" className="text-sm font-medium">
          Saved.
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {submitLabel}
        </Button>
        {mode === "add" && (
          <Link
            href="/app/customers"
            className={buttonVariants({ variant: "outline", className: "w-full sm:w-auto" })}
          >
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
