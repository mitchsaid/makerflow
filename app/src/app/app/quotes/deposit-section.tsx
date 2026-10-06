"use client";

import { useState } from "react";
import { Section, TextField } from "@/components/form-fields";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { FieldError } from "@/components/ui/field";
import type { Cents } from "@/lib/money";
import { depositAmounts, parseDeposit, type DepositFormValues } from "@/lib/quotes/deposit";
import type { Fulfilment } from "@/lib/quotes";

/**
 * "Deposit": ask for some of the money up front. A tick, then a percentage or an amount, and when the
 * rest is due (on collection or delivery, or by a date). A live line shows what that comes to.
 * Defaults come from the business's quote settings; each quote can change or switch it off.
 */
export function DepositSection({
  values,
  onChange,
  fulfilment,
  issueDate,
  grossCents,
  money,
  symbol,
  errors,
}: {
  values: DepositFormValues;
  onChange: (change: Partial<DepositFormValues>) => void;
  fulfilment: Fulfilment;
  issueDate: string;
  /** The quote total including VAT as typed so far, or null when it can't be worked out yet. */
  grossCents: Cents | null;
  money: (cents: number) => string;
  symbol: string;
  errors: { depositValue?: string; balanceDueDate?: string };
}) {
  const on = values.depositKind !== "none";
  // Unticking and ticking again brings back the kind that was chosen.
  const [lastKind, setLastKind] = useState<"percent" | "fixed">(values.depositKind === "fixed" ? "fixed" : "percent");

  const handoverLabel = fulfilment === "collection" ? "On collection" : fulfilment === "delivery" ? "On delivery" : "On collection or delivery";

  // What it comes to, when the typing so far makes sense.
  const parsed = on ? parseDeposit(values, issueDate) : null;
  const amounts = parsed?.ok && parsed.deposit && grossCents !== null && grossCents > 0 ? depositAmounts(grossCents, parsed.deposit) : null;

  return (
    <Section title="Deposit">
      <Field orientation="horizontal" className="items-start py-2.5">
        <Checkbox
          id="depositOn"
          name="depositOn"
          checked={on}
          onCheckedChange={(checked) => onChange({ depositKind: checked === true ? lastKind : "none" })}
        />
        <FieldLabel htmlFor="depositOn" className="text-base">
          Ask for a deposit to start work
        </FieldLabel>
      </Field>

      {on && (
        <>
          <Field>
            <FieldLabel htmlFor="depositKind">Worked out as</FieldLabel>
            <NativeSelect
              id="depositKind"
              value={values.depositKind}
              onChange={(e) => {
                const kind = e.target.value === "fixed" ? "fixed" : "percent";
                setLastKind(kind);
                onChange({ depositKind: kind, depositValue: "" });
              }}
            >
              <NativeSelectOption value="percent">A percentage of the total</NativeSelectOption>
              <NativeSelectOption value="fixed">A fixed amount</NativeSelectOption>
            </NativeSelect>
          </Field>
          <TextField
            id="depositValue"
            label={values.depositKind === "percent" ? "Percentage (%)" : "Amount"}
            startText={values.depositKind === "fixed" ? symbol : undefined}
            inputMode="decimal"
            autoComplete="off"
            value={values.depositValue}
            error={errors.depositValue}
            onChange={(depositValue) => onChange({ depositValue })}
          />
          <Field>
            <FieldLabel htmlFor="balanceDue">Balance due</FieldLabel>
            <NativeSelect
              id="balanceDue"
              value={values.balanceDue}
              onChange={(e) => onChange({ balanceDue: e.target.value === "date" ? "date" : "handover" })}
            >
              <NativeSelectOption value="handover">{handoverLabel}</NativeSelectOption>
              <NativeSelectOption value="date">By a date I choose</NativeSelectOption>
            </NativeSelect>
          </Field>
          {values.balanceDue === "date" && (
            <TextField
              id="balanceDueDate"
              type="date"
              label="Balance due by"
              error={errors.balanceDueDate}
              value={values.balanceDueDate}
              onChange={(balanceDueDate) => onChange({ balanceDueDate })}
            />
          )}
          {amounts && (
            <div data-testid="deposit-summary" className="space-y-1 text-base">
              <p>
                Deposit <span className="font-semibold">{money(amounts.depositCents)}</span> · Balance{" "}
                <span className="font-semibold">{money(amounts.balanceCents)}</span>
              </p>
              {amounts.tooBig && (
                <FieldError>The deposit is more than the quote total. Lower it before you send the quote.</FieldError>
              )}
            </div>
          )}
        </>
      )}
    </Section>
  );
}
