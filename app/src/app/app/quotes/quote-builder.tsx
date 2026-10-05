"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { Section, TextAreaField, TextField } from "@/components/form-fields";
import { TermsStarters } from "@/components/terms-starters";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  formatMoney,
  currencySymbol,
  formatPercent,
  parseMoney,
  parseQuantity,
  type NumberStyle,
  type VatSettings,
} from "@/lib/money";
import type { ProductSummary } from "@/lib/products";
import { priceEntryLabel } from "@/lib/locale";
import { addDays } from "@/lib/quotes/dates";
import {
  previewTotals,
  type DiscountKind,
  type Fulfilment,
  type LineFormValues,
  type QuoteErrors,
  type QuoteFormValues,
} from "@/lib/quotes";
import { saveQuoteDraft, type SaveQuoteState } from "./actions";
import type { CustomerOption } from "@/lib/customers";
import { CustomerPicker } from "./customer-picker";
import { LineSheet, type LineSheetView } from "./line-sheet";

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
  products: initialProducts,
  vat,
  currencyCode,
  countryCode,
  numberStyle,
  taxName,
  justSaved,
  focusOnLoad,
  children,
}: {
  quoteId: string | null;
  initial: QuoteFormValues;
  customers: CustomerOption[];
  /** The business's products and services, for the item sheet. */
  products: ProductSummary[];
  vat: VatSettings;
  currencyCode: string;
  countryCode: string;
  /** How this country writes numbers and money (from its locale pack). */
  numberStyle: NumberStyle;
  /** "VAT": what the country calls its sales tax. */
  taxName: string;
  /** A new draft has just been saved and this page opened on it. */
  justSaved: boolean;
  /** The field to land on (the preview sends people back to fix something). */
  focusOnLoad?: string;
  /** What goes between the form and the bar, such as Delete draft. */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [values, setValues] = useState<QuoteFormValues>(initial);
  const [state, setState] = useState<SaveQuoteState>(
    justSaved ? { status: "saved", savedAt: 0 } : { status: "idle" },
  );
  const [editedSinceSave, setEditedSinceSave] = useState(false);
  const [pending, startTransition] = useTransition();
  const nextKey = useRef(1);

  const money = (cents: number) => formatMoney(cents, currencyCode, numberStyle);
  const symbol = currencySymbol(currencyCode, numberStyle);
  const totals = useMemo(() => previewTotals(values, vat), [values, vat]);
  const errors: QuoteErrors =
    state.status === "error" && state.errors ? state.errors : { fields: {}, lines: {} };

  function update(change: Partial<QuoteFormValues>) {
    setEditedSinceSave(true);
    setValues((v) => ({ ...v, ...change }));
  }
  // The item sheet: choosing what to add, configuring a line, or a product form.
  const [products, setProducts] = useState(initialProducts);
  const [sheetView, setSheetView] = useState<LineSheetView | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const newKey = () => `n-${nextKey.current++}`;
  // Where focus goes when the sheet closes: the line just added or changed, else the default.
  const focusAfterSheet = useRef<string | null>(null);

  function openSheet(view: LineSheetView) {
    focusAfterSheet.current = null;
    setSheetView(view);
    setSheetOpen(true);
  }
  function closeSheet() {
    setSheetOpen(false);
  }
  function saveLine(line: LineFormValues, isNew: boolean) {
    setEditedSinceSave(true);
    setValues((v) => ({
      ...v,
      lines: isNew ? [...v.lines, line] : v.lines.map((l) => (l.key === line.key ? line : l)),
    }));
    // Back on the quote, keyboard focus goes to the line that was just added or changed.
    focusAfterSheet.current = `line-${line.key}-edit`;
    setSheetOpen(false);
  }
  function removeLine(key: string, index: number) {
    setEditedSinceSave(true);
    setValues((v) => ({ ...v, lines: v.lines.filter((l) => l.key !== key) }));
    // Focus moves to the next line's Edit, or to "Add item" when it was the last one.
    setTimeout(() => {
      const next = values.lines[index + 1] ?? values.lines[index - 1];
      const target = next && next.key !== key ? `line-${next.key}-edit` : "add-item";
      document.getElementById(target)?.focus();
    }, 0);
  }
  function productSaved(product: ProductSummary) {
    setProducts((list) =>
      list.some((p) => p.id === product.id)
        ? // An edit never changes whether a product is archived.
          list.map((p) => (p.id === product.id ? { ...product, archived: p.archived } : p))
        : [...list, product],
    );
  }

  useEffect(() => {
    if (!focusOnLoad || quoteId === null) return;
    const el = document.getElementById(focusOnLoad);
    el?.scrollIntoView({ block: "center" });
    el?.focus({ preventScroll: true });
    // The address no longer says where to land, so refreshing doesn't jump again.
    window.history.replaceState(null, "", `/app/quotes/${quoteId}`);
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Saves the draft; with `then: "preview"` the preview opens once it is saved. */
  function save(then?: "preview") {
    setEditedSinceSave(false);
    startTransition(async () => {
      try {
        const result = await saveQuoteDraft(quoteId, values, then);
        setState(result);
        if (result.status === "saved" && then === "preview" && quoteId !== null) {
          router.push(`/app/quotes/${quoteId}/preview`);
        }
        if (result.status === "error") setEditedSinceSave(true);
      } catch (error) {
        // A new quote is saved by a redirect to its own page: that is not a failure.
        const digest = (error as { digest?: unknown } | null)?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw error;
        // No signal, say: keep the form exactly as it is and say so, never an error page.
        console.error("could not save the quote:", error);
        setEditedSinceSave(true);
        setState({
          status: "error",
          message:
            "Couldn't reach the server, so the draft was not saved. Check your connection and press Save again. Nothing you typed is lost.",
        });
      }
    });
  }

  function onSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save();
  }

  /** The preview shows what is saved, so unsaved changes are saved first. */
  function onPreview() {
    if (quoteId === null || editedSinceSave) save("preview");
    else router.push(`/app/quotes/${quoteId}/preview`);
  }

  // The summary lists problems in the order the fields appear on screen.
  const problems: FormProblem[] = [];
  const f = errors.fields;
  if (f.customerId) problems.push({ fieldId: "customer", label: "Customer", message: f.customerId });
  if (f.title) problems.push({ fieldId: "title", label: "Quote title", message: f.title });
  if (f.description) problems.push({ fieldId: "description", label: "Description", message: f.description });
  if (f.issueDate) problems.push({ fieldId: "issueDate", label: "Quote date", message: f.issueDate });
  if (f.validUntil) problems.push({ fieldId: "validUntil", label: "Valid until", message: f.validUntil });
  if (f.neededBy) problems.push({ fieldId: "neededBy", label: "Needed by", message: f.neededBy });
  values.lines.forEach((line, index) => {
    const e = errors.lines[line.key];
    if (!e) return;
    const message = e.name ?? e.quantity ?? e.unitPrice ?? e.discountValue ?? e.description;
    if (message) {
      problems.push({ fieldId: `line-${line.key}-edit`, label: `Item ${index + 1}: ${line.name || "item"}`, message });
    }
  });
  if (f.lines) problems.push({ fieldId: "add-item", label: "Items", message: f.lines });
  if (f.deliveryFee) problems.push({ fieldId: "deliveryFee", label: "Delivery fee", message: f.deliveryFee });
  if (f.discountValue) problems.push({ fieldId: "discountValue", label: "Discount", message: f.discountValue });
  if (f.notes) problems.push({ fieldId: "notes", label: "Notes", message: f.notes });
  if (f.paymentInstructions) {
    problems.push({ fieldId: "paymentInstructions", label: "How to pay", message: f.paymentInstructions });
  }
  if (f.terms) problems.push({ fieldId: "terms", label: "Terms", message: f.terms });
  if (f.signOff) problems.push({ fieldId: "signOff", label: "Sign-off", message: f.signOff });

  const priceLabel = priceEntryLabel(vat, taxName);

  const discountsCents = totals ? totals.lineDiscountsCents + totals.quoteDiscountCents : 0;

  return (
  <div className="space-y-6">
    <form id="quote-form" onSubmit={onSave} className="space-y-6" noValidate>
      <Section title="Customer">
        <CustomerPicker
          id="customer"
          customers={customers}
          countryCode={countryCode}
          value={values.customerId}
          onChange={(customerId) => update({ customerId })}
          error={f.customerId}
        />
      </Section>

      <Section title="About this quote">
        <TextField
          id="title"
          label="Quote title (optional)"
          autoComplete="off"
          maxLength={120}
          value={values.title}
          error={f.title}
          onChange={(title) => update({ title })}
        />
        <TextAreaField
          id="description"
          label="Description (optional)"
          hint="An introduction under the title, like “Thank you for asking about your wedding cake.”"
          value={values.description}
          error={f.description}
          onChange={(description) => update({ description })}
          maxLength={2000}
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
        {values.lines.length === 0 && (
          <p className="text-muted-foreground">
            No items yet. Add one of your products or services, or a one-off item.
          </p>
        )}
        {values.lines.length > 0 && (
          <ul className="space-y-2" aria-label="Items on this quote">
            {values.lines.map((line, index) => (
              <LineRow
                key={line.key}
                line={line}
                number={index + 1}
                error={(() => {
                  const e = errors.lines[line.key];
                  return e ? (e.name ?? e.quantity ?? e.unitPrice ?? e.discountValue ?? e.description) : undefined;
                })()}
                money={money}
                lineTotal={(() => {
                  const r = totals?.lines.find((l) => l.id === line.key);
                  return r ? r.amountBeforeDiscountCents - r.lineDiscountCents : null;
                })()}
                onEdit={() => openSheet({ kind: "configure", line, isNew: false })}
                onRemove={() => removeLine(line.key, index)}
              />
            ))}
          </ul>
        )}
        <Button id="add-item" type="button" variant="outline" onClick={() => openSheet({ kind: "pick" })}>
          Add item
        </Button>
        <LineSheet
          open={sheetOpen}
          view={sheetView}
          products={products}
          numberStyle={numberStyle}
          currencyCode={currencyCode}
          priceLabel={priceLabel}
          newKey={newKey}
          onView={openSheet}
          onClose={closeSheet}
          onSaveLine={saveLine}
          onProductSaved={productSaved}
          focusOnClose={() => focusAfterSheet.current}
        />
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
            label={priceEntryLabel(vat, taxName, "Delivery fee")}
            startText={symbol}
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
            startText={values.discountKind === "fixed" ? symbol : undefined}
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

      <Section title="Payment and terms">
        <TextAreaField
          id="paymentInstructions"
          label="How to pay (optional)"
          hint="Bank details, SnapScan, or “pay on collection”. Shown on the quote."
          value={values.paymentInstructions}
          error={f.paymentInstructions}
          onChange={(paymentInstructions) => update({ paymentInstructions })}
          maxLength={1000}
        />
        <TextAreaField
          id="terms"
          label="Terms (optional)"
          hint="Shown in small print at the end of the quote."
          value={values.terms}
          error={f.terms}
          onChange={(terms) => update({ terms })}
          maxLength={4000}
        />
        <TermsStarters terms={values.terms} onChange={(terms) => update({ terms })} />
      </Section>

      <Section title="Sign-off">
        <TextField
          id="signOff"
          label="Sign-off (optional)"
          autoComplete="off"
          maxLength={200}
          value={values.signOff}
          error={f.signOff}
          onChange={(signOff) => update({ signOff })}
          hint="Like “Yours in sweetness”. Shown at the end of the quote, with your business name."
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
    </form>

    {children}

      {/* Always in view above the tab bar. It comes last, after anything under the form (such as
          Delete draft), so nothing is hidden beneath it, and it sits flush with the end of the
          page (-mb-8 takes back the page's bottom padding) so it never moves when you reach the bottom. */}
      <div data-testid="action-bar" className="sticky bottom-14 z-10 -mx-4 -mb-8 border-t border-border bg-card px-4 py-3 md:bottom-0">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-lg font-semibold" data-testid="sticky-total">
              {totals ? money(totals.grossCents) : "–"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" form="quote-form" variant="outline" disabled={pending} size="lg">
              {pending ? "Saving…" : "Save draft"}
            </Button>
            <Button id="preview-quote" type="button" disabled={pending} size="lg" onClick={onPreview}>
              Preview
            </Button>
          </div>
        </div>
      </div>
  </div>
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

/** One line on the quote: what it is, how many at what price, its total, and Edit / Remove. */
function LineRow({
  line,
  number,
  error,
  money,
  lineTotal,
  onEdit,
  onRemove,
}: {
  line: LineFormValues;
  number: number;
  error?: string;
  money: (cents: number) => string;
  lineTotal: number | null;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const quantity = parseQuantity(line.quantity);
  const price = parseMoney(line.unitPrice);
  const name = line.name.trim() || `Item ${number}`;
  return (
    <li>
      <Card className="bg-muted/30" data-testid="quote-line">
        <CardContent className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-base font-medium">{name}</p>
            <p className="shrink-0 text-base font-medium">{lineTotal !== null ? money(lineTotal) : "–"}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            {quantity.ok ? (line.unit.trim() ? `${line.quantity} ${line.unit.trim()}` : line.quantity) : "?"} × {price.ok ? money(price.value) : "?"}
            {line.discountKind !== "none" && " · discount"}
            {!line.productId && " · one-off item"}
          </p>
          {line.description && <p className="line-clamp-2 text-sm text-muted-foreground">{line.description}</p>}
          {error && (
            <p className="text-sm text-destructive" id={`line-${line.key}-error`}>
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              id={`line-${line.key}-edit`}
              type="button"
              variant="outline"
              aria-describedby={error ? `line-${line.key}-error` : undefined}
              onClick={onEdit}
            >
              Edit<span className="sr-only"> {name}</span>
            </Button>
            <Button type="button" variant="ghost" onClick={onRemove}>
              Remove<span className="sr-only"> {name}</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}
