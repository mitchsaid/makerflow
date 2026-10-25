"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AddButton } from "@/components/add-button";
import { ComingSoonSection } from "@/components/coming-soon";
import { FormErrorScope } from "@/components/form-errors";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { SelectField, TextAreaField, TextField } from "@/components/form-fields";
import { QuantityField } from "@/components/quantity-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  CREDIT_EXPLANATION_MAX,
  CREDIT_REASONS,
  creditTotals,
  defaultCreditAmount,
  isZeroQuantityText,
  parseCreditForm,
  type CreditFormErrors,
  type CreditFormValues,
  type CreditLineForm,
  type CreditNoteSummary,
  type CreditRemaining,
} from "@/lib/credit-notes";
import { formatMoney, moneyToInput, parseMoney, parseQuantity, quantityToInput, type NumberStyle, type VatGroup, type VatSettings } from "@/lib/money";
import { formatDay } from "@/lib/quotes/dates";
import { quantityText } from "@/lib/quotes/units";
import { issueCreditNote } from "./credit-actions";

const OFFLINE = "Couldn't reach the server. Refresh the page to see if it went through before trying again.";

type Props = {
  invoiceId: string;
  number: string;
  currencyCode: string;
  numberStyle: NumberStyle;
  formatLocale: string;
  symbol: string;
  today: string;
  invoiceDate: string;
  reasons: Record<string, string>;
  notes: CreditNoteSummary[];
  items: CreditRemaining[];
  vat: VatSettings;
  /** "VAT", in the country's word, from the invoice's own document. */
  taxName: string;
  invoiceGroups: VatGroup[];
  priorGroups: VatGroup[];
  creditedCents: number;
  totalCents: number;
  /** More was paid than the invoice now comes to: what the customer is owed back. */
  refundDueCents: number;
};

