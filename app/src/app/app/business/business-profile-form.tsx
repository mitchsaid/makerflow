"use client";

import { useActionState, useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { Section, SelectField, TextField, type ExtraInputProps } from "@/components/form-fields";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { getLocalePack } from "@/lib/locale";
import type { FieldErrors } from "@/lib/business-profile";
import { saveBusinessProfile, type SaveState } from "./actions";

export type FormValues = {
  name: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  vatRegistered: boolean;
  vatNumber: string;
  pricesIncludeVat: "inclusive" | "exclusive";
};

const initialState: SaveState = { status: "idle" };

export function BusinessProfileForm({
  initial,
  countryCode,
}: {
  initial: FormValues;
  countryCode: string;
}) {
  const locale = getLocalePack(countryCode);
  const [state, formAction, pending] = useActionState(saveBusinessProfile, initialState);
  const [, startTransition] = useTransition();
  const [values, setValues] = useState<FormValues>(initial);
  // "Saved." should only be shown while it is still true: hide it once the form is edited.
  const [editedSinceSave, setEditedSinceSave] = useState(false);
  const errors: FieldErrors = state.status === "error" ? (state.errors ?? {}) : {};
  // The summary lists problems in the order the fields appear on screen.
  const problems: FormProblem[] = (
    [
      ["name", "Business name"],
      ["phone", "Phone"],
      ["email", "Email"],
      ["addressLine1", "Street address"],
      ["addressLine2", "Suburb or building"],
      ["city", "City or town"],
      ["region", locale.address.regionLabel],
      ["postalCode", "Postal code"],
      ["vatNumber", locale.tax.registrationNumberLabel],
    ] as const
  ).flatMap(([field, label]) => {
    const message = errors[field];
    return message ? [{ fieldId: field, label, message }] : [];
  });

  const set =
    <K extends keyof FormValues>(key: K) =>
    (value: FormValues[K]) => {
      setEditedSinceSave(true);
      setValues((v) => ({ ...v, [key]: value }));
    };

  // Submitted by hand instead of via <form action>: React automatically resets a form
  // after its action finishes, which un-ticks our controlled VAT checkbox while the
  // on-screen state still says "registered". Calling the action ourselves avoids that.
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditedSinceSave(false);
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  // One text input with its label and its error message, wired together for screen readers.
  const text = (
    key: keyof FormValues & string,
    label: string,
    props: ExtraInputProps = {},
  ) => (
    <TextField
      id={key}
      label={label}
      error={errors[key as keyof FieldErrors]}
      value={values[key] as string}
      onChange={(value) => set(key)(value as never)}
      {...props}
    />
  );

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Section title="Your business">
        {text("name", "Business name", { autoComplete: "organization", required: true, maxLength: 120 })}
      </Section>

      <Section title="How customers reach you">
        {text("phone", "Phone", { type: "tel", autoComplete: "tel" })}
        {text("email", "Email", { type: "email", inputMode: "email", autoComplete: "email" })}
      </Section>

      <Section title="Address">
        {text("addressLine1", "Street address", { autoComplete: "address-line1" })}
        {text("addressLine2", "Suburb or building (optional)", { autoComplete: "address-line2" })}
        {text("city", "City or town", { autoComplete: "address-level2" })}
        <SelectField
          id="region"
          label={locale.address.regionLabel}
          error={errors.region}
          value={values.region}
          onChange={set("region")}
          placeholder={`Choose a ${locale.address.regionLabel.toLowerCase()}`}
          options={locale.address.regions}
          autoComplete="address-level1"
        />
        {text("postalCode", "Postal code", { inputMode: "numeric", autoComplete: "postal-code", maxLength: 4 })}
      </Section>

      <Section title="VAT">
        <Field orientation="horizontal" className="items-start py-2.5">
          <Checkbox
            id="vatRegistered"
            name="vatRegistered"
            checked={values.vatRegistered}
            onCheckedChange={(checked) => set("vatRegistered")(checked)}
          />
          <FieldLabel htmlFor="vatRegistered" className="text-base">
            I&apos;m registered for VAT
          </FieldLabel>
        </Field>
        <FieldDescription>
          Only tick this if you&apos;re registered for {locale.tax.name} with the tax authority. Your
          quotes and invoices will show {locale.tax.name} and your {locale.tax.registrationNumberLabel}.
        </FieldDescription>
        {values.vatRegistered && text("vatNumber", locale.tax.registrationNumberLabel, { inputMode: "numeric" })}
        {values.vatRegistered && (
          <Field>
            <FieldLabel htmlFor="pricesIncludeVat">When I type a price, it is</FieldLabel>
            <NativeSelect
              id="pricesIncludeVat"
              name="pricesIncludeVat"
              value={values.pricesIncludeVat}
              onChange={(e) =>
                set("pricesIncludeVat")(e.target.value === "exclusive" ? "exclusive" : "inclusive")
              }
            >
              <NativeSelectOption value="inclusive">Including VAT</NativeSelectOption>
              <NativeSelectOption value="exclusive">Excluding VAT</NativeSelectOption>
            </NativeSelect>
            <FieldDescription>
              Including VAT is the usual choice when you sell to the public; excluding VAT is
              common when you sell to other businesses. Either way, your quotes and invoices show
              the VAT and the total including VAT clearly.
            </FieldDescription>
          </Field>
        )}
      </Section>

      {state.status === "error" && state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <FormSummary problems={problems} trigger={state} />
      {state.status === "saved" && !pending && !editedSinceSave && (
        <p role="status" className="text-sm font-medium">Saved.</p>
      )}

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Saving…" : "Save details"}
      </Button>
    </form>
  );
}
