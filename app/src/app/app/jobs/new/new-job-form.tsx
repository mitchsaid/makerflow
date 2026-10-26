"use client";

import { PrivateTag } from "@/components/private-tag";
import { useRef, useState, useTransition } from "react";
import { AddButton } from "@/components/add-button";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { DeliveryAddress } from "@/components/delivery-address";
import { OptionalTag, Section, TextAreaField, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { FieldError, Field, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { BusinessType } from "@/lib/business-types";
import type { CustomerOption, SavedAddress } from "@/lib/customers";
import { imageUrl } from "@/lib/images";
import type { JobFulfilment } from "@/lib/jobs";
import { jobItemPhoto } from "@/lib/jobs/photos";
import { NEW_JOB_LIMITS, parseNewJob, type NewJobErrors, type NewJobLine, type NewJobValues } from "@/lib/jobs/new-job";
import { priceEntryLabel, type LocalePack } from "@/lib/locale";
import type { VatSettings } from "@/lib/money";
import type { NumberStyle } from "@/lib/money/format";
import type { ProductSummary } from "@/lib/products";
import type { LineFormValues } from "@/lib/quotes";
import { addressWhenCustomerChanges, addressWhenFulfilmentChanges, addressWhenSavedAddressesChange } from "@/lib/quotes/delivery";
import { quantityText } from "@/lib/quotes/units";
import { vatChoicesFor } from "@/lib/quotes/vat-choices";
import { CustomerPicker } from "../../quotes/customer-picker";
import { LineSheet, type LineSheetView } from "../../quotes/line-sheet";
import { useItemSheetProducts } from "../../quotes/use-item-sheet-products";
import { createManualJob } from "../actions";
import { FormErrorScope } from "@/components/form-errors";

const OFFLINE = "Couldn't reach the server, so the job may not have been made. Check the Jobs list, then try again.";

/**
 * A job without a quote: who it is for, what to make, when it is needed and how it gets to them. One scrolling form
 * like the quote's, and items are added the way a quote's are (the same sheet, without prices). "Create job" is
 * always enabled: pressing it with something missing lists what to fix, at the fields and in a summary that jumps to
 * the first one, and nothing typed is lost.
 */
export function NewJobForm({
  customers: initialCustomers,
  initialCustomerId = "",
  products: initialProducts,
  countryCode,
  numberStyle,
  currencyCode,
  vat,
  taxName,
  vatStatuses,
  businessTypes,
}: {
  customers: CustomerOption[];
  /** The customer chosen when the form opens (from a customer's page). */
  initialCustomerId?: string;
  products: ProductSummary[];
  countryCode: string;
  numberStyle: NumberStyle;
  currencyCode: string;
  /** For adding a new product from inside the item sheet (its price and VAT). */
  vat: VatSettings;
  taxName: string;
  vatStatuses: LocalePack["tax"]["statuses"];
  businessTypes: BusinessType[] | null;
}) {
  const [customers, setCustomers] = useState(initialCustomers);
  const { products, productSaved, newKey } = useItemSheetProducts(initialProducts);
  const [values, setValues] = useState<NewJobValues>({
    customerId: initialCustomerId,
    fulfilment: "none",
    deliveryAddress: "",
    neededBy: "",
    note: "",
    items: [],
  });
  const [errors, setErrors] = useState<NewJobErrors>({});
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [tried, setTried] = useState(0);
  const [pending, startTransition] = useTransition();

  // The item sheet: choosing what to add, configuring an item, or a product form.
  const [sheetView, setSheetView] = useState<LineSheetView | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const focusAfterSheet = useRef<string | null>(null);

  const saved: SavedAddress[] = customers.find((c) => c.id === values.customerId)?.addresses ?? [];

  function update(change: Partial<NewJobValues>) {
    setValues((v) => ({ ...v, ...change }));
  }
  function chooseCustomer(customerId: string, next: SavedAddress[]) {
    // Choosing someone answers "choose who this job is for".
    if (customerId !== "") {
      setErrors((e) => {
        const rest = { ...e };
        delete rest.customerId;
        return rest;
      });
    }
    setValues((v) => ({ ...v, customerId, deliveryAddress: addressWhenCustomerChanges(v.deliveryAddress, saved, next) }));
  }
  /** The picker adds or edits customers; when the chosen one's saved addresses change, the address typed here follows. */
  function changeCustomers(change: (list: CustomerOption[]) => CustomerOption[]) {
    const after = change(customers).find((c) => c.id === values.customerId)?.addresses ?? [];
    setCustomers(change);
    if (after !== saved && values.customerId !== "") {
      setValues((v) => ({ ...v, deliveryAddress: addressWhenSavedAddressesChange(v.deliveryAddress, saved, after) }));
    }
  }
  function chooseFulfilment(fulfilment: JobFulfilment) {
    setErrors((e) => {
      const rest = { ...e };
      delete rest.deliveryAddress;
      delete rest.fulfilment;
      return rest;
    });
    setValues((v) => ({ ...v, fulfilment, deliveryAddress: addressWhenFulfilmentChanges(fulfilment, v.deliveryAddress, saved) }));
  }

  function openSheet(view: LineSheetView) {
    focusAfterSheet.current = null;
    setSheetView(view);
    setSheetOpen(true);
  }
  function saveLine(line: LineFormValues, isNew: boolean) {
    setValues((v) => ({ ...v, items: isNew ? [...v.items, line] : v.items.map((l) => (l.key === line.key ? line : l)) }));
    // That item's message (if any) was about what it was before.
    setErrors((e) => {
      const rest = { ...e };
      delete rest[`line:${line.key}`];
      delete rest.items;
      return rest;
    });
    // Back on the form, keyboard focus goes to the item that was just added or changed.
    focusAfterSheet.current = `line-${line.key}-edit`;
    setSheetOpen(false);
  }
  function removeLine(key: string) {
    const index = values.items.findIndex((l) => l.key === key);
    if (index < 0) return;
    setValues((v) => ({ ...v, items: v.items.filter((l) => l.key !== key) }));
    setErrors((e) => {
      const rest = { ...e };
      delete rest[`line:${key}`];
      return rest;
    });
    // Focus moves to the next item, or to "Add item" when it was the last one.
    const next = values.items[index + 1] ?? values.items[index - 1];
    const target = next && next.key !== key ? `line-${next.key}-edit` : "add-item";
    focusAfterSheet.current = target;
    setTimeout(() => document.getElementById(target)?.focus(), 0);
    setSheetOpen(false);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerMessage(null);
    const parsed = parseNewJob(values);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setTried((n) => n + 1);
      return;
    }
    setErrors({});
    startTransition(async () => {
      try {
        const result = await createManualJob(values);
        if (result.status === "error") {
          // The customer is not theirs any more (archived elsewhere): back to the search box, where the message shows.
          if (result.errors?.customerId) chooseCustomer("", []);
          setErrors(result.errors ?? {});
          setServerMessage(result.message ?? null);
          setTried((n) => n + 1);
        }
      } catch (error) {
        // Making the job ends by opening it: that is a redirect, not a failure.
        const digest = (error as { digest?: unknown } | null)?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw error;
        setServerMessage(OFFLINE);
        setTried((n) => n + 1);
      }
    });
  }

  // The summary lists problems in the order the fields appear on screen.
  const problems: FormProblem[] = [];
  if (errors.neededBy) problems.push({ fieldId: "neededBy", label: "Needed by", message: errors.neededBy });
  if (errors.customerId) problems.push({ fieldId: "customer", label: "Customer name", message: errors.customerId });
  values.items.forEach((item, i) => {
    const message = errors[`line:${item.key}`];
    if (message) problems.push({ fieldId: `line-${item.key}-edit`, label: `Item ${i + 1}: ${item.name.trim() || "item"}`, message });
  });
  if (errors.items) problems.push({ fieldId: "add-item", label: "Items", message: errors.items });
  if (errors.fulfilment) problems.push({ fieldId: "fulfilment-none", label: "Delivery or collection", message: errors.fulfilment });
  if (errors.deliveryAddress) problems.push({ fieldId: "deliveryAddress", label: "Deliver to", message: errors.deliveryAddress });
  if (errors.note) problems.push({ fieldId: "note", label: "Private note", message: errors.note });
  if (serverMessage) problems.push({ fieldId: "create-job", label: "Create job", message: serverMessage });

  return (
    <FormErrorScope epoch={tried}>
    <form onSubmit={onSubmit} noValidate className="space-y-6" data-testid="new-job-form">
      <FormSummary problems={problems} trigger={tried} />

      <Section title="Dates">
        <TextField
          id="neededBy"
          type="date"
          label="Needed by (optional)"
          value={values.neededBy}
          error={errors.neededBy}
          onChange={(neededBy) => update({ neededBy })}
        />
      </Section>

      <Section title="Customer">
        <CustomerPicker
          id="customer"
          customers={customers}
          onCustomersChange={changeCustomers}
          subject="job"
          countryCode={countryCode}
          value={values.customerId}
          onChange={chooseCustomer}
          error={errors.customerId}
        />
      </Section>

      <Section title="Items">
        {values.items.length === 0 && (
          <p className="text-muted-foreground">No items yet. Add a product, a service or a one-off item.</p>
        )}
        {values.items.length > 0 && (
          <ul className="space-y-2" aria-label="Items on this job">
            {values.items.map((item, index) => (
              <ItemRow
                key={item.key}
                item={item}
                number={index + 1}
                error={errors[`line:${item.key}`]}
                numberStyle={numberStyle}
                photoId={jobItemPhoto(item, products)}
                onEdit={() => openSheet({ kind: "configure", line: item, isNew: false })}
              />
            ))}
          </ul>
        )}
        {values.items.length < NEW_JOB_LIMITS.items && (
          <AddButton
            id="add-item"
            aria-invalid={!!errors.items}
            aria-describedby={errors.items ? "items-error" : undefined}
            onClick={() => openSheet({ kind: "pick" })}
          >
            Add item
          </AddButton>
        )}
        {errors.items && <FieldError id="items-error">{errors.items}</FieldError>}
        <LineSheet
          mode="job"
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

      <Section title="Delivery or collection">
        <RadioGroup aria-label="Delivery or collection" value={values.fulfilment} onValueChange={(v) => chooseFulfilment(v as JobFulfilment)}>
          {(
            [
              ["none", "Not decided yet"],
              ["collection", "Collection (the customer collects)"],
              ["delivery", "Delivery (you deliver)"],
            ] as const
          ).map(([option, label]) => (
            <Field key={option} orientation="horizontal" className="items-start py-2.5">
              <RadioGroupItem id={`fulfilment-${option}`} value={option} />
              <FieldLabel htmlFor={`fulfilment-${option}`} className="text-base">
                {label}
              </FieldLabel>
            </Field>
          ))}
        </RadioGroup>
        {values.fulfilment === "delivery" && (
          <DeliveryAddress
            subject="job"
            value={values.deliveryAddress}
            onChange={(deliveryAddress) => update({ deliveryAddress })}
            saved={saved}
            hasCustomer={values.customerId !== ""}
            countryCode={countryCode}
            error={errors.deliveryAddress}
          />
        )}
      </Section>

      <Section title="Note" tag={<><OptionalTag /><PrivateTag /></>}>
        <TextAreaField
          id="note"
          label="Note (optional)"
          labelHidden
          hint="Like what they asked for, or where to leave it."
          rows={3}
          maxLength={NEW_JOB_LIMITS.note + 100}
          value={values.note}
          error={errors.note}
          onChange={(note) => update({ note })}
        />
      </Section>

      <Button id="create-job" type="submit" size="lg" className="w-full sm:w-auto" disabled={pending}>
        {pending ? "Creating the job…" : "Create job"}
      </Button>
    </form>
    </FormErrorScope>
  );
}

/** One item on the form, as a row that opens it for changes (the same as a quote's). */
function ItemRow({
  item,
  number,
  error,
  numberStyle,
  photoId,
  onEdit,
}: {
  item: NewJobLine;
  number: number;
  error?: string;
  numberStyle: NumberStyle;
  /** The picture of what was chosen, if there is one. */
  photoId: string | null;
  onEdit: () => void;
}) {
  const quantity = Number(item.quantity.replace(",", "."));
  const name = item.name.trim() || `Item ${number}`;
  const count = item.options?.length ?? 0;
  return (
    <li data-testid="job-form-item">
      <Button
        id={`line-${item.key}-edit`}
        type="button"
        variant="outline"
        aria-describedby={error ? `line-${item.key}-error` : undefined}
        onClick={onEdit}
        className="h-auto min-h-14 w-full justify-start gap-3 px-3 py-2 text-left font-normal"
      >
        {photoId && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl(photoId, "thumb")} alt="" loading="lazy" className="size-10 shrink-0 rounded-md object-cover ring-1 ring-foreground/10" />
        )}
        <span className="min-w-0">
          <span className="block truncate text-base font-medium">
            <span className="sr-only">Edit </span>
            {name}
          </span>
          <span className="block truncate text-sm text-muted-foreground">
            {Number.isFinite(quantity) && quantity > 0 ? quantityText(Math.round(quantity * 1000), item.unit.trim() || null, numberStyle) : item.quantity}
            {item.variationName && ` · ${item.variationName}`}
            {count > 0 && ` · ${count} ${count === 1 ? "option" : "options"}`}
            {!item.productId && " · one-off item"}
          </span>
        </span>
      </Button>
      {error && (
        <p className="px-1 pt-1 text-sm text-destructive" id={`line-${item.key}-error`}>
          {error}
        </p>
      )}
    </li>
  );
}
