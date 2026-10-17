"use client";

import { useState } from "react";
import { AddressFields } from "@/components/address-fields";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { SavedAddress } from "@/lib/customers";
import { getLocalePack } from "@/lib/locale";
import { sameAddress } from "@/lib/quotes/delivery";

const KEYS = { line1: "deliveryLine1", line2: "deliveryLine2", city: "deliveryCity", region: "deliveryRegion", postalCode: "deliveryPostalCode" } as const;
type Key = (typeof KEYS)[keyof typeof KEYS];
const BLANK: Record<Key, string> = { deliveryLine1: "", deliveryLine2: "", deliveryCity: "", deliveryRegion: "", deliveryPostalCode: "" };

/**
 * Where a delivery goes, asked the same way on a quote and on a job (docs/ux-inputs.md, "Address"): one of the
 * customer's saved addresses, or a different one typed into the same separate fields as everywhere else (street,
 * suburb, city, region, postal code), shaped by the business's country. The value is the address as the country
 * writes it, one line per part: what the quote or job keeps as its own copy. Nothing is required.
 */
export function DeliveryAddress({
  subject,
  value,
  onChange,
  saved,
  hasCustomer,
  countryCode,
  error,
  fid = (key) => key,
}: {
  /** "quote" or "job": for the words ("Used for this quote only"). */
  subject: "quote" | "job";
  value: string;
  onChange: (text: string) => void;
  /** The chosen customer's addresses on file (none when there is no customer or nothing saved). */
  saved: SavedAddress[];
  hasCustomer: boolean;
  countryCode: string;
  error?: string;
  /** Puts a form's id prefix in front of a field's id. */
  fid?: (key: string) => string;
}) {
  const locale = getLocalePack(countryCode);
  // "A different address" was picked.
  const [otherPicked, setOtherPicked] = useState(false);
  const [parts, setParts] = useState<Record<Key, string>>(BLANK);
  // An address that came with the form and is not one of the customer's (a saved quote or job is opened again): the
  // parts it was typed in are not kept, so it is offered as it was, with the choice of typing a different one.
  const [kept] = useState(() => (saved.some((a) => sameAddress(a.text, value)) ? "" : value.trim() === "" ? "" : value));

  const savedIndex = saved.findIndex((a) => sameAddress(a.text, value));
  const isKept = kept !== "" && savedIndex < 0 && !otherPicked && sameAddress(kept, value);
  const showChoices = saved.length > 0 || kept !== "";
  // (A saved address wins over "A different address" being picked: another customer's was put in the value.)
  const typing = savedIndex < 0 && (otherPicked || !showChoices || (!isKept && value.trim() !== ""));
  const choice = savedIndex >= 0 ? `saved-${savedIndex}` : otherPicked ? "other" : isKept ? "kept" : typing ? "other" : "";

  const compose = (next: Record<Key, string>) =>
    locale.address
      .formatLines({
        line1: next.deliveryLine1.trim() || null,
        line2: next.deliveryLine2.trim() || null,
        city: next.deliveryCity.trim() || null,
        region: next.deliveryRegion.trim() || null,
        postalCode: next.deliveryPostalCode.trim() || null,
      })
      .join("\n");

  function choose(next: string) {
    if (next === "other") {
      setOtherPicked(true);
      // Start from empty fields rather than editing the customer's own address by accident.
      setParts(BLANK);
      onChange("");
      return;
    }
    setOtherPicked(false);
    if (next === "kept") {
      onChange(kept);
      return;
    }
    const picked = saved[Number(next.replace("saved-", ""))];
    if (picked) onChange(picked.text);
  }

  const set = (key: Key) => (text: string) => {
    const next = { ...parts, [key]: text };
    setParts(next);
    onChange(compose(next));
  };

  const heading = hasCustomer && saved.length === 0 && !kept ? "Nothing is saved for this customer yet." : null;

  return (
    <div id={fid("deliveryAddress")} tabIndex={-1} className="space-y-3 outline-none" data-testid="delivery-address">
      <p id={fid("deliver-to-label")} className="text-sm font-medium">
        Deliver to{showChoices ? "" : " (optional)"}
      </p>
      {heading && <p className="-mt-2 text-sm text-muted-foreground">{heading} Fill in the address, or leave it for later.</p>}
      {showChoices && (
        <RadioGroup aria-labelledby={fid("deliver-to-label")} value={choice} onValueChange={choose}>
          {saved.map((address, i) => (
            <Field key={address.kind} orientation="horizontal" className="items-start py-2.5">
              <RadioGroupItem id={fid(`deliver-to-saved-${i}`)} value={`saved-${i}`} />
              <FieldLabel htmlFor={fid(`deliver-to-saved-${i}`)} className="block text-base">
                <span className="block font-medium">{address.label}</span>
                <span className="block whitespace-pre-line text-muted-foreground">{address.text}</span>
              </FieldLabel>
            </Field>
          ))}
          {kept !== "" && (
            <Field orientation="horizontal" className="items-start py-2.5">
              <RadioGroupItem id={fid("deliver-to-kept")} value="kept" />
              <FieldLabel htmlFor={fid("deliver-to-kept")} className="block text-base">
                <span className="block font-medium">Address on this {subject}</span>
                <span className="block whitespace-pre-line text-muted-foreground">{kept}</span>
              </FieldLabel>
            </Field>
          )}
          <Field orientation="horizontal" className="items-start py-2.5">
            <RadioGroupItem id={fid("deliver-to-other")} value="other" />
            <FieldLabel htmlFor={fid("deliver-to-other")} className="text-base">
              A different address
            </FieldLabel>
          </Field>
        </RadioGroup>
      )}
      {typing && (
        <div className="space-y-4" data-testid="delivery-address-fields">
          <AddressFields keys={KEYS} values={parts} errors={{}} set={set} fid={(key) => fid(key)} locale={locale} />
          {showChoices && <p className="text-sm text-muted-foreground">Used for this {subject} only.</p>}
        </div>
      )}
      {error && <FieldError id={fid("deliveryAddress-error")}>{error}</FieldError>}
    </div>
  );
}
