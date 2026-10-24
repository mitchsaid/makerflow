"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { AddButton } from "@/components/add-button";
import { FormErrorScope } from "@/components/form-errors";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { Section, TextAreaField, TextField } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { BusinessType } from "@/lib/business-types";
import type { CustomerOption, SavedAddress } from "@/lib/customers";
import { parseInvoiceDraft, type InvoiceDraftErrors, type InvoiceDraftForm } from "@/lib/invoices/draft";
import { INVOICE_NOTE_MAX, type InvoiceProblem } from "@/lib/invoices";
import { priceEntryLabel } from "@/lib/locale";
import type { LocalePack } from "@/lib/locale";
import { currencySymbol, formatMoney, formatPercent, type NumberStyle, type VatSettings } from "@/lib/money";
import type { ProductSummary } from "@/lib/products";
import { previewTotals, type DiscountKind, type LineFormValues } from "@/lib/quotes";
import { addressWhenCustomerChanges, addressWhenSavedAddressesChange } from "@/lib/quotes/delivery";
import { vatChoicesFor } from "@/lib/quotes/vat-choices";
import { CustomerPicker } from "../quotes/customer-picker";
import { DeliverySection } from "../quotes/delivery-section";
import { DiscountFields } from "../quotes/discount-fields";
import { LineRow } from "../quotes/line-row";
import { LineSheet, type LineSheetView } from "../quotes/line-sheet";
import { useItemSheetProducts } from "../quotes/use-item-sheet-products";
import { withoutEmptyOptionals } from "@/lib/quotes/optional";
import { discardInvoiceDraft, issueInvoiceDraft, saveInvoiceDraft } from "./draft-actions";

const OFFLINE = "Couldn't reach the server, so nothing may have been saved. Check your connection and try again. Nothing you typed is lost.";

/**
 * An invoice that is not issued yet (docs/plans/invoice-i3.md): who it is for, what is on it, delivery or collection, a
 * discount, the dates and a note, with the totals as they stand. It is built from the same pieces as a quote (the
 * customer picker, the item sheet, the delivery and discount fields), and its totals are worked out by the same money code.
 * "Save draft" keeps it for later; "Issue invoice" checks it as an invoice, asks once, and gives it its number, after
 * which it never changes. Both buttons are always enabled: pressing one with something missing lists what to fix, at the
 * fields and in a summary that jumps to the first one, and nothing typed is lost.
 */
