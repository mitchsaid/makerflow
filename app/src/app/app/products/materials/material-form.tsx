"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { Section, SelectField, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { ChoiceCards } from "@/components/choice-cards";
import { costPerUnitCents, type MaterialFieldErrors, type VatTreatment } from "@/lib/materials";
import { QuantityField } from "@/components/quantity-field";
import { isUnitCode, UNIT_CHOICES, UNITS } from "@/lib/materials/units";
import { formatMoney, parseMoney, parseQuantity, type NumberStyle } from "@/lib/money";
import type { AddedMaterial, MaterialSaveState } from "./actions";
import { FormErrorScope } from "@/components/form-errors";

export type MaterialFormValues = {
  name: string;
  unit: string;
  quantity: string;
  price: string;
  vatTreatment: VatTreatment;
  supplier: string;
};

export const EMPTY_MATERIAL: MaterialFormValues = { name: "", unit: "", quantity: "", price: "", vatTreatment: "included", supplier: "" };

type Action = (previous: MaterialSaveState, formData: FormData) => Promise<MaterialSaveState>;

const VAT_CHOICES: { value: VatTreatment; title: (tax: string) => string; description: (tax: string) => string }[] = [
  { value: "included", title: (t) => `Includes ${t}`, description: (t) => `What the shop charged, with ${t} in it.` },
  { value: "excluded", title: (t) => `Excludes ${t}`, description: (t) => `${t} was added on top of this price.` },
  { value: "none", title: (t) => `No ${t} charged`, description: (t) => `The supplier is not a ${t} vendor, so this is the whole cost.` },
];

/**
 * Add or edit a material: what it is, a unit, how much was bought and what was paid. The cost of one unit is worked
 * out as it is typed. A VAT-registered business also says what the price paid includes; costs and margins are
 * always worked out without VAT.
 */
export function MaterialForm({
  action,
  initial,
  mode,
  vatRateBp,
  taxName,
  currencyCode,
  numberStyle,
  currencySymbol,
  idPrefix = "",
  onSaved,
}: {
  action: Action;
  initial: MaterialFormValues;
  mode: "add" | "edit";
  /** The standard VAT rate when the business is VAT-registered, else null (the price paid is the cost). */
  vatRateBp: number | null;
  taxName: string;
  currencyCode: string;
  numberStyle: NumberStyle;
  currencySymbol: string;
  /** In front of every field id, for when the form shares a page with other fields (the field names stay the same). */
  idPrefix?: string;
  /** Set when the form is shown over another screen: told once, with the material, when it has been added. */
  onSaved?: (material: AddedMaterial) => void;
}) {
  const fid = (key: string) => `${idPrefix}${key}`;
  const vatRegistered = vatRateBp !== null;
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as MaterialSaveState);
  const [, startTransition] = useTransition();
  const [values, setValues] = useState<MaterialFormValues>(initial);
  const set = <K extends keyof MaterialFormValues>(key: K) => (value: MaterialFormValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  // Hand the result to whoever opened the form, once per result.
  const handled = useRef<MaterialSaveState | null>(null);
  useEffect(() => {
    if (state.status === "saved" && state.material && onSaved && handled.current !== state) {
      handled.current = state;
      onSaved(state.material);
    }
  });

  const errors: MaterialFieldErrors = state.status === "error" ? (state.errors ?? {}) : {};
  const problems: FormProblem[] = (
    [
      [fid("name"), "Name", errors.name],
      [fid("unit"), "Unit", errors.unit],
      [fid("quantity"), "How much you bought", errors.quantity],
      [fid("price"), "What you paid", errors.price],
      [fid("vat-included"), `Does the price include ${taxName}`, errors.vatTreatment],
      [fid("supplier"), "Supplier", errors.supplier],
    ] as const
  ).flatMap(([id, label, message]) => (message ? [{ fieldId: id, label, message }] : []));

  // What one unit costs, as far as it can be told from what is typed (shown without VAT for a registered business).
  const quantity = parseQuantity(values.quantity);
  const price = parseMoney(values.price);
  const preview =
    quantity.ok && price.ok && isUnitCode(values.unit)
      ? costPerUnitCents(
          { unit: values.unit, boughtQuantityMilli: quantity.value, priceCents: price.value, vatTreatment: values.vatTreatment },
          vatRateBp,
        )
      : null;
  const previewUnit = isUnitCode(values.unit) ? UNITS[values.unit].short : "";

  // Submitted by hand (see the business profile form for why).
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <FormErrorScope epoch={state}>
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Section title="The material">
        <TextField id={fid("name")} name="name" label="Name" hint="Like “Cake flour” or “Silver wire”." autoComplete="off" maxLength={120} value={values.name} error={errors.name} onChange={set("name")} />
        <TextField
          id={fid("supplier")}
          name="supplier"
          label="Supplier (optional)"
          autoComplete="off"
          maxLength={120}
          value={values.supplier}
          error={errors.supplier}
          onChange={set("supplier")}
        />
      </Section>

      <Section title="What you bought">
        <SelectField
          id={fid("unit")}
          name="unit"
          label="Unit"
          hint="What you measure it in when you use it."
          value={values.unit}
          error={errors.unit}
          onChange={set("unit")}
          placeholder="Choose a unit"
          options={UNIT_CHOICES.flatMap((g) => g.units)}
          optionLabels={Object.fromEntries(UNIT_CHOICES.flatMap((g) => g.units).map((u) => [u, UNITS[u].label]))}
        />
        <QuantityField
          id={fid("quantity")}
          name="quantity"
          label="How much you bought"
          hint="In that unit, like 12,5 for 12,5 kg."
          unit={previewUnit || undefined}
          value={values.quantity}
          error={errors.quantity}
          onChange={set("quantity")}
        />
        <TextField
          id={fid("price")}
          name="price"
          label="What you paid for it"
          hint="The whole price for that much."
          startText={currencySymbol}
          inputMode="decimal"
          autoComplete="off"
          value={values.price}
          error={errors.price}
          onChange={set("price")}
        />
        {vatRegistered && (
          <ChoiceCards
            legend={<>Does that price include {taxName}?</>}
            value={values.vatTreatment}
            onChange={set("vatTreatment")}
            idFor={(v) => fid(`vat-${v}`)}
            invalid={!!errors.vatTreatment}
            choices={VAT_CHOICES.map((c) => ({ value: c.value, title: c.title(taxName), hint: c.description(taxName) }))}
          >
            <input type="hidden" name="vatTreatment" value={values.vatTreatment} />
            <p className="text-sm text-muted-foreground" data-testid="vat-note">
              Costs and margins exclude {taxName}. We don&apos;t work out what you can claim back.
            </p>
          </ChoiceCards>
        )}
        <p className="text-base" data-testid="cost-preview">
          {preview === null
            ? "Fill in the unit, how much and what you paid to see what one costs."
            : `That works out at ${preview === 0 && price.ok && price.value > 0 ? `less than ${formatMoney(1, currencyCode, numberStyle)}` : formatMoney(preview, currencyCode, numberStyle)} per ${previewUnit}${vatRegistered ? ` (without ${taxName})` : ""}.`}
        </p>
      </Section>

      <FormSummary problems={problems} trigger={state} />
      {state.status === "error" && state.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      {state.status === "saved" && !pending && !onSaved && (
        <p role="status" className="text-sm font-medium">
          Saved.
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Add material"}
      </Button>
    </form>
    </FormErrorScope>
  );
}
