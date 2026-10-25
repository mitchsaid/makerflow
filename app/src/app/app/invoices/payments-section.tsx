"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AddButton } from "@/components/add-button";
import { FormErrorScope } from "@/components/form-errors";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { SelectField, TextAreaField, TextField } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PAYMENT_METHODS, PAYMENT_NOTE_MAX, parsePaymentForm, type PaymentFormErrors, type PaymentFormValues, type PaymentRow } from "@/lib/invoices/payments";
import { formatMoney, moneyToInput, type NumberStyle } from "@/lib/money";
import { formatDay } from "@/lib/quotes/dates";
import { recordPayment, reversePayment } from "./actions";

const OFFLINE = "Couldn't reach the server. Refresh the page to see if it went through before trying again.";

type Props = {
  invoiceId: string;
  number: string;
  currencyCode: string;
  numberStyle: NumberStyle;
  formatLocale: string;
  symbol: string;
  /** Today, as YYYY-MM-DD, where the business is. */
  today: string;
  grossCents: number;
  paidCents: number;
  rows: PaymentRow[];
  /** The ways to pay, in the country's words. */
  methods: Record<string, string>;
  /** What the quote asked for up front, if it asked. */
  depositCents: number | null;
  /** Credit notes took off the whole invoice: nothing is owing, whatever was paid. */
  fullyCredited?: boolean;
  /** What the deposit's note says ("Deposit"), in the country's words. */
  depositNote: string;
};

/**
 * What has been paid on an invoice, and the way to record more. Entries are never changed: a mistake is reversed, and
 * the reversed payment stays in the list, marked. The quote's deposit is offered as the first payment, ready filled in.
 */