export function InvoiceDraftForm({
  draftId: initialDraftId,
  initial,
  quote,
  justSaved = false,
  customers: initialCustomers,
  products: initialProducts,
  countryCode,
  numberStyle,
  currencyCode,
  vat,
  taxName,
  vatStatuses,
  businessTypes,
}: {
  /** Null for a new invoice that has not been kept yet. */
  draftId: string | null;
  initial: InvoiceDraftForm;
  /** The accepted quote this invoice adjusts, if it does (I3c). */
  quote: { id: string; number: string } | null;
  justSaved?: boolean;
  customers: CustomerOption[];
  products: ProductSummary[];
  countryCode: string;
  numberStyle: NumberStyle;
  currencyCode: string;
  vat: VatSettings;
  taxName: string;
  vatStatuses: LocalePack["tax"]["statuses"];
  businessTypes: BusinessType[] | null;
}) {
  const [values, setValues] = useState<InvoiceDraftForm>(initial);
  const [draftId, setDraftId] = useState(initialDraftId);
  const [customers, setCustomers] = useState(initialCustomers);
  const { products, productSaved, newKey } = useItemSheetProducts(initialProducts);
  const [errors, setErrors] = useState<InvoiceDraftErrors>({ fields: {}, lines: {} });
  const [problems, setProblems] = useState<InvoiceProblem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(justSaved);
  const [tried, setTried] = useState(0);
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [showDiscount, setShowDiscount] = useState(initial.discountKind !== "none");

  const [sheetView, setSheetView] = useState<LineSheetView | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const focusAfterSheet = useRef<string | null>(null);

  const money = (cents: number) => formatMoney(cents, currencyCode, numberStyle);
  const symbol = currencySymbol(currencyCode, numberStyle);
  const totals = useMemo(() => previewTotals(values, vat), [values, vat]);
  const savedAddresses: SavedAddress[] = customers.find((c) => c.id === values.customerId)?.addresses ?? [];
  const discountsCents = totals ? totals.lineDiscountsCents + totals.quoteDiscountCents : 0;
  const photoOf = (line: LineFormValues) => (line.productId ? (products.find((p) => p.id === line.productId)?.photoImageId ?? null) : null);

  function update(change: Partial<InvoiceDraftForm>) {
    setSaved(false);
    setValues((v) => ({ ...v, ...change }));
  }
  function clear(...fields: (keyof InvoiceDraftErrors["fields"])[]) {
    setErrors((e) => {
      const rest = { ...e.fields };
      for (const f of fields) delete rest[f];
      return { ...e, fields: rest };
    });
  }
  function chooseCustomer(customerId: string, next: SavedAddress[]) {
    clear("customerId");
    setProblems([]);
    update({ customerId, deliveryAddress: addressWhenCustomerChanges(values.deliveryAddress, savedAddresses, next) });
  }
  /** The picker adds or edits customers; when the chosen one's saved addresses change, the address typed here follows. */
  function changeCustomers(change: (list: CustomerOption[]) => CustomerOption[]) {
    const after = change(customers).find((c) => c.id === values.customerId)?.addresses ?? [];
    setCustomers(change);
    if (after !== savedAddresses && values.customerId !== "") {
      update({ deliveryAddress: addressWhenSavedAddressesChange(values.deliveryAddress, savedAddresses, after) });
    }
  }

  function openSheet(view: LineSheetView) {
    focusAfterSheet.current = null;
    setSheetView(view);
    setSheetOpen(true);
  }
  function saveLine(line: LineFormValues, isNew: boolean) {
    update({ lines: isNew ? [...values.lines, line] : values.lines.map((l) => (l.key === line.key ? line : l)) });
    setErrors((e) => {
      const lines = { ...e.lines };
      delete lines[line.key];
      const fields = { ...e.fields };
      delete fields.lines;
      return { fields, lines };
    });
    focusAfterSheet.current = `line-${line.key}-edit`;
    setSheetOpen(false);
  }
  function removeLine(key: string) {
    const index = values.lines.findIndex((l) => l.key === key);
    if (index < 0) return;
    update({ lines: values.lines.filter((l) => l.key !== key) });
    const next = values.lines[index + 1] ?? values.lines[index - 1];
    const target = next && next.key !== key ? `line-${next.key}-edit` : "add-item";
    focusAfterSheet.current = target;
    setTimeout(() => document.getElementById(target)?.focus(), 0);
    setSheetOpen(false);
  }

  /** A new invoice that has been kept now has an address of its own; the page stays as it is. */
  function adopt(id: string | undefined) {
    if (!id || id === draftId) return;
    setDraftId(id);
    window.history.replaceState(null, "", `/app/invoices/drafts/${id}`);
  }

  /** A discount that was opened and left empty is dropped, not refused. */
  function tidy(): InvoiceDraftForm {
    const sent = withoutEmptyOptionals(values);
    if (sent !== values) {
      setValues(sent);
      setShowDiscount(false);
    }
    return sent;
  }

  function save() {
    setMessage(null);
    setProblems([]);
    const sent = tidy();
    startTransition(async () => {
      try {
        const result = await saveInvoiceDraft(draftId, sent);
        if (result.status === "saved") {
          setSaved(true);
          adopt(result.draftId);
        } else setMessage(result.message);
      } catch (error) {
        // Keeping a new invoice ends by opening its page: that is a redirect, not a failure.
        const digest = (error as { digest?: unknown } | null)?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw error;
        setMessage(OFFLINE);
      }
    });
  }

  /** "Issue invoice": check it as an invoice here first, so a missing thing is named without a round trip, then ask once. */
  function askToIssue() {
    setMessage(null);
    const checked = parseInvoiceDraft(tidy(), vat);
    setTried((n) => n + 1);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setErrors({ fields: {}, lines: {} });
    setConfirming(true);
  }

  function issue() {
    setMessage(null);
    startTransition(async () => {
      try {
        // An invoice that has not been kept yet is kept first, so that trying again after a lost reply asks about the
        // same draft and cannot issue a second invoice.
        let id = draftId;
        if (id === null) {
          const kept = await saveInvoiceDraft(null, values, { stay: true });
          if (kept.status === "error") {
            setConfirming(false);
            setMessage(kept.message);
            setTried((n) => n + 1);
            return;
          }
          id = kept.draftId;
          adopt(id);
        }
        const result = await issueInvoiceDraft(id, values);
        setConfirming(false);
        setTried((n) => n + 1);
        if (result.status === "invalid") {
          adopt(result.draftId);
          setErrors(result.errors);
        } else if (result.status === "problems") {
          adopt(result.draftId);
          setProblems(result.problems);
        } else {
          adopt(result.draftId);
          setMessage(result.message);
        }
      } catch (error) {
        // Issuing ends by opening the invoice: that is a redirect, not a failure.
        const digest = (error as { digest?: unknown } | null)?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw error;
        setConfirming(false);
        setMessage(OFFLINE);
        setTried((n) => n + 1);
      }
    });
  }

  function discard() {
    if (!draftId) return;
    startTransition(async () => {
      try {
        const result = await discardInvoiceDraft(draftId);
        setDiscarding(false);
        setMessage(result.message);
      } catch (error) {
        const digest = (error as { digest?: unknown } | null)?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw error;
        setDiscarding(false);
        setMessage(OFFLINE);
      }
    });
  }

  // The summary lists problems in the order the fields appear on screen.
  const f = errors.fields;
  const summary: FormProblem[] = [];
  if (f.customerId) summary.push({ fieldId: "customer", label: "Customer name", message: f.customerId });
  values.lines.forEach((line, i) => {
    const e = errors.lines[line.key];
    const text = e ? (e.name ?? e.variation ?? e.options ?? e.quantity ?? e.unitPrice ?? e.discountValue ?? e.description) : undefined;
    if (text) summary.push({ fieldId: `line-${line.key}-edit`, label: `Item ${i + 1}: ${line.name.trim() || "item"}`, message: text });
  });
  if (f.lines) summary.push({ fieldId: "add-item", label: "Items", message: f.lines });
  if (f.deliveryFee) summary.push({ fieldId: "deliveryFee", label: "Delivery fee", message: f.deliveryFee });
  if (f.deliveryAddress) summary.push({ fieldId: "deliveryAddress", label: "Deliver to", message: f.deliveryAddress });
  if (f.discountValue) summary.push({ fieldId: "discountValue", label: "Discount", message: f.discountValue });
  if (f.issueDate) summary.push({ fieldId: "issueDate", label: "Invoice date", message: f.issueDate });
  if (f.dueDate) summary.push({ fieldId: "dueDate", label: "Due day", message: f.dueDate });
  if (f.notes) summary.push({ fieldId: "notes", label: "Note", message: f.notes });
  for (const p of problems) summary.push({ fieldId: `invoice-problem-${p.code}`, label: "Before you can issue it", message: p.message });
  if (message) summary.push({ fieldId: "issue-invoice", label: "Invoice", message });

  return (
    <FormErrorScope epoch={tried}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
        noValidate
        className="space-y-6"
        data-testid="invoice-draft-form"
        id="invoice-draft-form"
      >
        <FormSummary problems={summary} trigger={tried} />

        {quote && (
          <Alert data-testid="invoice-quote-note">
            <AlertDescription>
              Started from{" "}
              <Link href={`/app/quotes/${quote.id}`} className="font-medium underline">
                quote {quote.number}
              </Link>
              . Change what you need to: the quote itself stays as it was agreed.
            </AlertDescription>
          </Alert>
        )}

        <Section title="Customer">
          <CustomerPicker
            id="customer"
            customers={customers}
            onCustomersChange={changeCustomers}
            subject="invoice"
            countryCode={countryCode}
            value={values.customerId}
            onChange={chooseCustomer}
            error={f.customerId}
          />
        </Section>

        <Section title="Items">
          {values.lines.length === 0 && <p className="text-muted-foreground">No items yet. Add a product, a service or a one-off item.</p>}
          {values.lines.length > 0 && (
            <ul id="items-list" className="space-y-2" aria-label="Items on this invoice">
              {values.lines.map((line, index) => {
                const e = errors.lines[line.key];
                const result = totals?.lines.find((l) => l.id === line.key);
                return (
                  <LineRow
                    key={line.key}
                    line={line}
                    number={index + 1}
                    error={e ? (e.name ?? e.variation ?? e.options ?? e.quantity ?? e.unitPrice ?? e.discountValue ?? e.description) : undefined}
                    money={money}
                    lineTotal={result ? result.amountBeforeDiscountCents - result.lineDiscountCents : null}
                    photoId={photoOf(line)}
                    vatLabel={vat.registered && line.vatStatus && line.vatStatus !== "standard" ? vatStatuses[line.vatStatus].label : null}
                    onEdit={() => openSheet({ kind: "configure", line, isNew: false })}
                  />
                );
              })}
            </ul>
          )}
          <AddButton id="add-item" aria-invalid={!!f.lines} aria-describedby={f.lines ? "items-error" : undefined} onClick={() => openSheet({ kind: "pick" })}>
            Add item
          </AddButton>
          {f.lines && <FieldError id="items-error">{f.lines}</FieldError>}
          <LineSheet
            document="invoice"
            open={sheetOpen}
            view={sheetView}
            products={products}
            numberStyle={numberStyle}
            currencyCode={currencyCode}
            priceLabel={priceEntryLabel(vat, taxName)}
            vatChoices={vatChoicesFor(vat, vatStatuses, numberStyle)}
            businessTypes={businessTypes}
            newKey={newKey}
            onView={openSheet}
            onClose={() => setSheetOpen(false)}
            onSaveLine={saveLine}
            onRemoveLine={removeLine}
            onProductSaved={productSaved}
            focusOnClose={() => focusAfterSheet.current}
          />
        </Section>

        <DeliverySection
          fulfilment={values.fulfilment}
          deliveryFee={values.deliveryFee}
          deliveryAddress={values.deliveryAddress}
          onChange={(change) => update(change)}
          saved={savedAddresses}
          hasCustomer={values.customerId !== ""}
          countryCode={countryCode}
          feeLabel={priceEntryLabel(vat, taxName, "Delivery fee")}
          symbol={symbol}
          errors={{ deliveryFee: f.deliveryFee, deliveryAddress: f.deliveryAddress }}
        />

        {showDiscount ? (
          <Section
            title="Discount"
            onRemove={() => {
              update({ discountKind: "none", discountValue: "" });
              setShowDiscount(false);
            }}
          >
            <DiscountFields
              kind={values.discountKind}
              value={values.discountValue}
              symbol={symbol}
              error={f.discountValue}
              noun="invoice"
              onKindChange={(discountKind: DiscountKind) => update({ discountKind, discountValue: discountKind === "none" ? "" : values.discountValue })}
              onValueChange={(discountValue) => update({ discountValue })}
            />
          </Section>
        ) : (
          <div>
            <AddButton
              id="add-discount"
              onClick={() => {
                setShowDiscount(true);
                if (values.discountKind === "none") update({ discountKind: "percent" });
                setTimeout(() => document.getElementById("discountValue")?.focus(), 0);
              }}
            >
              Add a discount
            </AddButton>
          </div>
        )}

        <Section title="Dates">
          <TextField id="issueDate" type="date" label="Invoice date" value={values.issueDate} error={f.issueDate} onChange={(issueDate) => update({ issueDate })} />
          <TextField id="dueDate" type="date" label="Due day" value={values.dueDate} error={f.dueDate} onChange={(dueDate) => update({ dueDate })} />
        </Section>

        <Section title="Note">
          <TextAreaField
            id="notes"
            label="Note (optional)"
            hint="Printed on the invoice."
            rows={3}
            maxLength={INVOICE_NOTE_MAX + 100}
            value={values.notes}
            error={f.notes}
            onChange={(notes) => update({ notes })}
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
              <Row label={`Includes ${taxName} (${formatPercent(vat.standardRateBp, numberStyle)})`} value={money(totals.vatCents)} />
            )}
          </dl>
        </Section>

        {problems.length > 0 && (
          <Alert variant="destructive" data-testid="invoice-problems">
            <AlertDescription>
              <ul className="space-y-1">
                {problems.map((p) => (
                  <li key={p.code} id={`invoice-problem-${p.code}`}>
                    {p.message}{" "}
                    <Link href={p.code === "customer-address" && values.customerId ? `/app/customers/${values.customerId}?section=details` : "/app/business"} className="inline-flex min-h-11 items-center font-medium underline">
                      {p.code === "customer-address" ? "Open the customer" : "Open your business profile"}
                    </Link>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {draftId && (
          <div className="space-y-2">
            {discarding ? (
              <Alert data-testid="discard-question">
                <AlertDescription className="space-y-3">
                  <span className="block font-medium">Discard this draft?</span>
                  <span className="block">It is thrown away. Nothing has been issued.</span>
                  <span className="flex flex-wrap gap-2">
                    <Button type="button" variant="destructive" size="lg" disabled={pending} onClick={discard}>
                      Yes, discard it
                    </Button>
                    <Button type="button" variant="outline" size="lg" disabled={pending} onClick={() => setDiscarding(false)}>
                      Keep it
                    </Button>
                  </span>
                </AlertDescription>
              </Alert>
            ) : (
              <Button id="discard-draft" type="button" variant="outline" size="lg" disabled={pending} onClick={() => setDiscarding(true)}>
                Discard draft
              </Button>
            )}
          </div>
        )}
        {saved && !pending && (
          <p role="status" className="text-sm font-medium">
            Draft saved.
          </p>
        )}
      </form>

      {/* Always in view above the tab bar, as on a quote. */}
      <div data-testid="action-bar" className="sticky bottom-14 z-10 -mx-4 -mb-8 transform-gpu border-t border-border bg-card px-4 py-2 md:bottom-0">
        <div className="mx-auto grid max-w-2xl grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 sm:flex sm:justify-end">
          <div className="min-w-0 sm:mr-auto">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="truncate text-lg font-semibold" data-testid="sticky-total">
              {totals ? money(totals.grossCents) : "–"}
            </p>
          </div>
          <Button type="submit" form="invoice-draft-form" variant="outline" disabled={pending} size="lg">
            {pending && !confirming ? (
              "Saving…"
            ) : (
              <>
                Save<span className="sr-only"> draft</span>
              </>
            )}
          </Button>
          <Button id="issue-invoice" type="button" disabled={pending} size="lg" className="col-span-2 sm:col-span-1" onClick={askToIssue}>
            Issue invoice
          </Button>
        </div>
      </div>

      <Sheet open={confirming} onOpenChange={(isOpen) => !pending && setConfirming(isOpen)}>
        <SheetContent side="right" className="h-dvh gap-0 overflow-y-auto" finalFocus={() => document.getElementById("issue-invoice") ?? true}>
          <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover pr-14">
            <SheetTitle className="text-lg">Issue this invoice?</SheetTitle>
            <SheetDescription className="text-base">
              {customers.find((c) => c.id === values.customerId)?.name ?? ""} · {totals ? money(totals.grossCents) : ""}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 py-4">
            <p className="text-base">It gets the next invoice number and can&apos;t be changed after this. If something is wrong, a credit note corrects it.</p>
            <Button type="button" size="lg" className="w-full" disabled={pending} onClick={issue}>
              {pending ? "Issuing…" : "Issue invoice"}
            </Button>
            <Button type="button" variant="outline" size="lg" className="w-full" disabled={pending} onClick={() => setConfirming(false)}>
              Keep editing
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </FormErrorScope>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? "text-lg font-semibold" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
