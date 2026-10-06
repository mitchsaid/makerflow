"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { Section, SelectField, TextAreaField, TextField } from "@/components/form-fields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import type { CustomerFieldErrors } from "@/lib/customers";
import { getLocalePack } from "@/lib/locale";
import type { CustomerSaveState, CustomerSummaryOption } from "./actions";
import type { CustomerFormValues } from "./customer-values";

const initialState: CustomerSaveState = { status: "idle" };

type Action = (previous: CustomerSaveState, formData: FormData) => Promise<CustomerSaveState>;

/**
 * Set when the form is shown in a sheet over something else (the quote): instead of
 * navigating, it hands the saved customer back and leaves the page underneath untouched.
 */
export type EmbeddedCustomerForm = {
  onDone: (customer: CustomerSummaryOption) => void;
  onCancel: () => void;
  /** "Use Thandi instead" on the duplicate warning, rather than a link that leaves the page. */
  onUseExisting: (customer: CustomerSummaryOption) => void;
  /** The sheet must not close while a save is on its way: the result would be lost. */
  onPendingChange: (pending: boolean) => void;
};

const OFFLINE_MESSAGE =
  "Couldn't reach the server. Check your connection and try again. Nothing you typed is lost.";

/**
 * In a sheet, a failed request (no signal, say) must show a message, not throw the whole page
 * away with the quote underneath. Only for actions that never redirect.
 */
function guarded(action: Action): Action {
  return async (previous, formData) => {
    try {
      return await action(previous, formData);
    } catch (error) {
      console.error("customer form request failed:", error);
      return { status: "error", message: OFFLINE_MESSAGE };
    }
  };
}

/**
 * Add or edit a customer. Only the name is needed; everything else is optional and can be
 * added later. Adding warns (never blocks) when the name or phone matches someone already
 * on the list.
 */
