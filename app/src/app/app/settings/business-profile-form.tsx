"use client";

import { useActionState, useState, useTransition } from "react";
import { ZA_PROVINCES } from "@/lib/locale/za";
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
};

const initialState: SaveState = { status: "idle" };

export function BusinessProfileForm({ initial }: { initial: FormValues }) {
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

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <fieldset className="card space-y-4">
        <legend className="px-1 text-base font-semibold">Your business</legend>
        <Field id="name" label="Business name" error={errors.name}>
          <input id="name" name="name" type="text" autoComplete="organization" required
            maxLength={120} className="field" value={values.name}
            onChange={(e) => set("name")(e.target.value)}
            aria-describedby={errors.name ? "name-error" : undefined} />
        </Field>
      </fieldset>

      <fieldset className="card space-y-4">
        <legend className="px-1 text-base font-semibold">How customers reach you</legend>
        <Field id="phone" label="Phone" error={errors.phone}>
          <input id="phone" name="phone" type="tel" autoComplete="tel" className="field"
            value={values.phone} onChange={(e) => set("phone")(e.target.value)}
            aria-describedby={errors.phone ? "phone-error" : undefined} />
        </Field>
        <Field id="email" label="Email" error={errors.email}>
          <input id="email" name="email" type="email" inputMode="email" autoComplete="email"
            className="field" value={values.email}
            onChange={(e) => set("email")(e.target.value)}
            aria-describedby={errors.email ? "email-error" : undefined} />
        </Field>
      </fieldset>

      <fieldset className="card space-y-4">
        <legend className="px-1 text-base font-semibold">Address</legend>
        <Field id="addressLine1" label="Street address" error={errors.addressLine1}>
          <input id="addressLine1" name="addressLine1" type="text"
            autoComplete="address-line1" className="field" value={values.addressLine1}
            onChange={(e) => set("addressLine1")(e.target.value)}
            aria-describedby={errors.addressLine1 ? "addressLine1-error" : undefined} />
        </Field>
        <Field id="addressLine2" label="Suburb or building (optional)" error={errors.addressLine2}>
          <input id="addressLine2" name="addressLine2" type="text"
            autoComplete="address-line2" className="field" value={values.addressLine2}
            onChange={(e) => set("addressLine2")(e.target.value)}
            aria-describedby={errors.addressLine2 ? "addressLine2-error" : undefined} />
        </Field>
        <Field id="city" label="City or town" error={errors.city}>
          <input id="city" name="city" type="text" autoComplete="address-level2"
            className="field" value={values.city}
            onChange={(e) => set("city")(e.target.value)}
            aria-describedby={errors.city ? "city-error" : undefined} />
        </Field>
        <Field id="region" label="Province" error={errors.region}>
          <select id="region" name="region" autoComplete="address-level1" className="field"
            value={values.region} onChange={(e) => set("region")(e.target.value)}
            aria-describedby={errors.region ? "region-error" : undefined}>
            <option value="">Choose a province</option>
            {ZA_PROVINCES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field id="postalCode" label="Postal code" error={errors.postalCode}>
          <input id="postalCode" name="postalCode" type="text" inputMode="numeric"
            autoComplete="postal-code" maxLength={4} className="field"
            value={values.postalCode} onChange={(e) => set("postalCode")(e.target.value)}
            aria-describedby={errors.postalCode ? "postalCode-error" : undefined} />
        </Field>
      </fieldset>

      <fieldset className="card space-y-4">
        <legend className="px-1 text-base font-semibold">VAT</legend>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" name="vatRegistered" className="h-5 w-5 accent-[var(--accent)]"
            checked={values.vatRegistered}
            onChange={(e) => set("vatRegistered")(e.target.checked)} />
          <span>I&apos;m registered for VAT</span>
        </label>
        <p className="text-sm text-muted">
          Only tick this if you&apos;re registered with SARS. Your quotes and invoices will
          show VAT and your VAT number.
        </p>
        {values.vatRegistered && (
          <Field id="vatNumber" label="VAT number" error={errors.vatNumber}>
            <input id="vatNumber" name="vatNumber" type="text" inputMode="numeric"
              className="field" value={values.vatNumber}
              onChange={(e) => set("vatNumber")(e.target.value)}
              aria-describedby={errors.vatNumber ? "vatNumber-error" : undefined} />
          </Field>
        )}
      </fieldset>

      {state.status === "error" && state.message && (
        <p role="alert" className="text-sm text-danger">{state.message}</p>
      )}
      {state.status === "error" && state.errors && (
        <p role="alert" className="text-sm text-danger">
          Some details need a look. They&apos;re marked above.
        </p>
      )}
      {state.status === "saved" && !pending && !editedSinceSave && (
        <p role="status" className="text-sm font-medium">Saved.</p>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full sm:w-auto">
        {pending ? "Saving…" : "Save details"}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