/** What has been credited on an invoice, and the way to credit more. */
export function CreditNotesSection(props: Props) {
  const { currencyCode, numberStyle, formatLocale, notes, items, creditedCents, totalCents, refundDueCents } = props;
  const money = (cents: number) => formatMoney(cents, currencyCode, numberStyle);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const canCredit = creditedCents < totalCents && items.some((i) => i.amountLeftCents > 0);

  return (
    <section className="space-y-3" aria-labelledby="credit-notes-heading">
      <h2 id="credit-notes-heading" className="text-base font-semibold">
        Credit notes
      </h2>
      <Card>
        <CardContent className="space-y-4">
          {notes.length === 0 ? (
            <p className="text-base text-muted-foreground">None. Issue one to correct this invoice without changing it.</p>
          ) : (
            <>
              <p className="text-base" data-testid="credited-total">
                Credited so far: <span className="font-medium">{money(creditedCents)}</span>
              </p>
              <ul className="space-y-2" aria-label="Credit notes issued" data-testid="credit-notes">
                {notes.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/app/credit-notes/${c.id}`}
                      className="block rounded-xl bg-muted/40 p-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-medium">{c.number}</span>
                        <span className="font-medium">{money(c.grossCents)}</span>
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {formatDay(c.issueDate, formatLocale)} · {props.reasons[c.reason]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          {refundDueCents > 0 && (
            <div className="space-y-2 rounded-xl bg-muted/40 p-3 ring-1 ring-foreground/10" data-testid="refund-due">
              <p className="text-base">
                They have paid {money(refundDueCents)} more than this invoice now comes to.
              </p>
              <ComingSoonSection title="Record a refund" description="Note the money you gave back." />
            </div>
          )}

          {canCredit ? (
            <AddButton id="issue-credit-note" variant="outline" size="lg" onClick={() => setOpen(true)}>
              Issue a credit note
            </AddButton>
          ) : (
            <p className="text-base font-medium" data-testid="fully-credited">
              Everything on this invoice has been credited.
            </p>
          )}
        </CardContent>
      </Card>

      <Sheet open={open} onOpenChange={(isOpen) => !busy && setOpen(isOpen)}>
        <SheetContent side="right" className="h-dvh gap-0 overflow-y-auto" finalFocus={() => document.getElementById("issue-credit-note") ?? true}>
          {/* Mounted only while open, so every opening starts fresh. */}
          {open && <CreditForm {...props} onBusyChange={setBusy} onCancel={() => setOpen(false)} />}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function CreditForm({
  invoiceId,
  number,
  currencyCode,
  numberStyle,
  symbol,
  today,
  invoiceDate,
  reasons,
  items,
  vat,
  taxName,
  invoiceGroups,
  priorGroups,
  onBusyChange,
  onCancel,
}: Props & { onBusyChange: (busy: boolean) => void; onCancel: () => void }) {
  const router = useRouter();
  const money = (cents: number) => formatMoney(cents, currencyCode, numberStyle);
  const quantity = (milli: number, unit: string | null) => quantityText(milli, unit, numberStyle, " ");
  const [values, setValues] = useState<CreditFormValues>({
    reason: "",
    issueDate: today,
    explanation: "",
    lines: items.map((i) => ({ index: i.index, selected: false, quantity: "", amount: "" })),
  });
  // An amount the maker typed is theirs: a change of quantity no longer fills it in.
  const [typedAmount, setTypedAmount] = useState<Record<number, boolean>>({});
  const [errors, setErrors] = useState<CreditFormErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [pending, startTransition] = useTransition();

  const context = { remaining: items, invoiceDate, today, money, quantity };

  function setLine(index: number, change: Partial<CreditLineForm>) {
    setValues((v) => ({ ...v, lines: v.lines.map((l) => (l.index === index ? { ...l, ...change } : l)) }));
  }

  function tick(item: CreditRemaining, on: boolean) {
    setLine(
      item.index,
      on ? { selected: true, quantity: quantityToInput(item.quantityLeftMilli, numberStyle), amount: moneyToInput(item.amountLeftCents, numberStyle) } : { selected: false },
    );
    if (!on) setTypedAmount((t) => ({ ...t, [item.index]: false }));
  }

  function changeQuantity(item: CreditRemaining, text: string) {
    const q = isZeroQuantityText(text) ? { ok: true as const, value: 0 } : parseQuantity(text);
    const change: Partial<CreditLineForm> = { quantity: text };
    if (q.ok && !typedAmount[item.index] && q.value <= item.quantityLeftMilli) {
      change.amount = moneyToInput(defaultCreditAmount(item, q.value), numberStyle);
    }
    setLine(item.index, change);
  }

  function creditEverything() {
    setValues((v) => ({
      ...v,
      lines: items.map((item) =>
        item.amountLeftCents > 0
          ? { index: item.index, selected: true, quantity: quantityToInput(item.quantityLeftMilli, numberStyle), amount: moneyToInput(item.amountLeftCents, numberStyle) }
          : { index: item.index, selected: false, quantity: "", amount: "" },
      ),
    }));
    setTypedAmount({});
  }

  // The credit note's total as it stands, from the ticked items that make sense so far.
  const live = values.lines.flatMap((l) => {
    const item = items.find((i) => i.index === l.index);
    const amount = parseMoney(l.amount);
    return l.selected && item && amount.ok && amount.value > 0 && amount.value <= item.amountLeftCents
      ? [{ amountCents: amount.value, vatStatus: item.vatStatus }]
      : [];
  });
  const totals = live.length > 0 ? creditTotals({ lines: live, vat, invoiceGroups, priorGroups }) : null;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    setMessage(null);
    setTries((n) => n + 1);
    const checked = parseCreditForm(values, context);
    setErrors(checked.ok ? {} : checked.errors);
    if (!checked.ok) return;
    onBusyChange(true);
    startTransition(async () => {
      try {
        const result = await issueCreditNote(invoiceId, values);
        onBusyChange(false);
        if (result.status === "invalid") {
          setErrors(result.errors);
          setTries((n) => n + 1);
          router.refresh();
        } else setMessage(result.message);
      } catch (error) {
        // Issuing ends by opening the credit note: that is a redirect, not a failure.
        const digest = (error as { digest?: unknown } | null)?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw error;
        onBusyChange(false);
        setMessage(OFFLINE);
      }
    });
  }

  const summary: FormProblem[] = [
    ...(errors.reason ? [{ fieldId: "credit-reason", label: "Reason", message: errors.reason }] : []),
    ...(errors.issueDate ? [{ fieldId: "credit-date", label: "Credit note date", message: errors.issueDate }] : []),
    ...(errors.lines ? [{ fieldId: `credit-line-${(items.find((i) => i.amountLeftCents > 0) ?? items[0])?.index ?? 0}`, label: "Items", message: errors.lines }] : []),
    ...Object.entries(errors.byLine ?? {}).flatMap(([index, e]) => [
      ...(e.quantity ? [{ fieldId: `credit-line-${index}-quantity`, label: `${items.find((i) => i.index === Number(index))?.name ?? "Item"}: how many`, message: e.quantity }] : []),
      ...(e.amount ? [{ fieldId: `credit-line-${index}-amount`, label: `${items.find((i) => i.index === Number(index))?.name ?? "Item"}: amount`, message: e.amount }] : []),
    ]),
    ...(errors.explanation ? [{ fieldId: "credit-explanation", label: "Explanation", message: errors.explanation }] : []),
  ];

  return (
    <>
      <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover pr-14">
        <SheetTitle className="text-lg">Issue a credit note</SheetTitle>
        <SheetDescription className="text-base">Corrects {number}. The invoice stays as it is.</SheetDescription>
      </SheetHeader>
      <FormErrorScope epoch={tries}>
        <form onSubmit={submit} noValidate className="space-y-4 px-4 py-4">
          <FormSummary problems={summary} trigger={tries} />
          {message && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          <SelectField
            id="credit-reason"
            label="Reason"
            placeholder="Choose a reason"
            options={CREDIT_REASONS}
            optionLabels={reasons}
            value={values.reason}
            error={errors.reason}
            onChange={(reason) => setValues((v) => ({ ...v, reason }))}
          />
          <TextField
            id="credit-date"
            type="date"
            label="Credit note date"
            max={today}
            value={values.issueDate}
            error={errors.issueDate}
            onChange={(issueDate) => setValues((v) => ({ ...v, issueDate }))}
          />

          <fieldset className="space-y-3" aria-describedby={errors.lines ? "credit-lines-error" : undefined}>
            <legend className="text-base font-medium">What is being credited</legend>
            <Button type="button" variant="outline" onClick={creditEverything}>
              Credit everything left
            </Button>
            {errors.lines && (
              <p id="credit-lines-error" role="alert" className="text-sm text-destructive">
                {errors.lines}
              </p>
            )}
            <ul className="space-y-3">
              {items.map((item) => {
                const line = values.lines.find((l) => l.index === item.index)!;
                const lineErrors = errors.byLine?.[item.index] ?? {};
                const done = item.amountLeftCents <= 0;
                return (
                  <li key={item.index} className="space-y-3 rounded-xl bg-muted/40 p-3 ring-1 ring-foreground/10" data-testid="credit-item">
                    <Field orientation="horizontal" className="items-start">
                      <Checkbox
                        id={`credit-line-${item.index}`}
                        checked={line.selected}
                        disabled={done}
                        onCheckedChange={(checked) => tick(item, checked === true)}
                      />
                      <FieldLabel htmlFor={`credit-line-${item.index}`} className="text-base">
                        <span>
                          {item.name}
                          <span className="block text-sm font-normal text-muted-foreground">
                            {done
                              ? "All of it has been credited."
                              : `${quantity(item.quantityLeftMilli, item.unit)} left to credit (${money(item.amountLeftCents)})`}
                          </span>
                        </span>
                      </FieldLabel>
                    </Field>
                    {line.selected && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <QuantityField
                          id={`credit-line-${item.index}-quantity`}
                          label="How many"
                          hint="0 if it is only a price change."
                          unit={item.unit ?? undefined}
                          stepper
                          numberStyle={numberStyle}
                          min={0}
                          value={line.quantity}
                          error={lineErrors.quantity}
                          onChange={(text) => changeQuantity(item, text)}
                        />
                        <TextField
                          id={`credit-line-${item.index}-amount`}
                          label="Amount credited"
                          inputMode="decimal"
                          autoComplete="off"
                          startText={symbol}
                          value={line.amount}
                          error={lineErrors.amount}
                          onChange={(amount) => {
                            setTypedAmount((t) => ({ ...t, [item.index]: true }));
                            setLine(item.index, { amount });
                          }}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </fieldset>

          <TextAreaField
            id="credit-explanation"
            label="Explanation"
            hint="A few words. The credit note shows them."
            rows={3}
            maxLength={CREDIT_EXPLANATION_MAX + 100}
            value={values.explanation}
            error={errors.explanation}
            onChange={(explanation) => setValues((v) => ({ ...v, explanation }))}
          />

          <ComingSoonSection title="Put returned items back in stock" description="Add what came back to your stock." />

          <dl className="space-y-1 rounded-xl bg-muted/40 p-3 text-base ring-1 ring-foreground/10" data-testid="credit-total">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Credit total</dt>
              <dd className="font-medium">{totals ? money(totals.grossCents) : money(0)}</dd>
            </div>
            {totals && vat.registered && (
              <div className="flex justify-between gap-4 text-sm">
                <dt className="text-muted-foreground">Includes {taxName}</dt>
                <dd>{money(totals.vatCents)}</dd>
              </div>
            )}
          </dl>
          <p className="text-sm text-muted-foreground">
            It gets the next credit note number and can&apos;t be changed or deleted.
          </p>
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "Issuing…" : "Issue credit note"}
          </Button>
          <Button type="button" size="lg" variant="outline" className="w-full" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
        </form>
      </FormErrorScope>
    </>
  );
}
