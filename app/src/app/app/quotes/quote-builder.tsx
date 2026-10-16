"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { XIcon } from "lucide-react";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { Section, TextAreaField, TextField } from "@/components/form-fields";
import { termName, type PolicyPackContent, type PolicySummary } from "@/lib/policies";
import type { BankPreview } from "@/lib/bank";
import { BankDetailsSection } from "./bank-details-section";
import { addressWhenCustomerChanges, addressWhenSavedAddressesChange } from "@/lib/quotes/delivery";
import { Checkbox } from "@/components/ui/checkbox";
import { imageUrl } from "@/lib/images";
import { DeliverySection } from "./delivery-section";
import { DepositSection } from "./deposit-section";
import { TermsSection } from "./terms-section";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
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
import { getLocalePack, priceEntryLabel, type LocalePack } from "@/lib/locale";
import { addDays } from "@/lib/quotes/dates";
import { vatChoicesFor } from "@/lib/quotes/vat-choices";
import type { BusinessType } from "@/lib/business-types";
import {
  isBlankLine,
  optionsPerItem,
  previewTotals,
  QUOTE_SIGN_OFF_MAX,
  type DiscountKind,
  type LineFormValues,
  type QuoteErrors,
  type QuoteFormValues,
} from "@/lib/quotes";
import { MISSING_CUSTOMER, MISSING_ITEMS } from "@/lib/quotes/send-checks";
import { saveQuoteDraft, type SaveQuoteState } from "./actions";
import type { CustomerOption, SavedAddress } from "@/lib/customers";
import { CustomerPicker } from "./customer-picker";
import { useItemSheetProducts } from "./use-item-sheet-products";
import { LineSheet, type LineSheetView } from "./line-sheet";
import { AddButton } from "@/components/add-button";
import { saveDepositDefault } from "../documents/deposit-actions";
import { saveUsualDescription, saveUsualPayment, saveUsualSignOff } from "./usual-actions";
import { UsualButtons } from "./usual-buttons";
import { QuoteNumber, type QuoteNumbering } from "./quote-number";
import { canSaveUsualText, canUseUsualText, sameDeposit, sameDiscount, type QuoteUsuals } from "@/lib/quotes/usuals";
import { saveDiscountDefault } from "../documents/discount-actions";
import { ErrorScopeBridge, FormErrorScope, type ErrorScopeHandle } from "@/components/form-errors";

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
  customers: initialCustomers,
  products: initialProducts,
  vat,
  currencyCode,
  countryCode,
  numberStyle,
  taxName,
  vatStatuses,
  businessTypes,
  justSaved,
  focusOnLoad,
  policyLibrary: initialPolicyLibrary,
  policyContent,
  canManagePolicies,
  bankDetails: initialBankDetails,
  canEditBankDetails,
  usuals: initialUsuals,
  canSaveUsuals,
  startingText,
  numbering: initialNumbering,
  canChangeNumbering = false,
  askForDeposit = false,
  header,
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
  /** The country's names and hints for each VAT treatment (from the locale pack). */
  vatStatuses: LocalePack["tax"]["statuses"];
  /** What the business makes (suggestions for a new product's variations). */
  businessTypes: BusinessType[] | null;
  /** A new draft has just been saved and this page opened on it. */
  justSaved: boolean;
  /** The field to land on (the preview sends people back to fix something). */
  focusOnLoad?: string;
  /** The business's saved terms, to add to the quote. */
  policyLibrary: PolicySummary[];
  /** Starter wording for the policy form (from the locale pack). */
  policyContent: PolicyPackContent;
  /** Owners and admins can add to the library; other members can only use it. */
  canManagePolicies: boolean;
  /** Which bank account is saved (never the whole number), or null when none is. */
  bankDetails: BankPreview | null;
  /** Only the owner can add bank details (from the quote or the Business profile). */
  canEditBankDetails: boolean;
  /** What a new quote starts with, so "Save as my usual" and "Use my usual" know what differs. */
  usuals: QuoteUsuals;
  /** Owners and admins can save what is on the quote as the usual; others can only use it. */
  canSaveUsuals: boolean;
  /** The country's generic description and sign-off a new quote starts with when there is no usual (not offered for saving). */
  startingText: { description: string; signOff: string };
  /** A new quote: how quotes are numbered now, so the number it will get can be shown. Absent once it has a number. */
  numbering?: QuoteNumbering;
  /** Owners and admins can change how quotes are numbered (from the quote, or under Quotes and invoices). */
  canChangeNumbering?: boolean;
  /** The business decides the deposit on every quote: a new quote asks. */
  askForDeposit?: boolean;
  /** The page's heading, shown above the form. On a new quote it carries the cancel button. */
  header?: React.ReactNode;
  /** What goes between the form and the bar, such as Delete draft. */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [values, setValues] = useState<QuoteFormValues>(initial);
  // Kept here (not in the picker) because "deliver to" offers the chosen customer's addresses.
  const [customers, setCustomers] = useState(initialCustomers);
  const [state, setState] = useState<SaveQuoteState>(
    justSaved ? { status: "saved", savedAt: 0 } : { status: "idle" },
  );
  const [editedSinceSave, setEditedSinceSave] = useState(false);
  // A new quote is cancelled with the X: straight away when nothing has been typed, else after asking.
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const cancelQuestion = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (confirmingCancel) cancelQuestion.current?.querySelector("button")?.focus();
  }, [confirmingCancel]);
  const [pending, startTransition] = useTransition();
  // Long quotes show the first few items and a "Show all" button.
  const [expanded, setExpanded] = useState(false);
  // Optional parts stay out of the way until the maker asks for them (or the quote already uses them).
  // Once shown they stay shown (a field must not vanish under the maker's hands when they clear it), and a draft that
  // already uses one starts with it shown. A title already on an older quote stays editable; new quotes have no title box.
  const [showNeededBy, setShowNeededBy] = useState(initial.neededBy !== "");
  const [showDiscount, setShowDiscount] = useState(initial.discountKind !== "none");
  const [showTitle] = useState(initial.title !== "");

  const money = (cents: number) => formatMoney(cents, currencyCode, numberStyle);
  const symbol = currencySymbol(currencyCode, numberStyle);
  const totals = useMemo(() => previewTotals(values, vat), [values, vat]);
  // Fixing something clears its error at once (components/form-errors.tsx); a new failed save brings back what is left.
  const [scope, setScope] = useState<ErrorScopeHandle | null>(null);
  // Only edits made since this save result count; until the scope catches up with a new result, nothing is hidden.
  const edited = scope && scope.epoch === state ? scope.edited : undefined;
  const errors: QuoteErrors = useMemo(
    () => withoutEdited(state.status === "error" && state.errors ? state.errors : { fields: {}, lines: {} }, edited),
    [state, edited],
  );

  function update(change: Partial<QuoteFormValues>) {
    setEditedSinceSave(true);
    setValues((v) => ({ ...v, ...change }));
  }
  /** A line's product photo (null for a one-off item or a product with no photo). */
  const photoOf = (line: LineFormValues) =>
    line.productId ? (products.find((p) => p.id === line.productId)?.photoImageId ?? null) : null;
  const savedAddresses = customers.find((c) => c.id === values.customerId)?.addresses ?? [];

  /**
   * Choosing another customer (or none) moves the address along with them, whatever the quote says
   * about delivery right now: an empty address, or the previous customer's own saved one, becomes
   * the new customer's. An address typed for this quote is never replaced.
   */
  function chooseCustomer(customerId: string, next: SavedAddress[]) {
    setEditedSinceSave(true);
    scope?.markEdited("customer");
    setValues((v) => ({
      ...v,
      customerId,
      deliveryAddress: addressWhenCustomerChanges(v.deliveryAddress, savedAddresses, next),
    }));
  }

  /** The picker adds or edits customers; when the chosen one's saved addresses change, the quote's follows. */
  function changeCustomers(update: (list: CustomerOption[]) => CustomerOption[]) {
    const after = update(customers).find((c) => c.id === values.customerId)?.addresses ?? [];
    setCustomers(update);
    if (after !== savedAddresses && values.customerId !== "") {
      const follows = addressWhenSavedAddressesChange(values.deliveryAddress, savedAddresses, after);
      if (follows !== values.deliveryAddress) setDeliveryAddress(follows);
    }
  }
  function setDeliveryAddress(deliveryAddress: string) {
    setEditedSinceSave(true);
    setValues((v) => ({ ...v, deliveryAddress }));
  }
  // The item sheet: choosing what to add, configuring a line, or a product form.
  const { products, productSaved, newKey } = useItemSheetProducts(initialProducts);
  const [policyLibrary, setPolicyLibrary] = useState(initialPolicyLibrary);
  const [bankDetails, setBankDetails] = useState(initialBankDetails);
  // What new quotes start with; saving one from here moves it.
  const [usuals, setUsuals] = useState(initialUsuals);
  const [numbering, setNumbering] = useState(initialNumbering);
  // The deposit and discount exactly as they were sent when "Save as my usual" was pressed.
  const savedDeposit = useRef<{ kind: QuoteFormValues["depositKind"]; value: string } | null>(null);
  const savedDiscount = useRef<{ kind: DiscountKind; value: string } | null>(null);
  const [sheetView, setSheetView] = useState<LineSheetView | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
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
    scope?.markEdited(`line-${line.key}-edit`);
    scope?.markEdited("add-item");
    // The item just added is at the end: make sure it is not tucked away.
    if (isNew && values.lines.length + 1 > COLLAPSE_OVER) setExpanded(true);
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
    scope?.markEdited("add-item");
    setValues((v) => ({ ...v, lines: v.lines.filter((l) => l.key !== key) }));
    // Focus moves to the next line's Edit, or to "Add item" when it was the last one (also when the
    // item sheet it was removed from closes: that is where the sheet hands focus back to).
    const next = values.lines[index + 1] ?? values.lines[index - 1];
    const target = next && next.key !== key ? `line-${next.key}-edit` : "add-item";
    focusAfterSheet.current = target;
    setTimeout(() => document.getElementById(target)?.focus(), 0);
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
            "Couldn't reach the server, so the draft wasn't saved. Try Save again. Nothing you typed is lost.",
        });
      }
    });
  }

  function onSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save();
  }

  /**
   * The preview shows what is saved, so unsaved changes are saved first. A quote with no customer or no items is not
   * previewed: it shows what is missing, where it is missing, like any form that is not ready (a draft can still be saved).
   */
  function onPreview() {
    const noCustomer = values.customerId === "";
    const noItems = values.lines.every(isBlankLine);
    if (noCustomer || noItems) {
      setState({
        status: "error",
        errors: { fields: { ...(noCustomer ? { customerId: MISSING_CUSTOMER } : {}), ...(noItems ? { lines: MISSING_ITEMS } : {}) }, lines: {} },
      });
      return;
    }
    if (quoteId === null || editedSinceSave) save("preview");
    else router.push(`/app/quotes/${quoteId}/preview`);
  }

  // The summary lists problems in the order the fields appear on screen.
  const problems: FormProblem[] = [];
  const f = errors.fields;
  if (f.customerId) problems.push({ fieldId: "customer", label: "Customer name", message: f.customerId });
  if (f.title) problems.push({ fieldId: "title", label: "Quote title", message: f.title });
  if (f.description) problems.push({ fieldId: "description", label: "Description", message: f.description });
  if (f.issueDate) problems.push({ fieldId: "issueDate", label: "Quote date", message: f.issueDate });
  if (f.validUntil) problems.push({ fieldId: "validUntil", label: "Valid until", message: f.validUntil });
  if (f.neededBy) problems.push({ fieldId: "neededBy", label: "Needed by", message: f.neededBy });
  values.lines.forEach((line, index) => {
    const e = errors.lines[line.key];
    if (!e) return;
    const message = e.name ?? e.variation ?? e.options ?? e.quantity ?? e.unitPrice ?? e.discountValue ?? e.description;
    if (message) {
      problems.push({ fieldId: `line-${line.key}-edit`, label: `Item ${index + 1}: ${line.name || "item"}`, message });
    }
  });
  if (f.lines) problems.push({ fieldId: "add-item", label: "Items", message: f.lines });
  if (f.deliveryFee) problems.push({ fieldId: "deliveryFee", label: "Delivery fee", message: f.deliveryFee });
  if (f.deliveryAddress) problems.push({ fieldId: "deliveryAddress", label: "Deliver to", message: f.deliveryAddress });
  if (f.discountValue) problems.push({ fieldId: "discountValue", label: "Discount", message: f.discountValue });
  if (f.depositValue) problems.push({ fieldId: "depositValue", label: "Deposit", message: f.depositValue });
  if (f.balanceDueDate) problems.push({ fieldId: "balanceDueDate", label: "Balance due by", message: f.balanceDueDate });
  if (f.balanceDueText) problems.push({ fieldId: "balanceDueText", label: "When is the balance due?", message: f.balanceDueText });
  if (f.notes) problems.push({ fieldId: "notes", label: "Notes", message: f.notes });
  if (f.policies) {
    // One row for each term that needs fixing, so fixing one never hides another's problem from the summary.
    const rows = values.policies.filter((c) => errors.policies?.[c.key]);
    if (rows.length === 0) {
      problems.push({ fieldId: "policies-error", label: "Terms", message: f.policies });
    }
    for (const c of rows) {
      const e = errors.policies?.[c.key];
      // A term written for this quote has its own title box (checked first); a copied one only its wording.
      const onTitle = c.policyId === "" && !!e?.title;
      problems.push({
        fieldId: `policy-${c.key}-${onTitle ? "title" : "body"}`,
        label: "Terms",
        message: `${termName(c)}: ${onTitle ? e?.title : (e?.body ?? e?.title)}`,
      });
    }
  }
  if (f.paymentInstructions) {
    problems.push({ fieldId: "paymentInstructions", label: "Notes about paying", message: f.paymentInstructions });
  }
  if (f.signOff) problems.push({ fieldId: "signOff", label: "Message", message: f.signOff });

  const priceLabel = priceEntryLabel(vat, taxName);

  const discountsCents = totals ? totals.lineDiscountsCents + totals.quoteDiscountCents : 0;

  // A long list shows its first few items; one that needs fixing is never hidden.
  const collapsible = values.lines.length > COLLAPSE_OVER;
  const hiddenHaveErrors = values.lines.slice(COLLAPSED_SHOWS).some((l) => errors.lines[l.key]);
  const visibleLines = !collapsible || expanded || hiddenHaveErrors ? values.lines : values.lines.slice(0, COLLAPSED_SHOWS);

  return (
  <div className="space-y-6">
    {header && (
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">{header}</div>
        {quoteId === null && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            id="cancel-quote"
            aria-label="Cancel new quote"
            // Not while a save is on its way: leaving then would still create the draft.
            disabled={pending}
            onClick={() => (editedSinceSave ? setConfirmingCancel(true) : router.push("/app/quotes"))}
          >
            <XIcon aria-hidden="true" />
          </Button>
        )}
      </div>
    )}
    {quoteId === null && confirmingCancel && (
      <Alert ref={cancelQuestion} role="alertdialog" aria-label="Cancel this new quote?">
        <AlertDescription className="space-y-3">
          <p>Cancel this quote? Nothing is saved yet, so what you entered will be lost.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="destructive" onClick={() => router.push("/app/quotes")}>
              Yes, cancel the quote
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmingCancel(false);
                setTimeout(() => document.getElementById("cancel-quote")?.focus(), 0);
              }}
            >
              Keep editing
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )}
    <FormErrorScope epoch={state}>
      <ErrorScopeBridge onScope={setScope} />
    <form id="quote-form" onSubmit={onSave} className="space-y-6" noValidate>
      <Section title="Customer">
        <CustomerPicker
          id="customer"
          customers={customers}
          onCustomersChange={changeCustomers}
          countryCode={countryCode}
          value={values.customerId}
          onChange={chooseCustomer}
          error={f.customerId}
        />
      </Section>

      <Section title="About this quote">
        {numbering && quoteId === null && (
          <QuoteNumber numbering={numbering} onChange={setNumbering} canChange={canChangeNumbering} />
        )}
        {showTitle && (
          <TextField
            id="title"
            label="Quote title (optional)"
            autoComplete="off"
            maxLength={120}
            value={values.title}
            error={f.title}
            onChange={(title) => update({ title })}
          />
        )}
        <TextAreaField
          id="description"
          label="Description (optional)"
          hint="Printed at the top of the quote."
          value={values.description}
          error={f.description}
          onChange={(description) => update({ description })}
          maxLength={2000}
        />
        <UsualButtons
          what="description"
          valueKey={values.description}
          canSave={canSaveUsuals && canSaveUsualText(values.description, usuals.description, startingText.description)}
          canUse={canUseUsualText(values.description, usuals.description)}
          save={() => saveUsualDescription(values.description)}
          onSaved={(value) => setUsuals((u) => ({ ...u, description: value ?? values.description }))}
          onUse={() => {
            scope?.markEdited("description");
            update({ description: usuals.description });
          }}
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
                onClick={() => {
                  scope?.markEdited("validUntil");
                  if (target) update({ validUntil: target });
                }}
              >
                {days} days
              </Button>
            );
          })}
        </div>
        {showNeededBy ? (
          <TextField
            id="neededBy"
            type="date"
            label="Needed by (optional)"
            value={values.neededBy}
            error={f.neededBy}
            onChange={(neededBy) => update({ neededBy })}
          />
        ) : (
          <div>
            <AddButton
              id="add-needed-by"
              onClick={() => {
                setShowNeededBy(true);
                setTimeout(() => document.getElementById("neededBy")?.focus(), 0);
              }}
            >
              Add a needed-by date
            </AddButton>
          </div>
        )}
      </Section>

      <Section title="Items">
        {values.lines.length === 0 && (
          <p className="text-muted-foreground">
            No items yet. Add a product, a service or a one-off item.
          </p>
        )}
        {values.lines.length > 0 && (
          <ul id="items-list" className="space-y-2" aria-label="Items on this quote">
            {visibleLines.map((line) => {
              const index = values.lines.indexOf(line);
              return (
                <LineRow
                  key={line.key}
                  line={line}
                  number={index + 1}
                  error={(() => {
                    const e = errors.lines[line.key];
                    return e ? (e.name ?? e.variation ?? e.options ?? e.quantity ?? e.unitPrice ?? e.discountValue ?? e.description) : undefined;
                  })()}
                  money={money}
                  lineTotal={(() => {
                    const r = totals?.lines.find((l) => l.id === line.key);
                    return r ? r.amountBeforeDiscountCents - r.lineDiscountCents : null;
                  })()}
                  photoId={values.showPhotos ? photoOf(line) : null}
                  vatLabel={vat.registered && line.vatStatus && line.vatStatus !== "standard" ? vatStatuses[line.vatStatus].label : null}
                  onEdit={() => openSheet({ kind: "configure", line, isNew: false })}
                />
              );
            })}
          </ul>
        )}
        {collapsible && !hiddenHaveErrors && (
          <Button
            type="button"
            variant="soft"
            aria-controls="items-list"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Show fewer items" : `Show all ${values.lines.length} items`}
          </Button>
        )}
        <AddButton
          id="add-item"
          aria-invalid={!!f.lines}
          aria-describedby={f.lines ? "items-error" : undefined}
          onClick={() => openSheet({ kind: "pick" })}
        >
          Add item
        </AddButton>
        {f.lines && <FieldError id="items-error">{f.lines}</FieldError>}
        {/* Only when an item has a photo to show; nothing to decide otherwise. */}
        {values.lines.some((l) => photoOf(l)) && (
          <Field orientation="horizontal" className="items-start py-2.5">
            <Checkbox
              id="showPhotos"
              name="showPhotos"
              checked={values.showPhotos}
              onCheckedChange={(checked) => update({ showPhotos: checked === true })}
            />
            <FieldLabel htmlFor="showPhotos" className="text-base">
              Show product photos on this quote
            </FieldLabel>
          </Field>
        )}
        <LineSheet
          open={sheetOpen}
          view={sheetView}
          products={products}
          numberStyle={numberStyle}
          currencyCode={currencyCode}
          priceLabel={priceLabel}
          vatChoices={vatChoicesFor(vat, vatStatuses, numberStyle)}
          businessTypes={businessTypes}
          newKey={newKey}
          onView={openSheet}
          onClose={closeSheet}
          onSaveLine={saveLine}
          onRemoveLine={(key) => {
            const index = values.lines.findIndex((l) => l.key === key);
            if (index >= 0) removeLine(key, index);
            closeSheet();
          }}
          onProductSaved={productSaved}
          focusOnClose={() => focusAfterSheet.current}
        />
      </Section>

      <DeliverySection
        fulfilment={values.fulfilment}
        deliveryFee={values.deliveryFee}
        deliveryAddress={values.deliveryAddress}
        onChange={update}
        saved={savedAddresses}
        hasCustomer={values.customerId !== ""}
        feeLabel={priceEntryLabel(vat, taxName, "Delivery fee")}
        symbol={symbol}
        errors={{ deliveryFee: f.deliveryFee, deliveryAddress: f.deliveryAddress }}
      />

      {showDiscount ? (
        <Section title="Discount">
          <Field>
            <FieldLabel htmlFor="discountKind">Discount on the whole quote</FieldLabel>
            <NativeSelect
              id="discountKind"
              value={values.discountKind}
              onChange={(e) => {
                scope?.markEdited("discountValue");
                update({
                  discountKind: e.target.value as DiscountKind,
                  discountValue: e.target.value === "none" ? "" : values.discountValue,
                });
              }}
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
          <UsualButtons
            what="discount"
            valueKey={`${values.discountKind}:${values.discountValue}`}
            canSave={
              canSaveUsuals &&
              values.discountKind !== "none" &&
              values.discountValue.trim() !== "" &&
              !sameDiscount({ kind: values.discountKind, value: values.discountValue }, { kind: usuals.discountKind, value: usuals.discountValue })
            }
            canUse={
              usuals.discountKind !== "none" &&
              !sameDiscount({ kind: values.discountKind, value: values.discountValue }, { kind: usuals.discountKind, value: usuals.discountValue })
            }
            save={async () => {
              // What is saved is what was on screen when the button was pressed, whatever is typed while it saves.
              const sent = { kind: values.discountKind, value: values.discountValue };
              const result = await saveDiscountDefault(sent);
              if (result.status === "saved") {
                savedDiscount.current = sent;
                return { status: "saved" as const };
              }
              return {
                status: "error" as const,
                message: (result.status === "error" && (result.message ?? result.errors?.discountValue)) || undefined,
              };
            }}
            onSaved={() => {
              const saved = savedDiscount.current;
              if (saved) setUsuals((u) => ({ ...u, discountKind: saved.kind, discountValue: saved.value }));
            }}
            onUse={() => {
              scope?.markEdited("discountValue");
              update({ discountKind: usuals.discountKind, discountValue: usuals.discountValue });
            }}
          />
        </Section>
      ) : (
        <div>
          <AddButton
            id="add-discount"
            onClick={() => {
              setShowDiscount(true);
              // Asking to add one starts with a percentage, not with "No discount" (which stays in the list to undo it).
              if (values.discountKind === "none") update({ discountKind: "percent" });
              setTimeout(() => document.getElementById("discountValue")?.focus(), 0);
            }}
          >
            Add a discount
          </AddButton>
        </div>
      )}

      <DepositSection
        values={values}
        onChange={(change) => update(change)}
        fulfilment={values.fulfilment}
        issueDate={values.issueDate}
        grossCents={totals ? totals.grossCents : null}
        money={money}
        symbol={symbol}
        errors={{ depositValue: f.depositValue, balanceDueDate: f.balanceDueDate, balanceDueText: f.balanceDueText }}
        ask={askForDeposit}
        decided={quoteId !== null}
        footer={
          // "Ask each time" has no usual to save: the choice is made on every quote.
          !askForDeposit && usuals.depositKind !== "ask" && (
            <UsualButtons
              what="deposit"
              valueKey={`${values.depositKind}:${values.depositValue}`}
              canSave={
                canSaveUsuals &&
                values.depositKind !== "none" &&
                values.depositValue.trim() !== "" &&
                !sameDeposit({ kind: values.depositKind, value: values.depositValue }, { kind: usuals.depositKind, value: usuals.depositValue })
              }
              canUse={
                (usuals.depositKind === "percent" || usuals.depositKind === "fixed") &&
                !sameDeposit({ kind: values.depositKind, value: values.depositValue }, { kind: usuals.depositKind, value: usuals.depositValue })
              }
              save={async () => {
                // What is saved is what was on screen when the button was pressed, whatever is typed while it saves.
                const sent = { kind: values.depositKind, value: values.depositValue };
                const result = await saveDepositDefault(sent);
                if (result.status === "saved") {
                  savedDeposit.current = sent;
                  return { status: "saved" as const };
                }
                return {
                  status: "error" as const,
                  message: (result.status === "error" && (result.message ?? result.errors?.depositValue)) || undefined,
                };
              }}
              onSaved={() => {
                const saved = savedDeposit.current;
                if (saved) setUsuals((u) => ({ ...u, depositKind: saved.kind, depositValue: saved.value }));
              }}
              onUse={() => {
                scope?.markEdited("depositValue");
                scope?.markEdited("balanceDueDate");
                scope?.markEdited("balanceDueText");
                update({
                  depositKind: usuals.depositKind === "fixed" ? "fixed" : "percent",
                  depositValue: usuals.depositValue,
                });
              }}
            />
          )
        }
      />


      <TermsSection
        value={values.policies}
        onChange={(policies) => update({ policies })}
        library={policyLibrary}
        onLibraryAdd={(policy) => setPolicyLibrary((list) => [...list.filter((p) => p.id !== policy.id), policy])}
        content={policyContent}
        canManage={canManagePolicies}
        error={f.policies}
        errorsByKey={errors.policies}
        newKey={newKey}
      />

      <BankDetailsSection
        bank={bankDetails}
        countryCode={countryCode}
        canEdit={canEditBankDetails}
        show={values.showBankDetails}
        onShowChange={(showBankDetails) => update({ showBankDetails })}
        onBankSaved={setBankDetails}
      >
        <TextAreaField
          id="paymentInstructions"
          label="Notes about paying (optional)"
          hint={`Printed under your bank details. For example, ${getLocalePack(countryCode).payment.otherWaysHint}`}
          value={values.paymentInstructions}
          error={f.paymentInstructions}
          onChange={(paymentInstructions) => update({ paymentInstructions })}
          maxLength={1000}
        />
        <UsualButtons
          what="payment notes"
          valueKey={values.paymentInstructions}
          canSave={canSaveUsuals && canSaveUsualText(values.paymentInstructions, usuals.paymentInstructions)}
          canUse={canUseUsualText(values.paymentInstructions, usuals.paymentInstructions)}
          save={() => saveUsualPayment(values.paymentInstructions)}
          onSaved={(value) => setUsuals((u) => ({ ...u, paymentInstructions: value ?? values.paymentInstructions }))}
          onUse={() => {
            scope?.markEdited("paymentInstructions");
            update({ paymentInstructions: usuals.paymentInstructions });
          }}
        />
      </BankDetailsSection>

      <Section title="Notes">
        <TextAreaField
          id="notes"
          label="Notes for your customer (optional)"
          hint="Shown on the quote, like how long the work takes."
          value={values.notes}
          error={f.notes}
          onChange={(notes) => update({ notes })}
          maxLength={2000}
        />
      </Section>

      <Section title="Sign-off">
        <TextAreaField
          id="signOff"
          label="Message (optional)"
          maxLength={QUOTE_SIGN_OFF_MAX}
          rows={3}
          value={values.signOff}
          error={f.signOff}
          onChange={(signOff) => update({ signOff })}
          hint="Shown at the end, above your business name."
        />
        <UsualButtons
          what="sign-off"
          valueKey={values.signOff}
          canSave={canSaveUsuals && canSaveUsualText(values.signOff, usuals.signOff, startingText.signOff)}
          canUse={canUseUsualText(values.signOff, usuals.signOff)}
          save={() => saveUsualSignOff(values.signOff)}
          onSaved={(value) => setUsuals((u) => ({ ...u, signOff: value ?? values.signOff }))}
          onUse={() => {
            scope?.markEdited("signOff");
            update({ signOff: usuals.signOff });
          }}
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
    </FormErrorScope>

    {children}

      {/* Always in view above the tab bar. It comes last, after anything under the form (such as
          Delete draft), so nothing is hidden beneath it, and it sits flush with the end of the
          page (-mb-8 takes back the page's bottom padding) so it never moves when you reach the bottom. */}
      <div data-testid="action-bar" className="sticky bottom-14 z-10 -mx-4 -mb-8 transform-gpu border-t border-border bg-card px-4 py-2 md:bottom-0">
        {/* On a phone the total and Save share a row and the next step has the row below, whatever the total is (a long
            total must not make the bar change shape); from a tablet up it is one line. */}
        <div className="mx-auto grid max-w-2xl grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 sm:flex sm:justify-end">
          <div className="min-w-0 sm:mr-auto">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="truncate text-lg font-semibold" data-testid="sticky-total">
              {totals ? money(totals.grossCents) : "–"}
            </p>
          </div>
          {/* "Save" on the screen; a screen reader hears "Save draft" (the extra word is read, not shown). */}
          <Button type="submit" form="quote-form" variant="outline" disabled={pending} size="lg">
            {pending ? (
              "Saving…"
            ) : (
              <>
                Save<span className="sr-only"> draft</span>
              </>
            )}
          </Button>
          <Button id="preview-quote" type="button" disabled={pending} size="lg" className="col-span-2 sm:col-span-1" onClick={onPreview}>
            Continue to preview
          </Button>
        </div>
      </div>
  </div>
  );
}

