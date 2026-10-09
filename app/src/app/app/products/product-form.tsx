"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ComingSoonSection } from "@/components/coming-soon";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { UnitField } from "@/components/unit-field";
import { Section, SelectField, TextAreaField, TextField } from "@/components/form-fields";
import type { VatStatus } from "@/lib/money";
import { ImageField } from "@/components/image-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ProductFieldErrors, ProductKind, ProductSummary } from "@/lib/products";
import Link from "next/link";
import type { ProductSaveState } from "./actions";
import type { VatChoice } from "@/lib/quotes/vat-choices";
import { VariationsSection } from "./variations-section";
import { KIND_WORDS, listHref, type ProductFormValues } from "./product-values";

/**
 * The layers a product will grow, shown where they will live but not working yet
 * (docs/plans/products.md). Each becomes a real section when it is built.
 */
const COMING_SOON: Record<ProductKind, readonly (readonly [string, string])[]> = {
  product: [
    ["Options and extras", "Choices like flavour, add-ons like gold leaf or a gift box, and text like a message on the cake."],
    ["Costs and margin", "What it costs to make (materials, your time, other costs), so you can see your profit."],
    ["Quantity prices", "Lower prices when someone orders more."],
    ["Production steps", "The steps to make it, so you can track each job."],
    ["Stock", "How many you have ready to sell."],
  ],
  // Services (founder, 2026-10-03): no photo or stock; costs are mostly your time.
  service: [
    ["Options and extras", "Options like a rush job or working on site, each with its own price."],
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
  vatChoices,
  variationSuggestions,
  currencySymbol,
  idPrefix = "",
  embedded,
}: {
  action: Action;
  initial: ProductFormValues;
  mode: "add" | "edit";
  /** "Price (including VAT)" and so on, from the business's VAT setting. */
  priceLabel: string;
  /** How VAT can treat it, in the country's words; null when the business is not VAT registered (no choice shown). */
  vatChoices: VatChoice[] | null;
  /** Names to suggest for the variations list ("Size", "Tiers"), by the business type. */
  variationSuggestions: string[];
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
  // A photo is on its way (chosen, not finished uploading). Saving now would leave it out.
  const [uploading, setUploading] = useState(false);
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    // A sheet over a quote must not close while either the save or a photo is on its way.
    embeddedRef.current?.onPendingChange(pending || uploading);
  }, [pending, uploading]);
  const [, startTransition] = useTransition();
  const [values, setValues] = useState<ProductFormValues>(initial);
  // After a save, new variations take the ids the database gave them, so saving again keeps them (and the
  // quote items that point at them) instead of replacing them.
  // The rows as they were sent, in order: the saved product lists its variations in the same order.
  const [sentKeys, setSentKeys] = useState<string[]>([]);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.status === "saved" || state.status === "created") {
      const saved = state.product.variations;
      const idOf = new Map(saved.length === sentKeys.length ? sentKeys.map((key, i) => [key, saved[i].id]) : []);
      setValues((v) => ({ ...v, variations: v.variations.map((r) => (r.id ? r : { ...r, id: idOf.get(r.key) ?? "" })) }));
    }
  }
  const [editedSinceSave, setEditedSinceSave] = useState(false);
  const fid = (key: string) => `${idPrefix}${key}`;
  const errors: ProductFieldErrors = state.status === "error" ? (state.errors ?? {}) : {};

  const problems: FormProblem[] = (
    [
      ["name", "Name"],
      ["unitPrice", priceLabel],
      ["unit", "Unit"],
      ["vatStatus", "VAT"],
      ["description", "Description"],
      ["photo", "Photo"],
    ] as const
  ).flatMap(([field, label]) => {
    const message = errors[field];
    return message ? [{ fieldId: fid(field), label, message }] : [];
  });
  // The variations' problems, in the order they appear on the screen.
  const variationWord = values.variationLabel.trim() || "Variation";
  if (errors.variations?.label) problems.push({ fieldId: fid("variationLabel"), label: "What you call them", message: errors.variations.label });
  values.variations.forEach((row, i) => {
    const e = errors.variations?.rows[row.key];
    if (e?.name) problems.push({ fieldId: fid(`variation-${row.key}-name`), label: `${variationWord} ${i + 1}`, message: e.name });
    if (e?.price) problems.push({ fieldId: fid(`variation-${row.key}-price`), label: `${variationWord} ${i + 1} price`, message: e.price });
  });
  if (errors.variations?.list) problems.push({ fieldId: fid("variations"), label: "Variations", message: errors.variations.list });

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
    if (uploading) {
      setWaiting(true);
      return;
    }
    const formData = new FormData(event.currentTarget);
    setSentKeys(values.variations.map((r) => r.key));
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
        {/* With variations each has its own price (below), so the single price goes. */}
        {values.variations.length === 0 ? (
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
        ) : (
          <p className="text-base text-muted-foreground" data-testid="price-by-variation">
            Each {values.variationLabel.trim().toLowerCase() || "variation"} has its own price, below.
          </p>
        )}
        <UnitField
          id={fid("unit")}
          name="unit"
          value={values.unit}
          error={errors.unit}
          onChange={set("unit")}
          hint="What one is, like kg, dozen or hour. The price above is per unit. Leave it empty for a plain count."
        />
        {vatChoices && (
          <SelectField
            id={fid("vatStatus")}
            name="vatStatus"
            label="VAT on this"
            value={values.vatStatus === "standard" ? "" : values.vatStatus}
            onChange={(status) => set("vatStatus")(status === "" ? "standard" : (status as VatStatus))}
            placeholder={vatChoices.find((c) => c.value === "standard")?.label ?? "Standard-rated"}
            options={vatChoices.filter((c) => c.value !== "standard").map((c) => c.value)}
            optionLabels={Object.fromEntries(vatChoices.map((c) => [c.value, c.label]))}
            hint={`${vatChoices.find((c) => c.value === values.vatStatus)?.hint ?? ""} A quote item starts with this, and can be changed on the quote.`}
            error={errors.vatStatus}
          />
        )}
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

      {/* Services have no photo (founder, 2026-10-03). */}
      {values.kind === "product" && (
        <Section title="Photo">
          <ImageField
            id={fid("photo")}
            name="photoImageId"
            label="Photo (optional)"
            kind="product"
            value={values.photoImageId}
            alt={values.name ? `Photo of ${values.name}` : "Photo of this product"}
            hint="Shown small beside the item on your quotes. It is cropped square, so keep the product in the middle."
            error={errors.photo ?? (waiting && uploading ? "Wait for the photo to finish uploading, then save." : undefined)}
            onChange={(photoImageId) => set("photoImageId")(photoImageId)}
            onPendingChange={(busy) => {
              setUploading(busy);
              if (!busy) setWaiting(false);
            }}
          />
        </Section>
      )}

      <VariationsSection
        label={values.variationLabel}
        rows={values.variations}
        suggestions={variationSuggestions}
        errors={errors.variations}
        priceLabel={priceLabel}
        currencySymbol={currencySymbol}
        fid={fid}
        onChange={(change) => {
          setEditedSinceSave(true);
          setValues((v) => ({
            ...v,
            ...(change.label !== undefined ? { variationLabel: change.label } : {}),
            ...(change.rows !== undefined ? { variations: change.rows } : {}),
          }));
        }}
      />
      {/* Sent as one field: the rows as a list, read and checked by the server. */}
      <input type="hidden" name="variationLabel" value={values.variationLabel} />
      <input type="hidden" name="variations" value={JSON.stringify(values.variations)} />

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
