"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ComingSoonSection } from "@/components/coming-soon";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { UnitField } from "@/components/unit-field";
import { Section, TextAreaField, TextField } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ProductFieldErrors, ProductKind, ProductSummary } from "@/lib/products";
import Link from "next/link";
import type { ProductSaveState } from "./actions";
import { KIND_WORDS, listHref, type ProductFormValues } from "./product-values";

/**
 * The layers a product will grow, shown where they will live but not working yet
 * (docs/plans/products.md). Each becomes a real section when it is built.
 */
const COMING_SOON: Record<ProductKind, readonly (readonly [string, string])[]> = {
  product: [
    ["Photo", "A picture, so you can spot it in lists and show it on your quotes."],
    ["Variations and extras", "Choices like size or flavour, and optional add-ons, each with its own price."],
    ["Costs and margin", "What it costs to make (materials, your time, other costs), so you can see your profit."],
    ["Quantity prices", "Lower prices when someone orders more."],
    ["Production steps", "The steps to make it, so you can track each job."],
    ["Stock", "How many you have ready to sell."],
  ],
  // Services (founder, 2026-10-03): no photo or stock; costs are mostly your time.
  service: [
    ["Variations and extras", "Options like a rush job or working on site, each with its own price."],
    ["Costs and margin", "Your time at an hourly rate and any other costs, so you can see your profit."],
    ["Quantity prices", "Lower rates for larger amounts."],
    ["Steps", "The steps of the service, so you can track each job."],
  ],
};


const initialState: ProductSaveState = { status: "idle" };
type Action = (previous: ProductSaveState, formData: FormData) => Promise<ProductSaveState>;

/**
 * Set when the form is shown in a sheet over a quote: instead of navigating, it hands the
 * saved product back and leaves the quote underneath untouched.
 */
export type EmbeddedProductForm = {
  onDone: (product: ProductSummary) => void;
  onCancel: () => void;
  /** The sheet must not close while a save is on its way: the result would be lost. */
  onPendingChange: (pending: boolean) => void;
};

/** In a sheet, a failed request (no signal) shows a message instead of an error page. */
function guarded(action: Action): Action {
  return async (previous, formData) => {
    try {
      return await action(previous, formData);
    } catch (error) {
      console.error("product form request failed:", error);
      return {
        status: "error",
        message: "Couldn't reach the server. Check your connection and try again. Nothing you typed is lost.",
      };
    }
  };
}

/** Add or edit a product. The basics work; the later layers are shown as "coming soon". */
export function ProductForm({
  action,
  initial,
  mode,
  priceLabel,
  currencySymbol,
  idPrefix = "",
  embedded,
}: {
  action: Action;
  initial: ProductFormValues;
  mode: "add" | "edit";
  /** "Price (including VAT)" and so on, from the business's VAT setting. */
  priceLabel: string;
  /** "R": shown before the price. */
  currencySymbol: string;
  /** In front of every field id, for when the form shares a page with other fields. */
  idPrefix?: string;
  embedded?: EmbeddedProductForm;
}) {
  const [state, formAction, pending] = useActionState(embedded ? guarded(action) : action, initialState);
  // Hand the result to whoever opened the sheet, once per result.
  const embeddedRef = useRef(embedded);
  useEffect(() => {
    embeddedRef.current = embedded;
  });
  useEffect(() => {
    if (state.status === "created" || (state.status === "saved" && embeddedRef.current)) {
      embeddedRef.current?.onDone(state.product);
    }
  }, [state]);
  useEffect(() => {
    embeddedRef.current?.onPendingChange(pending);
  }, [pending]);
  const [, startTransition] = useTransition();
  const [values, setValues] = useState<ProductFormValues>(initial);
  const [editedSinceSave, setEditedSinceSave] = useState(false);
  const fid = (key: string) => `${idPrefix}${key}`;
  const errors: ProductFieldErrors = state.status === "error" ? (state.errors ?? {}) : {};

  const problems: FormProblem[] = (
    [
      ["name", "Name"],
      ["unitPrice", priceLabel],
      ["unit", "Unit"],
      ["description", "Description"],
    ] as const
  ).flatMap(([field, label]) => {
    const message = errors[field];
    return message ? [{ fieldId: fid(field), label, message }] : [];
  });

  const set =
    <K extends keyof ProductFormValues>(key: K) =>
    (value: ProductFormValues[K]) => {
      setEditedSinceSave(true);
      setValues((v) => ({ ...v, [key]: value }));
    };

  // Submitted by hand (see the business profile form for why).
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    const formData = new FormData(event.currentTarget);
    setEditedSinceSave(false);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Section title="Basics">
        <TextField
          id={fid("name")}
          name="name"
          label="Name"
          autoComplete="off"
          maxLength={200}
          value={values.name}
          error={errors.name}
          onChange={set("name")}
        />
        {/* The kind is decided by where the form was opened ("Add new service" and so on). */}
        <input type="hidden" name="kind" value={values.kind} />
        <TextField
          id={fid("unitPrice")}
          name="unitPrice"
          label={priceLabel}
          startText={currencySymbol}
          inputMode="decimal"
          autoComplete="off"
          value={values.unitPrice}
          error={errors.unitPrice}
          onChange={set("unitPrice")}
        />
        <UnitField
          id={fid("unit")}
          name="unit"
          value={values.unit}
          error={errors.unit}
          onChange={set("unit")}
          hint="What one is, like kg, dozen or hour. The price above is per unit. Leave it empty for a plain count."
        />
        <TextAreaField
          id={fid("description")}
          name="description"
          label="Description (optional)"
          hint="Shown on your quotes under the name."
          maxLength={1000}
          value={values.description}
          error={errors.description}
          onChange={set("description")}
        />
      </Section>

      {COMING_SOON[values.kind].map(([title, description]) => (
        <ComingSoonSection key={title} title={title} description={description} />
      ))}

      {state.status === "error" && state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
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
          {pending ? "Saving…" : mode === "edit" ? "Save changes" : `Add ${KIND_WORDS[values.kind].one}`}
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
            href={listHref(values.kind)}
            className={buttonVariants({ variant: "outline", className: "w-full sm:w-auto" })}
          >
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