export function CustomerForm({
  action,
  initial,
  countryCode,
  mode,
  embedded,
  idPrefix = "",
}: {
  action: Action;
  initial: CustomerFormValues;
  countryCode: string;
  mode: "add" | "edit";
  embedded?: EmbeddedCustomerForm;
  /**
   * Put in front of every field's id. A form in a sheet sits on a page that has its own
   * fields ("notes"): without a prefix two elements share an id and labels point at the wrong one.
   */
  idPrefix?: string;
}) {
  const locale = getLocalePack(countryCode);
  const fid = (key: string) => `${idPrefix}${key}`;
  const [state, formAction, pending] = useActionState(embedded ? guarded(action) : action, initialState);
  const [, startTransition] = useTransition();
  const [values, setValues] = useState<CustomerFormValues>(initial);
  const [editedSinceSave, setEditedSinceSave] = useState(false);
  // The optional sections start open when editing or when there is already something in them.
  const hasMore = [
    initial.addressLine1,
    initial.addressLine2,
    initial.city,
    initial.region,
    initial.postalCode,
    initial.deliveryAddress,
    initial.notes,
  ].some((v) => v !== "");
  const [showMore, setShowMore] = useState(mode === "edit" || hasMore);

  // Hand the result to whoever opened the sheet, once per result.
  const embeddedRef = useRef(embedded);
  useEffect(() => {
    embeddedRef.current = embedded;
  });
  useEffect(() => {
    if (state.status === "created" || (state.status === "saved" && embeddedRef.current)) {
      embeddedRef.current?.onDone(state.option);
    }
  }, [state]);
  useEffect(() => {
    embeddedRef.current?.onPendingChange(pending);
  }, [pending]);

  const errors: CustomerFieldErrors = state.status === "error" ? (state.errors ?? {}) : {};
  const duplicates = state.status === "duplicate" && !editedSinceSave ? state.matches : null;

  const problems: FormProblem[] = (
    [
      ["name", "Name"],
      ["contactPerson", "Contact person"],
      ["vatNumber", locale.tax.registrationNumberLabel],
      ["companyRegistrationNumber", "Company registration number"],
      ["phone", "Phone"],
      ["email", "Email"],
      ["addressLine1", "Street address"],
      ["addressLine2", "Suburb or building"],
      ["city", "City or town"],
      ["region", locale.address.regionLabel],
      ["postalCode", "Postal code"],
      ["deliveryAddress", "Delivery address"],
      ["notes", "Private notes"],
    ] as const
  ).flatMap(([field, label]) => {
    // Business-only fields are not on screen when "this is a business" is off.
    const onScreen =
      values.isBusiness ||
      !["contactPerson", "vatNumber", "companyRegistrationNumber"].includes(field);
    const message = errors[field];
    return message && onScreen ? [{ fieldId: fid(field), label, message }] : [];
  });

  const set =
    <K extends keyof CustomerFormValues>(key: K) =>
    (value: CustomerFormValues[K]) => {
      setEditedSinceSave(true);
      setValues((v) => ({ ...v, [key]: value }));
    };

  const text = (
    key: Exclude<keyof CustomerFormValues, "isBusiness">,
    label: string,
    props: Omit<React.ComponentProps<typeof TextField>, "id" | "label" | "value" | "onChange" | "error"> = {},
  ) => (
    <TextField
      id={fid(key)}
      name={key}
      label={label}
      error={errors[key]}
      value={values[key]}
      onChange={set(key)}
      {...props}
    />
  );

  // Submitted by hand (see the business profile form for why).
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // In a sheet this form sits inside the quote's form in the React tree: without this the
    // submit would bubble up and save the quote too.
    event.stopPropagation();
    const formData = new FormData(event.currentTarget);
    // The person has seen the "looks like someone you already have" note and chose to go on.
    if (duplicates) formData.set("confirmDuplicate", "yes");
    setEditedSinceSave(false);
    startTransition(() => formAction(formData));
  }

  const submitLabel = pending
    ? "Saving…"
    : mode === "edit"
      ? "Save changes"
      : duplicates
        ? "Add anyway"
        : "Add customer";

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Section title="Customer">
        {text("name", "Name", { autoComplete: "off", required: true, maxLength: 120 })}
        <Field orientation="horizontal" className="items-start py-2.5">
          <Checkbox
            id={fid("isBusiness")}
            name="kind"
            value="business"
            checked={values.isBusiness}
            onCheckedChange={(checked) => set("isBusiness")(checked)}
          />
          <FieldLabel htmlFor={fid("isBusiness")} className="text-base">
            This is a business
          </FieldLabel>
        </Field>
        {values.isBusiness && (
          <>
            <FieldDescription>
              Business details are optional. A {locale.tax.registrationNumberLabel} and address
              are needed on a full tax invoice for a bigger sale to a business.
            </FieldDescription>
            {text("contactPerson", "Contact person", { autoComplete: "off" })}
            {text("vatNumber", locale.tax.registrationNumberLabel, { autoComplete: "off" })}
            {text("companyRegistrationNumber", "Company registration number", {
              autoComplete: "off",
            })}
          </>
        )}
      </Section>

      <Section title="How to reach them">
        {text("phone", "Phone", { type: "tel", autoComplete: "off" })}
        {text("email", "Email", { type: "email", inputMode: "email", autoComplete: "off" })}
      </Section>

      {showMore ? (
        <>
          <Section title="Address">
            {text("addressLine1", "Street address", { autoComplete: "off" })}
            {text("addressLine2", "Suburb or building (optional)", { autoComplete: "off" })}
            {text("city", "City or town", { autoComplete: "off" })}
            <SelectField
              id={fid("region")}
              name="region"
              label={locale.address.regionLabel}
              error={errors.region}
              value={values.region}
              onChange={set("region")}
              placeholder={`Choose a ${locale.address.regionLabel.toLowerCase()}`}
              options={locale.address.regions}
            />
            {text("postalCode", "Postal code", { inputMode: "numeric", autoComplete: "off" })}
          </Section>
          <Section title="Delivery">
            <TextAreaField
              id={fid("deliveryAddress")}
              name="deliveryAddress"
              label="Deliver to (optional)"
              hint="Only if it is different from the address above."
              error={errors.deliveryAddress}
              value={values.deliveryAddress}
              onChange={set("deliveryAddress")}
              maxLength={400}
            />
          </Section>
          <Section title="Private notes">
            <TextAreaField
              id={fid("notes")}
              name="notes"
              label="Anything to remember (optional)"
              hint="Only you and your team see these. They never appear on a quote or invoice."
              error={errors.notes}
              value={values.notes}
              onChange={set("notes")}
              maxLength={2000}
            />
          </Section>
        </>
      ) : (
        <Button type="button" variant="outline" onClick={() => setShowMore(true)}>
          Add address, delivery details or notes
        </Button>
      )}

      {state.status === "error" && state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      {duplicates && (
        <Alert data-testid="duplicate-warning" role="status">
          <AlertTitle>
            {duplicates.length === 1
              ? "You may already have this customer"
              : "You may already have these customers"}
          </AlertTitle>
          <AlertDescription>
            <span>
              Same name or phone number as{" "}
              {duplicates.map((d, i) => (
                <span key={d.id}>
                  {i > 0 && ", "}
                  {embedded ? (
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 align-baseline"
                      onClick={() => embedded.onUseExisting(d)}
                    >
                      Use {d.name} instead
                    </Button>
                  ) : (
                    <Link href={`/app/customers/${d.id}`} className="font-medium underline">
                      {d.name}
                    </Link>
                  )}
                </span>
              ))}
              . Add anyway if this is a different person.
            </span>
          </AlertDescription>
        </Alert>
      )}
      <FormSummary problems={problems} trigger={state} />
      {state.status === "saved" && !embedded && !pending && !editedSinceSave && (
        <p role="status" className="text-sm font-medium">
          Saved.
        </p>
      )}

      <div
        className={
          embedded
            ? "sticky bottom-0 -mx-4 flex flex-col gap-3 border-t border-border bg-popover px-4 py-3 sm:flex-row"
            : "flex flex-col gap-3 sm:flex-row"
        }
      >
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {submitLabel}
        </Button>
        {embedded && (
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={pending}
            onClick={embedded.onCancel}
          >
            Cancel
          </Button>
        )}
        {mode === "add" && !embedded && (
          <Link
            href="/app/customers"
            className={buttonVariants({ variant: "outline", className: "w-full sm:w-auto" })}
          >
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
