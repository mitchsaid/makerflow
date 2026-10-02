"use client";

import { useActionState, useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
        <Field data-invalid={!!errors.region}>
          <FieldLabel htmlFor="region">{locale.address.regionLabel}</FieldLabel>
          <NativeSelect
            id="region"
            name="region"
            autoComplete="address-level1"
            value={values.region}
            onChange={(e) => set("region")(e.target.value)}
            aria-invalid={!!errors.region}
            aria-describedby={errors.region ? "region-error" : undefined}
          >
            <NativeSelectOption value="">Choose a {locale.address.regionLabel.toLowerCase()}</NativeSelectOption>
            {locale.address.regions.map((p) => (
              <NativeSelectOption key={p} value={p}>
                {p}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {errors.region && <FieldError id="region-error">{errors.region}</FieldError>}
        </Field>
        {text("postalCode", "Postal code", { inputMode: "numeric", autoComplete: "postal-code", maxLength: 4 })}
      </Section>

      <Section title="VAT">
        <Field orientation="horizontal" className="min-h-11 items-center">
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
      {state.status === "error" && state.errors && (
        <Alert variant="destructive">
          <AlertDescription>Some details need a look. They&apos;re marked above.</AlertDescription>
        </Alert>
      )}
      {state.status === "saved" && !pending && !editedSinceSave && (
        <p role="status" className="text-sm font-medium">Saved.</p>
      )}

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Saving…" : "Save details"}
      </Button>
    </form>
  );
}

type ExtraInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "id" | "name"
>;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent>
        <FieldSet>
          <FieldLegend>{title}</FieldLegend>
          <FieldGroup className="gap-4">{children}</FieldGroup>
        </FieldSet>
      </CardContent>
    </Card>
  );
}

function TextField({
  id,
  label,
  error,
  value,
  onChange,
  ...props
}: ExtraInputProps & {
  id: string;
  label: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        name={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  );
}