export function PaymentsSection(props: Props) {
  const { currencyCode, numberStyle, formatLocale, grossCents, paidCents, rows, depositCents } = props;
  const money = (cents: number) => formatMoney(cents, currencyCode, numberStyle);
  const owingCents = Math.max(0, grossCents - paidCents);
  const [form, setForm] = useState<{ amount: number | null; note: string } | null>(null);
  const [reversing, setReversing] = useState<PaymentRow | null>(null);
  const depositOffered = owingCents > 0 && !props.fullyCredited && depositCents !== null && rows.length === 0;

  return (
    <section className="space-y-3" aria-labelledby="payments-heading">
      <h2 id="payments-heading" className="text-base font-semibold">
        Payments
      </h2>
      <Card>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-base" data-testid="payment-totals">
            <dt className="text-muted-foreground">Paid so far</dt>
            <dd data-testid="invoice-paid">{money(paidCents)}</dd>
          </dl>

          {rows.length === 0 ? (
            <p className="text-base text-muted-foreground">Nothing paid yet.</p>
          ) : (
            <ul className="space-y-2" aria-label="Payments received" data-testid="payments">
              {rows.map((row) => {
                const p = row.payment;
                return (
                  <li key={p.id} className="space-y-1 rounded-xl bg-muted/40 p-3 ring-1 ring-foreground/10" data-testid="payment">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                      <span className={row.reversal ? "text-muted-foreground line-through" : "font-medium"}>{money(p.amountCents)}</span>
                      <span className="text-sm text-muted-foreground">{formatDay(p.paidOn, formatLocale)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {[p.method ? props.methods[p.method] : null, p.note].filter(Boolean).join(" · ") || "No details"}
                    </p>
                    {row.reversal ? (
                      <p className="text-sm font-medium" data-testid="payment-reversed">
                        Reversed on {formatDay(row.reversal.paidOn, formatLocale)}
                      </p>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        id={`reverse-${p.id}`}
                        aria-label={`Reverse the ${money(p.amountCents)} payment of ${formatDay(p.paidOn, formatLocale)}`}
                        onClick={() => setReversing(row)}
                      >
                        Reverse this payment
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {depositOffered && (
            <div className="space-y-2 rounded-xl bg-muted/40 p-3 ring-1 ring-foreground/10" data-testid="deposit-offer">
              <p className="text-base">Your quote asked for a deposit of {money(depositCents)}.</p>
              <Button type="button" onClick={() => setForm({ amount: Math.min(depositCents, owingCents), note: props.depositNote })}>
                Record the deposit
              </Button>
            </div>
          )}

          {props.fullyCredited ? (
            <p className="text-base font-medium" data-testid="nothing-owing">
              Nothing is owing: this invoice is fully credited.
            </p>
          ) : owingCents > 0 ? (
            <AddButton
              id="record-payment"
              // The deposit, when it is offered, is the next step and the one filled button; any other payment is outlined.
              variant={depositOffered ? "outline" : "default"}
              size="lg"
              onClick={() => setForm({ amount: null, note: "" })}
            >
              Record a payment
            </AddButton>
          ) : (
            <p className="text-base font-medium" data-testid="paid-in-full">
              Paid in full.
            </p>
          )}
        </CardContent>
      </Card>

      <Sheet open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <SheetContent side="right" className="h-dvh gap-0 overflow-y-auto" finalFocus={() => document.getElementById("record-payment") ?? true}>
          {/* Mounted only while open, so every opening starts fresh. */}
          {form && <PaymentForm {...props} owingCents={owingCents} start={form} onDone={() => setForm(null)} />}
        </SheetContent>
      </Sheet>

      <Sheet open={reversing !== null} onOpenChange={(open) => !open && setReversing(null)}>
        <SheetContent
          side="bottom"
          className="max-h-[90dvh] gap-0 overflow-y-auto rounded-t-2xl"
          finalFocus={() => (reversing ? document.getElementById(`reverse-${reversing.payment.id}`) : null) ?? true}
        >
          {reversing && <ReverseForm {...props} row={reversing} onDone={() => setReversing(null)} />}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function PaymentForm({
  invoiceId,
  number,
  currencyCode,
  numberStyle,
  symbol,
  today,
  owingCents,
  methods,
  start,
  onDone,
}: Props & { owingCents: number; start: { amount: number | null; note: string }; onDone: () => void }) {
  const router = useRouter();
  const money = (cents: number) => formatMoney(cents, currencyCode, numberStyle);
  const [values, setValues] = useState<PaymentFormValues>({
    amount: moneyToInput(start.amount ?? owingCents, numberStyle),
    paidOn: today,
    method: "",
    note: start.note,
  });
  const [errors, setErrors] = useState<PaymentFormErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    setMessage(null);
    setTries((n) => n + 1);
    const checked = parsePaymentForm(values, { owingCents, owingText: money(owingCents), today });
    setErrors(checked.ok ? {} : checked.errors);
    if (!checked.ok) return;
    startTransition(async () => {
      try {
        const result = await recordPayment(invoiceId, values);
        if (result.status === "done") {
          router.refresh();
          onDone();
        } else if (result.status === "invalid") {
          // The server saw something the page didn't (a payment made meanwhile): show it at the field, and update the page.
          setErrors(result.errors);
          setTries((n) => n + 1);
          router.refresh();
        } else setMessage(result.message);
      } catch {
        setMessage(OFFLINE);
      }
    });
  }

  const summary: FormProblem[] = [
    ...(errors.amount ? [{ fieldId: "payment-amount", label: "Amount", message: errors.amount }] : []),
    ...(errors.paidOn ? [{ fieldId: "payment-date", label: "Date paid", message: errors.paidOn }] : []),
    ...(errors.method ? [{ fieldId: "payment-method", label: "How it was paid", message: errors.method }] : []),
    ...(errors.note ? [{ fieldId: "payment-note", label: "Note", message: errors.note }] : []),
  ];

  return (
    <>
      <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover pr-14">
        <SheetTitle className="text-lg">Record a payment</SheetTitle>
        <SheetDescription className="text-base">
          {number} · {money(owingCents)} owing. A payment can&apos;t be edited after; reverse it if it is wrong.
        </SheetDescription>
      </SheetHeader>
      <FormErrorScope epoch={tries}>
        <form onSubmit={submit} noValidate className="space-y-4 px-4 py-4">
          <FormSummary problems={summary} trigger={tries} />
          {message && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          <TextField
            id="payment-amount"
            label="Amount received"
            inputMode="decimal"
            autoComplete="off"
            startText={symbol}
            value={values.amount}
            error={errors.amount}
            onChange={(amount) => setValues((v) => ({ ...v, amount }))}
          />
          <TextField
            id="payment-date"
            type="date"
            label="Date paid"
            max={today}
            value={values.paidOn}
            error={errors.paidOn}
            onChange={(paidOn) => setValues((v) => ({ ...v, paidOn }))}
          />
          <SelectField
            id="payment-method"
            label="How it was paid (optional)"
            placeholder="Not said"
            options={PAYMENT_METHODS}
            optionLabels={methods}
            value={values.method}
            error={errors.method}
            onChange={(method) => setValues((v) => ({ ...v, method }))}
          />
          <TextAreaField
            id="payment-note"
            label="Note (optional)"
            rows={2}
            maxLength={PAYMENT_NOTE_MAX + 100}
            value={values.note}
            error={errors.note}
            onChange={(note) => setValues((v) => ({ ...v, note }))}
          />
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "Saving…" : "Record payment"}
          </Button>
          <Button type="button" size="lg" variant="outline" className="w-full" disabled={pending} onClick={onDone}>
            Cancel
          </Button>
        </form>
      </FormErrorScope>
    </>
  );
}

function ReverseForm({
  invoiceId,
  currencyCode,
  numberStyle,
  formatLocale,
  row,
  onDone,
}: Props & { row: PaymentRow; onDone: () => void }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const p = row.payment;

  function reverse() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await reversePayment(invoiceId, p.id);
        if (result.status === "done") {
          router.refresh();
          onDone();
        } else if (result.status === "error") setMessage(result.message);
      } catch {
        setMessage(OFFLINE);
      }
    });
  }

  return (
    <>
      <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover pr-14">
        <SheetTitle className="text-lg">Reverse this payment</SheetTitle>
        <SheetDescription className="text-base">
          {formatMoney(p.amountCents, currencyCode, numberStyle)} on {formatDay(p.paidOn, formatLocale)}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-4 px-4 py-4">
        {message && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        <p className="text-base">It stays in the list, marked reversed, and the amount is owing again.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" size="lg" variant="destructive" disabled={pending} onClick={reverse}>
            {pending ? "Reversing…" : "Reverse payment"}
          </Button>
          <Button type="button" size="lg" variant="outline" disabled={pending} onClick={onDone}>
            Keep it
          </Button>
        </div>
      </div>
    </>
  );
}
