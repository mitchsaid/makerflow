"use client";

import { rewriteAddress } from "@/lib/rewrite-address";
import Link from "@/components/app-link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { AddButton } from "@/components/add-button";
import { FormErrorScope } from "@/components/form-errors";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { OptionalTag, Section, TextAreaField, TextField } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import type { BusinessType } from "@/lib/business-types";
import type { CustomerOption, SavedAddress } from "@/lib/customers";
import { parseInvoiceDraft, type InvoiceDraftErrors, type InvoiceDraftForm } from "@/lib/invoices/draft";
import { INVOICE_NOTE_MAX } from "@/lib/invoices";
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
import { discardInvoiceDraft, saveInvoiceDraft } from "./draft-actions";
import type { ProductFormCosting } from "../products/product-form";

const OFFLINE = "Couldn't reach the server, so nothing may have been saved. Check your connection and try again. Nothing you typed is lost.";

/**
 * An invoice that is not issued yet (docs/plans/invoice-i3.md): who it is for, what is on it, delivery or collection, a
 * discount, the dates and a note, with the totals as they stand. It is built from the same pieces as a quote (the
 * customer picker, the item sheet, the delivery and discount fields), and its totals are worked out by the same money code.
 * "Save draft" keeps it for later; "Continue to preview" checks it as an invoice and opens the preview, where marking it as
 * issued gives it its number, after which it never changes. Both buttons are always enabled: pressing one with something missing lists what to fix, at the
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
  costing,
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
  /** What the product form's Inputs tab needs, for editing a product in the sheet. */
  costing: ProductFormCosting;
}) {
  const router = useRouter();
  const [values, setValues] = useState<InvoiceDraftForm>(initial);
  const [draftId, setDraftId] = useState(initialDraftId);
  const [customers, setCustomers] = useState(initialCustomers);
  const { products, productSaved, newKey } = useItemSheetProducts(initialProducts);
  const [errors, setErrors] = useState<InvoiceDraftErrors>({ fields: {}, lines: {} });
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(justSaved);
  const [tried, setTried] = useState(0);
  const [pending, startTransition] = useTransition();
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
    rewriteAddress(`/app/invoices/drafts/${id}`);
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

  /**
   * "Continue to preview": check it as an invoice here first, so a missing thing is named where it is missing, then keep
   * it as a draft and open the preview (what is previewed is what is kept).
   */
  function preview() {
    setMessage(null);
    const sent = tidy();
    const checked = parseInvoiceDraft(sent, vat);
    setTried((n) => n + 1);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setErrors({ fields: {}, lines: {} });
    if (draftId && saved) {
      router.push(`/app/invoices/drafts/${draftId}/preview`);
      return;
    }
    startTransition(async () => {
      try {
        const kept = await saveInvoiceDraft(draftId, sent, { stay: true });
        if (kept.status === "error") {
          setMessage(kept.message);
          return;
        }
        adopt(kept.draftId);
        setSaved(true);
        router.push(`/app/invoices/drafts/${kept.draftId}/preview`);
      } catch (error) {
        const digest = (error as { digest?: unknown } | null)?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw error;
        setMessage(OFFLINE);
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
  if (f.issueDate) summary.push({ fieldId: "issueDate", label: "Invoice date", message: f.issueDate });
  if (f.dueDate) summary.push({ fieldId: "dueDate", label: "Due date", message: f.dueDate });
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
  if (f.notes) summary.push({ fieldId: "notes", label: "Note", message: f.notes });
  if (message) summary.push({ fieldId: "preview-invoice", label: "Invoice", message });

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

        <Section title="Dates">
          <TextField id="issueDate" type="date" label="Invoice date" value={values.issueDate} error={f.issueDate} onChange={(issueDate) => update({ issueDate })} />
          <TextField id="dueDate" type="date" label="Due date" value={values.dueDate} error={f.dueDate} onChange={(dueDate) => update({ dueDate })} />
        </Section>

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
            costing={costing}
            // The photo and the quantity price are the invoice's own settings, decided on the item as on a quote.
            quoteShows={{
              photos: values.showPhotos,
              quantityPrices: values.showQuantityPrices === true,
              onChange: ({ photos, quantityPrices }) => update({ showPhotos: photos, showQuantityPrices: quantityPrices }),
            }}
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


        <Section title="Note for your customer" tag={<OptionalTag />}>
          <TextAreaField
            id="notes"
            label="Note (optional)"
            labelHidden
            hint="Like a thank-you or a reminder of how to pay."
            rows={3}
            maxLength={INVOICE_NOTE_MAX + 100}
            value={values.notes}
            error={f.notes}
            onChange={(notes) => update({ notes })}
          />
        </Section>

        {/* The pinned bar is the total; the card is only for a breakdown (a discount, VAT). */}
        {(discountsCents > 0 || vat.registered) && (
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
            {pending ? (
              "Saving…"
            ) : (
              <>
                Save<span className="sr-only"> draft</span>
              </>
            )}
          </Button>
          <Button id="preview-invoice" type="button" disabled={pending} size="lg" className="col-span-2 sm:col-span-1" onClick={preview}>
            Continue to preview
          </Button>
        </div>
      </div>

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
