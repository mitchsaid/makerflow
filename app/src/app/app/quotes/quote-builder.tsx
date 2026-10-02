"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { Section, SelectField, TextAreaField, TextField } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatMoney, formatPercent, type NumberStyle, type VatSettings } from "@/lib/money";
import { addDays } from "@/lib/quotes/dates";
import {
  blankLine,
  previewTotals,
  type DiscountKind,
  type Fulfilment,
  type LineFormValues,
  type QuoteErrors,
  type QuoteFormValues,
} from "@/lib/quotes";
import { saveQuoteDraft, type SaveQuoteState } from "./actions";
import { CustomerPicker, type CustomerOption } from "./customer-picker";

const VALID_FOR_DAYS = [7, 14, 30, 60] as const;

/**
 * One scrolling form: customer, dates, items, delivery or collection, discount, notes. The
 * total is worked out live (the same function the server uses when it saves), and the Save
 * button is always enabled: pressing it with something missing lists what to fix at the
 * fields and in a summary that jumps to the first problem.
 */
export function QuoteBuilder({
  quoteId,
  initial,
  customers,
  vat,
  currencyCode,
  numberStyle,
  taxName,
  justSaved,
}: {
  quoteId: string | null;
  initial: QuoteFormValues;
  customers: CustomerOption[];
  vat: VatSettings;
  currencyCode: string;
  /** How this country writes numbers and money (from its locale pack). */
  numberStyle: NumberStyle;
  /** "VAT": what the country calls its sales tax. */
  taxName: string;
  /** A new draft has just been saved and this page opened on it. */
  justSaved: boolean;
}) {
  const [values, setValues] = useState<QuoteFormValues>(initial);
  const [state, setState] = useState<SaveQuoteState>(
    justSaved ? { status: "saved", savedAt: 0 } : { status: "idle" },
  );
  const [editedSinceSave, setEditedSinceSave] = useState(false);
  const [pending, startTransition] = useTransition();
  const nextKey = useRef(1);

  const money = (cents: number) => formatMoney(cents, currencyCode, numberStyle);
  const totals = useMemo(() => previewTotals(values, vat), [values, vat]);
  const errors: QuoteErrors =
    state.status === "error" && state.errors ? state.errors : { fields: {}, lines: {} };

  function update(change: Partial<QuoteFormValues>) {
    setEditedSinceSave(true);
    setValues((v) => ({ ...v, ...change }));
  }
  function updateLine(key: string, change: Partial<LineFormValues>) {
    setEditedSinceSave(true);
    setValues((v) => ({ ...v, lines: v.lines.map((l) => (l.key === key ? { ...l, ...change } : l)) }));
  }
  function addLine() {
    setEditedSinceSave(true);
    const key = `n-${nextKey.current++}`;
    setValues((v) => ({ ...v, lines: [...v.lines, blankLine(key)] }));
    // Put the cursor in the new item's name once it exists.
    setTimeout(() => document.getElementById(`line-${key}-name`)?.focus(), 0);
  }
  function removeLine(key: string) {
    setEditedSinceSave(true);
    setValues((v) => {
      const rest = v.lines.filter((l) => l.key !== key);
      return { ...v, lines: rest.length > 0 ? rest : [blankLine(`n-${nextKey.current++}`)] };
    });
  }

  function onSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditedSinceSave(false);
    startTransition(async () => {
      const result = await saveQuoteDraft(quoteId, values);
      setState(result);
    });
  }

  // The summary lists problems in the order the fields appear on screen.
  const problems: FormProblem[] = [];
  const f = errors.fields;
  if (f.customerId) problems.push({ fieldId: "customer", label: "Customer", message: f.customerId });
  if (f.issueDate) problems.push({ fieldId: "issueDate", label: "Quote date", message: f.issueDate });
  if (f.validUntil) problems.push({ fieldId: "validUntil", label: "Valid until", message: f.validUntil });
  if (f.neededBy) problems.push({ fieldId: "neededBy", label: "Needed by", message: f.neededBy });
  values.lines.forEach((line, index) => {
    const e = errors.lines[line.key];
    if (!e) return;
    const label = (what: string) => `Item ${index + 1}: ${what}`;
    if (e.name) problems.push({ fieldId: `line-${line.key}-name`, label: label("Item name"), message: e.name });
    if (e.description) problems.push({ fieldId: `line-${line.key}-description`, label: label("Description"), message: e.description });
    if (e.quantity) problems.push({ fieldId: `line-${line.key}-quantity`, label: label("Quantity"), message: e.quantity });
    if (e.unitPrice) problems.push({ fieldId: `line-${line.key}-unitPrice`, label: label("Price"), message: e.unitPrice });
    if (e.discountValue) problems.push({ fieldId: `line-${line.key}-discountValue`, label: label("Discount"), message: e.discountValue });
  });
  if (f.lines) problems.push({ fieldId: "add-item", label: "Items", message: f.lines });
  if (f.deliveryFee) problems.push({ fieldId: "deliveryFee", label: "Delivery fee", message: f.deliveryFee });
  if (f.discountValue) problems.push({ fieldId: "discountValue", label: "Discount", message: f.discountValue });
  if (f.notes) problems.push({ fieldId: "notes", label: "Notes", message: f.notes });

  const priceLabel = !vat.registered
    ? "Price"
    : vat.entry === "inclusive"
      ? `Price (including ${taxName})`
      : `Price (excluding ${taxName})`;

  const discountsCents = totals ? totals.lineDiscountsCents + totals.quoteDiscountCents : 0;

  return (
    <form onSubmit={onSave} className="space-y-6" noValidate>
      <Section title="Customer">
        <CustomerPicker
          id="customer"
          customers={customers}
          value={values.customerId}
          onChange={(customerId) => update({ customerId })}
          error={f.customerId}
        />
      </Section>

      <Section title="Dates">
        <TextField
          id="issueDate"
          type="date"
          label="Quote date"
          value={values.issueDate}
          error={f.issueDate}
          onChange={(issueDate) => update({ issueDate })}
        />
        <TextField
          id="validUntil"
          type="date"
          label="Valid until"
          value={values.validUntil}
          error={f.validUntil}
          onChange={(validUntil) => update({ validUntil })}
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Valid for">
          {VALID_FOR_DAYS.map((days) => {
            const target = values.issueDate ? safeAddDays(values.issueDate, days) : null;
            return (
              <Button
                key={days}
                type="button"
                variant="outline"
                aria-pressed={target !== null && target === values.validUntil}
                aria-label={`Valid for ${days} days`}
                className="aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary"
                onClick={() => target && update({ validUntil: target })}
              >
                {days} days
              </Button>
            );
          })}
        </div>
        <TextField
          id="neededBy"
          type="date"
          label="Needed by (optional)"
          value={values.neededBy}
          error={f.neededBy}
          onChange={(neededBy) => update({ neededBy })}
        />
      </Section>

      <Section title="Items">
        {values.lines.map((line, index) => (
          <LineEditor
            key={line.key}
            line={line}
            number={index + 1}
            errors={errors.lines[line.key]}
            priceLabel={priceLabel}
            lineTotal={(() => {
              const r = totals?.lines.find((l) => l.id === line.key);
              return r ? money(r.amountBeforeDiscountCents - r.lineDiscountCents) : null;
            })()}
            onChange={(change) => updateLine(line.key, change)}
            onRemove={() => removeLine(line.key)}
          />
        ))}
        <Button id="add-item" type="button" variant="outline" onClick={addLine}>
          Add another item
        </Button>
      </Section>

      <Section title="Delivery or collection">
        <RadioGroup
          aria-label="Delivery or collection"
          value={values.fulfilment}
          onValueChange={(v) => update({ fulfilment: v as Fulfilment })}
        >
          {(
            [
              ["none", "Not decided yet"],
              ["collection", "Collection (the customer collects)"],
              ["delivery", "Delivery (you deliver, with a fee)"],
            ] as const
          ).map(([option, label]) => (
            <Field key={option} orientation="horizontal" className="min-h-11 items-center">
              <RadioGroupItem id={`fulfilment-${option}`} value={option} />
              <FieldLabel htmlFor={`fulfilment-${option}`} className="text-base">
                {label}
              </FieldLabel>
            </Field>
          ))}
        </RadioGroup>
        {values.fulfilment === "delivery" && (
          <TextField
            id="deliveryFee"
            label={
              vat.registered
                ? `Delivery fee (${vat.entry === "inclusive" ? "including" : "excluding"} ${taxName})`
                : "Delivery fee"
            }
            inputMode="decimal"
            autoComplete="off"
            value={values.deliveryFee}
            error={f.deliveryFee}
            onChange={(deliveryFee) => update({ deliveryFee })}
          />
        )}
        {values.fulfilment === "delivery" && (
          <FieldDescription>Leave the fee empty if delivery is free.</FieldDescription>
        )}
      </Section>

      <Section title="Discount">
        <Field>
          <FieldLabel htmlFor="discountKind">Discount on the whole quote</FieldLabel>
          <NativeSelect
            id="discountKind"
            value={values.discountKind}
            onChange={(e) =>
              update({
                discountKind: e.target.value as DiscountKind,
                discountValue: e.target.value === "none" ? "" : values.discountValue,
              })
            }
          >
            <NativeSelectOption value="none">No discount</NativeSelectOption>
            <NativeSelectOption value="percent">A percentage</NativeSelectOption>
            <NativeSelectOption value="fixed">An amount</NativeSelectOption>
          </NativeSelect>
        </Field>
        {values.discountKind !== "none" && (
          <TextField
            id="discountValue"
            label={values.discountKind === "percent" ? "Discount (%)" : "Discount amount"}
            inputMode="decimal"
            autoComplete="off"
            value={values.discountValue}
            error={f.discountValue}
            onChange={(discountValue) => update({ discountValue })}
          />
        )}
      </Section>

      <Section title="Notes">
        <TextAreaField
          id="notes"
          label="Notes for the customer (optional)"
          hint="Shown on the quote, for example how long the work takes."
          value={values.notes}
          error={f.notes}
          onChange={(notes) => update({ notes })}
          maxLength={2000}
        />
      </Section>

      <Section title="Totals">
        <dl className="space-y-1 text-base" data-testid="totals">
          {discountsCents > 0 && totals && (
            <>
              <Row label="Items before discount" value={money(totals.subtotalCents + discountsCents)} />
              <Row label="Discount" value={`−${money(discountsCents)}`} />
            </>
          )}
          {vat.registered && vat.entry === "exclusive" && totals && (
            <>
              <Row label={`Total excluding ${taxName}`} value={money(totals.netCents)} />
              <Row label={`${taxName} (${formatPercent(vat.standardRateBp, numberStyle)})`} value={money(totals.vatCents)} />
            </>
          )}
          <Row label="Total" value={totals ? money(totals.grossCents) : "–"} strong />
          {vat.registered && vat.entry === "inclusive" && totals && (
            <Row
              label={`Includes ${taxName} (${formatPercent(vat.standardRateBp, numberStyle)})`}
              value={money(totals.vatCents)}
            />
          )}
        </dl>
      </Section>

      {state.status === "error" && state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <FormSummary problems={problems} trigger={state} />
      {state.status === "saved" && !pending && !editedSinceSave && (
        <p role="status" className="text-sm font-medium">
          Draft saved.
        </p>
      )}

      {/* Stays in view above the tab bar while scrolling; the page has room below for it. */}
      <div className="sticky bottom-14 z-10 -mx-4 border-t border-border bg-card px-4 py-3 md:bottom-0">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-lg font-semibold" data-testid="sticky-total">
              {totals ? money(totals.grossCents) : "–"}
            </p>
          </div>
          <Button type="submit" disabled={pending} size="lg">
            {pending ? "Saving…" : "Save draft"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function safeAddDays(day: string, days: number): string | null {
  try {
    return addDays(day, days);
  } catch {
    return null;
  }
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? "text-lg font-semibold" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function LineEditor({
  line,
  number,
  errors,
  priceLabel,
  lineTotal,
  onChange,
  onRemove,
}: {
  line: LineFormValues;
  number: number;
  errors: QuoteErrors["lines"][string] | undefined;
  priceLabel: string;
  lineTotal: string | null;
  onChange: (change: Partial<LineFormValues>) => void;
  onRemove: () => void;
}) {
  const e = errors ?? {};
  const hasExtras = line.description !== "" || line.discountKind !== "none";
  const [showExtras, setShowExtras] = useState(hasExtras || !!e.description || !!e.discountValue);
  const id = (field: string) => `line-${line.key}-${field}`;

  return (
    <Card className="bg-muted/30">
      <CardContent>
        <FieldSet>
          <FieldLegend variant="label">Item {number}</FieldLegend>
          <div className="space-y-4">
            <TextField
              id={id("name")}
              label="Item name"
              autoComplete="off"
              maxLength={200}
              value={line.name}
              error={e.name}
              onChange={(name) => onChange({ name })}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                id={id("quantity")}
                label="Quantity"
                inputMode="decimal"
                autoComplete="off"
                value={line.quantity}
                error={e.quantity}
                onChange={(quantity) => onChange({ quantity })}
              />
              <TextField
                id={id("unitPrice")}
                label={priceLabel}
                inputMode="decimal"
                autoComplete="off"
                value={line.unitPrice}
                error={e.unitPrice}
                onChange={(unitPrice) => onChange({ unitPrice })}
              />
            </div>
            {lineTotal !== null && line.unitPrice.trim() !== "" && (
              <p className="text-sm text-muted-foreground">Item total {lineTotal}</p>
            )}

            {showExtras ? (
              <>
                <TextAreaField
                  id={id("description")}
                  label="Description (optional)"
                  value={line.description}
                  error={e.description}
                  onChange={(description) => onChange({ description })}
                  maxLength={1000}
                />
                <SelectField
                  id={id("discountKind")}
                  label="Discount on this item"
                  value={line.discountKind === "none" ? "" : line.discountKind}
                  onChange={(kind) =>
                    onChange({
                      discountKind: (kind === "" ? "none" : kind) as DiscountKind,
                      discountValue: kind === "" ? "" : line.discountValue,
                    })
                  }
                  placeholder="No discount"
                  options={["percent", "fixed"]}
                  optionLabels={{ percent: "A percentage", fixed: "An amount" }}
                />
                {line.discountKind !== "none" && (
                  <TextField
                    id={id("discountValue")}
                    label={line.discountKind === "percent" ? "Item discount (%)" : "Item discount amount"}
                    inputMode="decimal"
                    autoComplete="off"
                    value={line.discountValue}
                    error={e.discountValue}
                    onChange={(discountValue) => onChange({ discountValue })}
                  />
                )}
              </>
            ) : (
              <Button
                type="button"
                variant="ghost"
                aria-expanded={false}
                onClick={() => setShowExtras(true)}
              >
                Add a description or discount
              </Button>
            )}

            <Button type="button" variant="ghost" onClick={onRemove}>
              Remove item {number}
            </Button>
          </div>
        </FieldSet>
      </CardContent>
    </Card>
  );
}
