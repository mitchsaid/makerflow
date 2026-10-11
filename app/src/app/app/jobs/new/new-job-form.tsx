"use client";

import { useRef, useState, useTransition } from "react";
import { AddButton } from "@/components/add-button";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { Section, TextAreaField, TextField } from "@/components/form-fields";
import { UnitField } from "@/components/unit-field";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { CustomerOption, SavedAddress } from "@/lib/customers";
import type { JobFulfilment } from "@/lib/jobs";
import { emptyJobItem, NEW_JOB_LIMITS, parseNewJob, type NewJobErrors, type NewJobItemValues, type NewJobValues } from "@/lib/jobs/new-job";
import { addressWhenCustomerChanges, addressWhenFulfilmentChanges, addressWhenSavedAddressesChange } from "@/lib/quotes/delivery";
import { CustomerPicker } from "../../quotes/customer-picker";
import { createManualJob } from "../actions";

const OFFLINE = "Couldn't reach the server, so we can't tell whether the job was made. Check the Jobs list, then try again if it is not there. Your changes are still here.";

/**
 * A job without a quote: who it is for, what to make, when it is needed and how it gets to them. One scrolling form
 * like the quote's. "Create job" is always enabled: pressing it with something missing lists what to fix, at the
 * fields and in a summary that jumps to the first one, and nothing typed is lost.
 */
