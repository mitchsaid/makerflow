"use client";

import { SelectField, TextField } from "@/components/form-fields";
import type { LocalePack } from "@/lib/locale";

/** Which keys of the form's values (and errors) hold each part of one address. */
export type AddressKeys<K extends string> = { line1: K; line2: K; city: K; region: K; postalCode: K };

/**
 * One address as separate fields, shaped by the business's country (the region's name and list, the postal code):
 * used for a customer's main address and again for where deliveries go, so they ask for the same things the same way.
 */
export function AddressFields<K extends string>({
  keys,
  values,
  errors,
  set,
  fid,
  locale,
  autoComplete = "off",
  postalCodeMaxLength,
}: {
  keys: AddressKeys<K>;
  values: Record<K, string>;
  errors: Partial<Record<K, string>>;
  set: (key: K) => (value: string) => void;
  /** Puts the form's id prefix in front of a field's name. */
  fid: (key: string) => string;
  locale: LocalePack;
  /**
   * "off" for someone else's address (a customer's); "own" for the person's own business, so the phone can offer to
   * fill it in.
   */
  autoComplete?: "off" | "own";
  /** The most characters a postal code may have here (a country's rule, passed in from where it is known). */
  postalCodeMaxLength?: number;
}) {
  const hint = (token: string) => (autoComplete === "own" ? token : "off");
  const text = (
    key: K,
    label: string,
    props: Omit<React.ComponentProps<typeof TextField>, "id" | "label" | "value" | "onChange" | "error"> = {},
  ) => (
    <TextField id={fid(key)} name={key} label={label} error={errors[key]} value={values[key]} onChange={set(key)} {...props} />
  );
  return (
    <>
      {text(keys.line1, "Street address", { autoComplete: hint("address-line1") })}
      {text(keys.line2, "Suburb or building (optional)", { autoComplete: hint("address-line2") })}
      {text(keys.city, "City or town", { autoComplete: hint("address-level2") })}
      <SelectField
        id={fid(keys.region)}
        name={keys.region}
        label={locale.address.regionLabel}
        error={errors[keys.region]}
        value={values[keys.region]}
        onChange={set(keys.region)}
        placeholder={`Choose a ${locale.address.regionLabel.toLowerCase()}`}
        options={locale.address.regions}
        autoComplete={autoComplete === "own" ? "address-level1" : undefined}
      />
      {text(keys.postalCode, "Postal code", {
        inputMode: "numeric",
        autoComplete: hint("postal-code"),
        ...(postalCodeMaxLength ? { maxLength: postalCodeMaxLength } : {}),
      })}
    </>
  );
}
