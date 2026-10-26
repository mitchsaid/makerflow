"use client";

import { useState } from "react";
import { useEditedFields } from "@/components/form-errors";
import { Section, TextField } from "@/components/form-fields";
import { AddButton } from "@/components/add-button";
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { FieldError } from "@/components/ui/field";
import type { Cents } from "@/lib/money";
import { BALANCE_TEXT_MAX, depositAmounts, parseDeposit, type DepositFormValues } from "@/lib/quotes/deposit";
import type { Fulfilment } from "@/lib/quotes";

/**
 * "Deposit": ask for some of the money up front. Added with a button, then a percentage or an amount, and when the
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
  ask = false,
  decided = false,
  footer,
  addWith,
}: {
  values: DepositFormValues;
  onChange: (change: Partial<DepositFormValues>) => void;
  fulfilment: Fulfilment;
  issueDate: string;
  /** The quote total including VAT as typed so far, or null when it can't be worked out yet. */
  grossCents: Cents | null;
  money: (cents: number) => string;
  symbol: string;
  errors: { depositValue?: string; balanceDueDate?: string; balanceDueText?: string };
  /** The business decides the deposit on every quote: a choice is put in front of them, with nothing chosen yet. */
  ask?: boolean;
  /** In "ask" mode on a quote that was saved before: what it has is the choice made (so no deposit shows as chosen). */
  decided?: boolean;
  /** Under the section's fields (the "Use this deposit on new quotes" tick). */
  footer?: React.ReactNode;
  /** What "Add a deposit" starts with (the business's usual, when it has one); otherwise a percentage with nothing typed. */
  addWith?: Partial<DepositFormValues>;
}) {
  // Controls that are not the shared fields report their own edits, so a fixed problem stops showing.
  const { markEdited } = useEditedFields();
  const edit = (change: Partial<DepositFormValues>, ...ids: string[]) => {
    ids.forEach(markEdited);
    onChange(change);
  };
  const on = values.depositKind !== "none";
  // In "ask" mode: nothing chosen yet until a choice is made (what is saved is "no deposit" until then).
  const [asked, setAsked] = useState<"none" | "percent" | "fixed" | "">(decided ? values.depositKind : "");
  // Unticking and ticking again brings back the kind that was chosen.
  const [lastKind, setLastKind] = useState<"percent" | "fixed">(values.depositKind === "fixed" ? "fixed" : "percent");

  const handoverLabel = fulfilment === "collection" ? "On collection" : fulfilment === "delivery" ? "On delivery" : "On collection or delivery";

  // What it comes to, when the typing so far makes sense.
  const parsed = on ? parseDeposit(values, issueDate) : null;
  const amounts = parsed?.ok && parsed.deposit && grossCents !== null && grossCents > 0 ? depositAmounts(grossCents, parsed.deposit) : null;

  // Not asked on every quote: a deposit is an optional extra, added with a button and taken away with Remove.
  if (!ask && !on) {
    return (
      <div>
        <AddButton
          id="add-deposit"
          onClick={() => {
            edit({ depositKind: lastKind, ...addWith }, "depositValue", "balanceDueDate");
            setTimeout(() => document.getElementById("depositValue")?.focus(), 0);
          }}
        >
          Add a deposit
        </AddButton>
      </div>
    );
  }

  return (
    <Section title="Deposit" onRemove={ask ? undefined : () => edit({ depositKind: "none", depositValue: "" }, "depositValue", "balanceDueDate")}>
      {ask ? (
        <FieldSet>
          <FieldLegend variant="label" className="text-base">
            Do you want a deposit on this quote?
          </FieldLegend>
          <RadioGroup
            value={asked}
            onValueChange={(v) => {
              const kind = v === "percent" || v === "fixed" ? v : "none";
              setAsked(kind);
              if (kind !== "none") setLastKind(kind);
              edit({ depositKind: kind, depositValue: "" }, "depositValue", "balanceDueDate");
            }}
          >
            {(
              [
                ["none", "No deposit"],
                ["percent", "A percentage of the total"],
                ["fixed", "A fixed amount"],
              ] as const
            ).map(([choice, label]) => (
              <Field key={choice} orientation="horizontal" className="items-start py-2.5">
                <RadioGroupItem id={`deposit-ask-${choice}`} value={choice} />
                <FieldLabel htmlFor={`deposit-ask-${choice}`} className="text-base">
                  {label}
                </FieldLabel>
              </Field>
            ))}
          </RadioGroup>
        </FieldSet>
      ) : null}

      {on && (
        <>
          {!ask && (
          <Field>
            <FieldLabel htmlFor="depositKind">Worked out as</FieldLabel>
            <NativeSelect
              id="depositKind"
              value={values.depositKind}
              onChange={(e) => {
                const kind = e.target.value === "fixed" ? "fixed" : "percent";
                setLastKind(kind);
                edit({ depositKind: kind, depositValue: "" }, "depositValue");
              }}
            >
              <NativeSelectOption value="percent">A percentage of the total</NativeSelectOption>
              <NativeSelectOption value="fixed">A fixed amount</NativeSelectOption>
            </NativeSelect>
          </Field>
          )}
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
              onChange={(e) =>
                edit(
                  { balanceDue: e.target.value === "date" ? "date" : e.target.value === "other" ? "other" : "handover" },
                  "balanceDueDate",
                  "balanceDueText",
                )
              }
            >
              <NativeSelectOption value="handover">{handoverLabel}</NativeSelectOption>
              <NativeSelectOption value="date">By a date I choose</NativeSelectOption>
              <NativeSelectOption value="other">Other: I&apos;ll say when</NativeSelectOption>
            </NativeSelect>
          </Field>
          {values.balanceDue === "other" && (
            <TextField
              id="balanceDueText"
              label="When is the balance due?"
              hint="Follows “Balance, due”, e.g. within 14 days of delivery."
              autoComplete="off"
              maxLength={BALANCE_TEXT_MAX}
              error={errors.balanceDueText}
              value={values.balanceDueText}
              onChange={(balanceDueText) => onChange({ balanceDueText })}
            />
          )}
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
                <FieldError>The deposit is more than the quote total. Lower it before you share the quote.</FieldError>
              )}
            </div>
          )}
        </>
      )}
      {footer}
    </Section>
  );
}
