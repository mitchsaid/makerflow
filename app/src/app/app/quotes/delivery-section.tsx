"use client";

import { useState } from "react";
import { Section, TextAreaField, TextField } from "@/components/form-fields";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { SavedAddress } from "@/lib/customers";
import { QUOTE_DELIVERY_ADDRESS_MAX, type Fulfilment } from "@/lib/quotes";

const same = (a: string, b: string) => a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();

/**
 * "Delivery or collection". Choosing Delivery asks for the fee and where to: one of the addresses
 * the customer has on file (the first is picked for you), or a different address typed for this
 * quote. Nothing here is required: an address can be left for later.
 */
export function DeliverySection({
  fulfilment,
  deliveryFee,
  deliveryAddress,
  onChange,
  saved,
  hasCustomer,
  feeLabel,
  symbol,
  errors,
}: {
  fulfilment: Fulfilment;
  deliveryFee: string;
  deliveryAddress: string;
  onChange: (change: { fulfilment?: Fulfilment; deliveryFee?: string; deliveryAddress?: string }) => void;
  /** The chosen customer's addresses on file (none when there is no customer or nothing saved). */
  saved: SavedAddress[];
  hasCustomer: boolean;
  feeLabel: string;
  symbol: string;
  errors: { deliveryFee?: string; deliveryAddress?: string };
}) {
  // "A different address" was picked and nothing is typed yet.
  const [otherPicked, setOtherPicked] = useState(false);

  const savedIndex = saved.findIndex((a) => same(a.text, deliveryAddress));
  const typed = deliveryAddress.trim() !== "";
  const choice = savedIndex >= 0 ? `saved-${savedIndex}` : otherPicked || typed ? "other" : "";

  function choose(value: string) {
    if (value === "other") {
      setOtherPicked(true);
      // Start from a clean box rather than editing the customer's own address by accident.
      if (savedIndex >= 0) onChange({ deliveryAddress: "" });
      return;
    }
    setOtherPicked(false);
    const picked = saved[Number(value.replace("saved-", ""))];
    if (picked) onChange({ deliveryAddress: picked.text });
  }

  function chooseFulfilment(next: Fulfilment) {
    // Delivery to a customer who has an address on file: use it unless something is already typed.
    if (next === "delivery" && !typed && saved.length > 0) onChange({ fulfilment: next, deliveryAddress: saved[0].text });
    else onChange({ fulfilment: next });
  }

  return (
    <Section title="Delivery or collection">
      <RadioGroup
        aria-label="Delivery or collection"
        value={fulfilment}
        onValueChange={(v) => chooseFulfilment(v as Fulfilment)}
      >
        {(
          [
            ["none", "Not decided yet"],
            ["collection", "Collection (the customer collects)"],
            ["delivery", "Delivery (you deliver, with a fee)"],
          ] as const
        ).map(([option, label]) => (
          <Field key={option} orientation="horizontal" className="items-start py-2.5">
            <RadioGroupItem id={`fulfilment-${option}`} value={option} />
            <FieldLabel htmlFor={`fulfilment-${option}`} className="text-base">
              {label}
            </FieldLabel>
          </Field>
        ))}
      </RadioGroup>

      {fulfilment === "delivery" && (
        <>
          <TextField
            id="deliveryFee"
            label={feeLabel}
            startText={symbol}
            inputMode="decimal"
            autoComplete="off"
            value={deliveryFee}
            error={errors.deliveryFee}
            onChange={(fee) => onChange({ deliveryFee: fee })}
          />
          <FieldDescription>Leave the fee empty if delivery is free.</FieldDescription>

          {saved.length > 0 ? (
            <div role="group" aria-labelledby="deliver-to-label" className="space-y-1">
              <p id="deliver-to-label" className="text-sm font-medium">
                Deliver to
              </p>
              <RadioGroup aria-labelledby="deliver-to-label" value={choice} onValueChange={choose}>
                {saved.map((address, i) => (
                  <Field key={address.kind} orientation="horizontal" className="items-start py-2.5">
                    <RadioGroupItem id={`deliver-to-saved-${i}`} value={`saved-${i}`} />
                    <FieldLabel htmlFor={`deliver-to-saved-${i}`} className="block text-base">
                      <span className="block font-medium">{address.label}</span>
                      <span className="block whitespace-pre-line text-muted-foreground">{address.text}</span>
                    </FieldLabel>
                  </Field>
                ))}
                <Field orientation="horizontal" className="items-start py-2.5">
                  <RadioGroupItem id="deliver-to-other" value="other" />
                  <FieldLabel htmlFor="deliver-to-other" className="text-base">
                    A different address
                  </FieldLabel>
                </Field>
              </RadioGroup>
            </div>
          ) : null}

          {(saved.length === 0 || choice === "other") && (
            <TextAreaField
              id="deliveryAddress"
              label={saved.length === 0 ? "Deliver to (optional)" : "Delivery address"}
              hint={
                saved.length === 0
                  ? hasCustomer
                    ? "Nothing is saved for this customer yet. Type the address for this quote, or leave it for later."
                    : "Type the address for this quote, or leave it for later."
                  : "Used for this quote only."
              }
              rows={3}
              maxLength={QUOTE_DELIVERY_ADDRESS_MAX + 100}
              autoComplete="off"
              value={deliveryAddress}
              error={errors.deliveryAddress}
              onChange={(text) => onChange({ deliveryAddress: text })}
            />
          )}
          {errors.deliveryAddress && saved.length > 0 && choice !== "other" && (
            <p className="text-sm text-destructive">{errors.deliveryAddress}</p>
          )}
        </>
      )}
    </Section>
  );
}
