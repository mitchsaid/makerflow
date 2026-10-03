"use client";

import { useActionState, useState, useTransition } from "react";
import { ComingSoonSection } from "@/components/coming-soon";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { Section, TextAreaField, TextField } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { ProductFieldErrors, ProductKind } from "@/lib/products";
import Link from "next/link";
import type { ProductSaveState } from "./actions";
import type { ProductFormValues } from "./product-values";

/**
 * The layers a product will grow, shown where they will live but not working yet
 * (docs/plans/products.md). Each becomes a real section when it is built.
 */
const COMING_SOON = [
  ["Photo", "A picture, so you can spot it in lists and show it on your quotes."],
  ["Variations and extras", "Choices like size or flavour, and optional add-ons, each with its own price."],
  ["Costs and margin", "What it costs to make (materials, your time, other costs), so you can see your profit."],
  ["Quantity prices", "Lower prices when someone orders more."],
  ["Production steps", "The steps to make it, so you can track each job."],
  ["Stock", "How many you have ready to sell."],
] as const;

const initialState: ProductSaveState = { status: "idle" };
type Action = (previous: ProductSaveState, formData: FormData) => Promise<ProductSaveState>;

/** Add or edit a product. The basics work; the later layers are shown as "coming soon". */
export function ProductForm({
  action,
  initial,
  mode,
  priceLabel,
  idPrefix = "",
}: {
  action: Action;
  initial: ProductFormValues;
  mode: "add" | "edit";
  /** "Price (including VAT)" and so on, from the business's VAT setting. */
  priceLabel: string;
  /** In front of every field id, for when the form shares a page with other fields. */
  idPrefix?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [, startTransition] = useTransition();
  const [values, setValues] = useState<ProductFormValues>(initial);
  const [editedSinceSave, setEditedSinceSave] = useState(false);
  const fid = (key: string) => `${idPrefix}${key}`;
  const errors: ProductFieldErrors = state.status === "error" ? (state.errors ?? {}) : {};

  const problems: FormProblem[] = (
    [
      ["name", "Name"],
      ["kind", "Product or service"],
      ["unitPrice", priceLabel],
      ["description", "Description"],
    ] as const
  ).flatMap(([field, label]) => {
    const message = errors[field];
    return message ? [{ fieldId: fid(field === "kind" ? "kind-product" : field), label, message }] : [];
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
        <RadioGroup
          name="kind"
          aria-label="Product or service"
          value={values.kind}
          onValueChange={(v) => set("kind")(v as ProductKind)}
        >
          {(
            [
              ["product", "A product (something you make)"],
              ["service", "A service (your time or work)"],
            ] as const
          ).map(([kind, label]) => (
            <Field key={kind} orientation="horizontal" className="min-h-11 items-center">
              <RadioGroupItem id={fid(`kind-${kind}`)} value={kind} />
              <FieldLabel htmlFor={fid(`kind-${kind}`)} className="text-base">
                {label}
              </FieldLabel>
            </Field>
          ))}
        </RadioGroup>
        <TextField
          id={fid("unitPrice")}
          name="unitPrice"
          label={priceLabel}
          inputMode="decimal"
          autoComplete="off"
          value={values.unitPrice}
          error={errors.unitPrice}
          onChange={set("unitPrice")}
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

      {COMING_SOON.map(([title, description]) => (
        <ComingSoonSection key={title} title={title} description={description} />
      ))}

      {state.status === "error" && state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <FormSummary problems={problems} trigger={state} />
      {state.status === "saved" && !pending && !editedSinceSave && (
        <p role="status" className="text-sm font-medium">
          Saved.
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Add product"}
        </Button>
        {mode === "add" && (
          <Link
            href="/app/products"
            className={buttonVariants({ variant: "outline", className: "w-full sm:w-auto" })}
          >
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