export function NewJobForm({
  customers: initialCustomers,
  countryCode,
}: {
  customers: CustomerOption[];
  countryCode: string;
}) {
  const nextKey = useRef(1);
  const [customers, setCustomers] = useState(initialCustomers);
  const [values, setValues] = useState<NewJobValues>({
    customerId: "",
    fulfilment: "none",
    deliveryAddress: "",
    neededBy: "",
    note: "",
    items: [emptyJobItem("item-0")],
  });
  const [errors, setErrors] = useState<NewJobErrors>({});
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [tried, setTried] = useState(0);
  const [pending, startTransition] = useTransition();

  const saved: SavedAddress[] = customers.find((c) => c.id === values.customerId)?.addresses ?? [];

  function update(change: Partial<NewJobValues>) {
    setValues((v) => ({ ...v, ...change }));
  }
  function chooseCustomer(customerId: string, next: SavedAddress[]) {
    setValues((v) => ({ ...v, customerId, deliveryAddress: addressWhenCustomerChanges(v.deliveryAddress, saved, next) }));
  }
  function chooseFulfilment(fulfilment: JobFulfilment) {
    setErrors((e) => {
      const rest = { ...e };
      delete rest.deliveryAddress;
      return rest;
    });
    setValues((v) => ({ ...v, fulfilment, deliveryAddress: addressWhenFulfilmentChanges(fulfilment, v.deliveryAddress, saved) }));
  }
  /** The picker adds or edits customers; when the chosen one's saved addresses change, the address typed here follows. */
  function changeCustomers(update: (list: CustomerOption[]) => CustomerOption[]) {
    const after = update(customers).find((c) => c.id === values.customerId)?.addresses ?? [];
    setCustomers(update);
    if (after !== saved && values.customerId !== "") {
      setValues((v) => ({ ...v, deliveryAddress: addressWhenSavedAddressesChange(v.deliveryAddress, saved, after) }));
    }
  }
  function changeItem(key: string, change: Partial<NewJobItemValues>) {
    setValues((v) => ({ ...v, items: v.items.map((item) => (item.key === key ? { ...item, ...change } : item)) }));
  }
  function addItem() {
    const key = `item-${nextKey.current++}`;
    setValues((v) => ({ ...v, items: [...v.items, emptyJobItem(key)] }));
    // The new item's name is the next thing to type.
    setTimeout(() => document.querySelector<HTMLInputElement>(`[data-item-key="${key}"] input`)?.focus(), 0);
  }
  function removeItem(key: string) {
    setValues((v) => ({ ...v, items: v.items.filter((item) => item.key !== key) }));
    // Messages are tied to the item's position, which has just moved: they come back if pressing Create finds them again.
    setErrors({});
    setServerMessage(null);
    setTimeout(() => document.getElementById("add-item")?.focus(), 0);
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
  if (errors.customerId) problems.push({ fieldId: "customer", label: "Customer name", message: errors.customerId });
  values.items.forEach((item, i) => {
    const label = `Item ${i + 1}`;
    if (errors[`item-${i}-name`]) problems.push({ fieldId: `item-${item.key}-name`, label: `${label}: name`, message: errors[`item-${i}-name`] });
    if (errors[`item-${i}-quantity`]) problems.push({ fieldId: `item-${item.key}-quantity`, label: `${label}: quantity`, message: errors[`item-${i}-quantity`] });
    if (errors[`item-${i}-unit`]) problems.push({ fieldId: `item-${item.key}-unit`, label: `${label}: unit`, message: errors[`item-${i}-unit`] });
    if (errors[`item-${i}-description`]) problems.push({ fieldId: `item-${item.key}-description`, label: `${label}: details`, message: errors[`item-${i}-description`] });
  });
  if (errors.items) problems.push({ fieldId: "add-item", label: "Items", message: errors.items });
  if (errors.neededBy) problems.push({ fieldId: "neededBy", label: "Needed by", message: errors.neededBy });
  if (errors.fulfilment) problems.push({ fieldId: "fulfilment-none", label: "Delivery or collection", message: errors.fulfilment });
  if (errors.deliveryAddress) problems.push({ fieldId: "deliveryAddress", label: "Deliver to", message: errors.deliveryAddress });
  if (errors.note) problems.push({ fieldId: "note", label: "Your note", message: errors.note });
  if (serverMessage) problems.push({ fieldId: "create-job", label: "Create job", message: serverMessage });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6" data-testid="new-job-form">
      <FormSummary problems={problems} trigger={tried} />

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

      <Section title="What to make">
        <ul className="space-y-6" aria-label="Items to make">
          {values.items.map((item, i) => (
            <li key={item.key} data-item-key={item.key} className="space-y-3">
              <TextField
                id={`item-${item.key}-name`}
                label={`Item ${i + 1}`}
                autoComplete="off"
                maxLength={NEW_JOB_LIMITS.itemName + 50}
                value={item.name}
                error={errors[`item-${i}-name`]}
                onChange={(name) => changeItem(item.key, { name })}
              />
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  id={`item-${item.key}-quantity`}
                  label="Quantity"
                  inputMode="decimal"
                  autoComplete="off"
                  value={item.quantity}
                  error={errors[`item-${i}-quantity`]}
                  onChange={(quantity) => changeItem(item.key, { quantity })}
                />
                <UnitField
                  id={`item-${item.key}-unit`}
                  value={item.unit}
                  error={errors[`item-${i}-unit`]}
                  onChange={(unit) => changeItem(item.key, { unit })}
                />
              </div>
              <TextAreaField
                id={`item-${item.key}-description`}
                label="Details (optional)"
                hint="Size, colour, wording: anything you need at the bench."
                rows={2}
                maxLength={NEW_JOB_LIMITS.description + 100}
                value={item.description}
                error={errors[`item-${i}-description`]}
                onChange={(description) => changeItem(item.key, { description })}
              />
              {values.items.length > 1 && (
                <Button type="button" variant="outline" onClick={() => removeItem(item.key)}>
                  Remove item {i + 1}
                </Button>
              )}
            </li>
          ))}
        </ul>
        {errors.items && (
          <p id="items-error" role="alert" className="text-sm text-destructive">
            {errors.items}
          </p>
        )}
        {values.items.length < NEW_JOB_LIMITS.items && (
          <AddButton id="add-item" onClick={addItem}>
            Add another item
          </AddButton>
        )}
      </Section>

      <Section title="When and how">
        <TextField
          id="neededBy"
          type="date"
          label="Needed by (optional)"
          value={values.neededBy}
          error={errors.neededBy}
          onChange={(neededBy) => update({ neededBy })}
        />
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
          <TextAreaField
            id="deliveryAddress"
            label="Deliver to (optional)"
            hint={saved.length > 0 ? "Started from the address on file. Change it for this job if it goes elsewhere." : "Type the address, or leave it for later."}
            rows={3}
            maxLength={NEW_JOB_LIMITS.address + 100}
            autoComplete="off"
            value={values.deliveryAddress}
            error={errors.deliveryAddress}
            onChange={(deliveryAddress) => update({ deliveryAddress })}
          />
        )}
      </Section>

      <Section title="Your note">
        <TextAreaField
          id="note"
          label="Note (optional)"
          hint="Only you and your team see this."
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
  );
}
