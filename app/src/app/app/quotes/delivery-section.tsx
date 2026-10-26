"use client";

import { DeliveryAddress } from "@/components/delivery-address";
import { Section, TextField } from "@/components/form-fields";
import { Field, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { SavedAddress } from "@/lib/customers";
import type { Fulfilment } from "@/lib/quotes";
import { addressWhenFulfilmentChanges } from "@/lib/quotes/delivery";

/**
 * "Delivery or collection". Choosing Delivery asks for the fee and where to: one of the addresses
 * the customer has on file (the first is picked for you), or a different address entered for this
 * quote in the same separate fields as everywhere else. Nothing here is required: an address can be left for later.
 */
export function DeliverySection({
  fulfilment,
  deliveryFee,
  deliveryAddress,
  onChange,
  saved,
  hasCustomer,
  countryCode,
  feeLabel,
  symbol,
  errors,
  footer,
}: {
  fulfilment: Fulfilment;
  deliveryFee: string;
  deliveryAddress: string;
  onChange: (change: { fulfilment?: Fulfilment; deliveryFee?: string; deliveryAddress?: string }) => void;
  /** The chosen customer's addresses on file (none when there is no customer or nothing saved). */
  saved: SavedAddress[];
  hasCustomer: boolean;
  countryCode: string;
  feeLabel: string;
  symbol: string;
  errors: { deliveryFee?: string; deliveryAddress?: string };
  /** At the end of the section: on a quote, the tick that makes this choice the usual. */
  footer?: React.ReactNode;
}) {
  function chooseFulfilment(next: Fulfilment) {
    // Delivery to a customer who has an address on file: use it unless something is already typed.
    onChange({ fulfilment: next, deliveryAddress: addressWhenFulfilmentChanges(next, deliveryAddress, saved) });
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
            hint="Leave empty if delivery is free."
            startText={symbol}
            inputMode="decimal"
            autoComplete="off"
            value={deliveryFee}
            error={errors.deliveryFee}
            onChange={(fee) => onChange({ deliveryFee: fee })}
          />

          <DeliveryAddress
            subject="quote"
            value={deliveryAddress}
            onChange={(text) => onChange({ deliveryAddress: text })}
            saved={saved}
            hasCustomer={hasCustomer}
            countryCode={countryCode}
            error={errors.deliveryAddress}
          />
        </>
      )}
      {footer}
    </Section>
  );
}