/** The errors minus the ones whose field has been edited since the save came back. */
function withoutEdited(errors: QuoteErrors, edited: ReadonlySet<string> | undefined): QuoteErrors {
  if (!edited || edited.size === 0) return errors;
  const idOf = (field: string) => (field === "customerId" ? "customer" : field === "lines" ? "add-item" : field);
  const fields = Object.fromEntries(Object.entries(errors.fields).filter(([field]) => !edited.has(idOf(field))));
  const lines = Object.fromEntries(Object.entries(errors.lines).filter(([key]) => !edited.has(`line-${key}-edit`)));
  return { ...errors, fields, lines };
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

/** More than this many items and the list shows only the first few until "Show all" is pressed. */
const COLLAPSE_OVER = 6;
const COLLAPSED_SHOWS = 5;

/** One line on the quote as a compact row: what it is, how many at what price, its total. Tap to edit (remove is in the sheet). */
function LineRow({
  line,
  number,
  error,
  money,
  lineTotal,
  photoId,
  vatLabel,
  onEdit,
}: {
  line: LineFormValues;
  /** The VAT treatment's name when it is not the standard one. */
  vatLabel: string | null;
  number: number;
  /** The product's photo, shown small when the quote shows photos. */
  photoId: string | null;
  error?: string;
  money: (cents: number) => string;
  lineTotal: number | null;
  onEdit: () => void;
}) {
  const quantity = parseQuantity(line.quantity);
  const price = parseMoney(line.unitPrice);
  const name = line.name.trim() || `Item ${number}`;
  return (
    <li data-testid="quote-line">
      <Button
        id={`line-${line.key}-edit`}
        type="button"
        variant="outline"
        aria-describedby={error ? `line-${line.key}-error` : undefined}
        onClick={onEdit}
        className="h-auto min-h-14 w-full justify-between gap-3 px-3 py-2 text-left font-normal"
      >
        <span className="flex min-w-0 items-center gap-3">
          {photoId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl(photoId, "thumb")}
              alt=""
              loading="lazy"
              className="size-10 shrink-0 rounded-md object-cover ring-1 ring-foreground/10"
            />
          )}
          <span className="min-w-0">
            <span className="block truncate text-base font-medium">
              <span className="sr-only">Edit </span>
              {name}
            </span>
            <span className="block truncate text-sm text-muted-foreground">
              {quantity.ok ? (line.unit.trim() ? `${line.quantity} ${line.unit.trim()}` : line.quantity) : "?"} ×{" "}
              {price.ok ? money(price.value + optionsPerItem(line.options ?? [])) : "?"}
              {line.variationName && ` · ${line.variationName}`}
              {(line.options?.length ?? 0) > 0 && ` · ${line.options!.length} ${line.options!.length === 1 ? "option" : "options"}`}
              {line.discountKind !== "none" && " · discount"}
              {vatLabel && ` · ${vatLabel}`}
              {!line.productId && " · one-off item"}
            </span>
          </span>
        </span>
        <span className="shrink-0 text-base font-medium">{lineTotal !== null ? money(lineTotal) : "–"}</span>
      </Button>
      {error && (
        <p className="px-1 pt-1 text-sm text-destructive" id={`line-${line.key}-error`}>
          {error}
        </p>
      )}
    </li>
  );
}
