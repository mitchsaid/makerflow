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
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { ProductFieldErrors, ProductKind, ProductSummary } from "@/lib/products";
import { carryPrice } from "@/lib/products/variations";
import Link from "next/link";
import type { ProductSaveState } from "./actions";
import type { VatChoice } from "@/lib/quotes/vat-choices";
import { newVariationKey, PricedVariations } from "./variations-section";
import { ListsSection } from "./lists-section";
import { ExtrasSection } from "./extras-section";
import { KIND_WORDS, listHref, type ProductFormValues } from "./product-values";

/**
 * The layers a product will grow, shown where they will live but not working yet
 * (docs/plans/products.md). Each becomes a real section when it is built.
 */
const COMING_SOON: Record<ProductKind, readonly (readonly [string, string])[]> = {
  product: [
    ["Costs and margin", "What it costs to make (materials, your time, other costs), so you can see your profit."],
    ["Quantity prices", "Lower prices when someone orders more."],
    ["Production steps", "The steps to make it, so you can track each job."],
    ["Stock", "How many you have ready to sell."],
  ],
  // Services (founder, 2026-10-03): no photo or stock; costs are mostly your time.
  service: [
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
  const [sentOptions, setSentOptions] = useState<{ key: string; values: string[] }[]>([]);
  const [sentExtras, setSentExtras] = useState(0);
  // The sizes put aside when the maker goes back to one price, so changing their mind loses nothing typed.
  const [aside, setAside] = useState<{ label: string; rows: ProductFormValues["variations"]; priceBySize: string[] } | null>(null);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.status === "saved" || state.status === "created") {
      const saved = state.product.variations;
      const idOf = new Map(saved.length === sentKeys.length ? sentKeys.map((key, i) => [key, saved[i].id]) : []);
      // Options and their values too, by their place in what was sent.
      const groupIdOf = new Map<string, string>();
      const valueIdOf = new Map<string, string>();
      const savedOptions = state.product.options;
      if (savedOptions.length === sentOptions.length) {
        sentOptions.forEach((sent, i) => {
          groupIdOf.set(sent.key, savedOptions[i].id);
          if (savedOptions[i].values.length === sent.values.length) sent.values.forEach((key, j) => valueIdOf.set(key, savedOptions[i].values[j].id));
        });
      }
      // Extras by their place too: a new one gets its id, a shared one turned "this product only" may be a copy,
      // and how many products have a shared one is as saved.
      const savedExtras = state.product.extras;
      setAside(null);
      setValues((v) => ({
        ...v,
        extras:
          savedExtras.length === sentExtras && v.extras.length === sentExtras
            ? v.extras.map((r, i) => ({ ...r, id: savedExtras[i].id, shared: savedExtras[i].shared, usedOn: savedExtras[i].usedOn, edited: false }))
            : v.extras,
        variations: v.variations.map((r) => (r.id ? r : { ...r, id: idOf.get(r.key) ?? "" })),
        options: v.options.map((g) => ({
          ...g,
          id: g.id || (groupIdOf.get(g.key) ?? ""),
          values: g.values.map((x) => (x.id ? x : { ...x, id: valueIdOf.get(x.key) ?? "" })),
        })),
      }));
    }
  }
  const [editedSinceSave, setEditedSinceSave] = useState(false);
  const fid = (key: string) => `${idPrefix}${key}`;
  const errors: ProductFieldErrors = state.status === "error" ? (state.errors ?? {}) : {};
  // The variations that have a name: lists and extras that depend on them show one price for each.
  const namedVariations = values.variations.filter((r) => r.name.trim() !== "").map((r) => ({ key: r.key, name: r.name.trim() }));

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
    // With variations that have their own prices the single price field is not on the screen.
    if (field === "unitPrice" && values.variations.length > 0) return [];
    return message ? [{ fieldId: fid(field), label, message }] : [];
  });
  // The variations' problems, in the order they appear on the screen.
  const variationWord = values.variationLabel.trim() || "Variation";
  if (values.variations.length > 0 && errors.variations?.label) problems.push({ fieldId: fid("variationLabel"), label: "What you call them", message: errors.variations.label });
  values.variations.forEach((row, i) => {
    const e = errors.variations?.rows[row.key];
    if (e?.name) problems.push({ fieldId: fid(`variation-${row.key}-name`), label: `${variationWord} ${i + 1}`, message: e.name });
    if (e?.price) problems.push({ fieldId: fid(`variation-${row.key}-price`), label: `${variationWord} ${i + 1} price`, message: e.price });
  });
  if (values.variations.length > 0 && errors.variations?.list) problems.push({ fieldId: fid("variations"), label: "Variations", message: errors.variations.list });
  values.options.forEach((g, gi) => {
    const e = errors.options?.groups[g.key];
    if (!e) return;
    const title = g.name.trim() || `Variation ${gi + 1}`;
    if (e.name) problems.push({ fieldId: fid(`option-${g.key}-name`), label: `${title}: name`, message: e.name });
    if (e.values) problems.push({ fieldId: fid(`option-${g.key}-add-value`), label: title, message: e.values });
    g.values.forEach((v, vi) => {
      const ve = e.rows[v.key];
      if (ve?.name) problems.push({ fieldId: fid(`option-${g.key}-value-${v.key}-name`), label: `${title}: choice ${vi + 1}`, message: ve.name });
      if (ve?.price) problems.push({ fieldId: fid(`option-${g.key}-value-${v.key}-price`), label: `${title}: choice ${vi + 1} price`, message: ve.price });
      for (const [vk, message] of values.variations.length > 0 ? Object.entries(ve?.prices ?? {}) : []) {
        const variationName = values.variations.find((r) => r.key === vk)?.name.trim() ?? "";
        problems.push({ fieldId: fid(`option-${g.key}-value-${v.key}-price-${vk}`), label: `${title}: choice ${vi + 1} for ${variationName}`, message });
      }
    });
  });
  if (errors.options?.list) problems.push({ fieldId: fid("options-error"), label: "Variations", message: errors.options.list });
  // The extras' problems, in the order they appear.
  values.extras.forEach((x, xi) => {
    const e = errors.extras?.rows[x.key];
    if (!e) return;
    const title = x.name.trim() || `Extra ${xi + 1}`;
    if (e.name) problems.push({ fieldId: fid(`extra-${x.key}-name`), label: `${title}: name`, message: e.name });
    if (e.price) problems.push({ fieldId: fid(`extra-${x.key}-price`), label: `${title}: price`, message: e.price });
    if (e.textMax) problems.push({ fieldId: fid(`extra-${x.key}-textMax`), label: `${title}: longest`, message: e.textMax });
    for (const [vk, message] of values.variations.length > 0 ? Object.entries(e.prices ?? {}) : []) {
      const variationName = values.variations.find((r) => r.key === vk)?.name.trim() ?? "";
      problems.push({ fieldId: fid(`extra-${x.key}-price-${vk}`), label: `${title} for ${variationName}`, message });
    }
  });
  if (errors.extras?.list) problems.push({ fieldId: fid("extras-error"), label: "Extras", message: errors.extras.list });

  // How it is priced is one question, asked before the price: one price, or a price for each size or version. The
  // answer decides which of the two the form shows (a product has one or the other).
  const priced = values.variations.length > 0;
  // The price moves into the first row when sizes start, and back when the last one goes.
  function changeVariations(change: { label?: string; rows?: ProductFormValues["variations"] }) {
    setEditedSinceSave(true);
    setValues((v) => ({
      ...v,
      ...(change.label !== undefined ? { variationLabel: change.label } : {}),
      ...(change.rows !== undefined
        ? (() => {
            const carried = carryPrice({ unitPrice: v.unitPrice, rows: v.variations }, change.rows);
            return {
              variations: carried.rows,
              unitPrice: carried.unitPrice,
              // With no sizes left there is nothing for a price to depend on (and no stale prices to come back).
              ...(carried.rows.length === 0
                ? {
                    options: v.options.map((g) => ({ ...g, priceByVariation: false })),
                    extras: v.extras.map((x) => ({ ...x, priceByVariation: false })),
                  }
                : {}),
            };
          })()
        : {}),
    }));
  }
  const focusOnePrice = useRef(false);
  useEffect(() => {
    if (!focusOnePrice.current) return;
    focusOnePrice.current = false;
    document.getElementById(fid("pricing-one"))?.closest('[data-slot="field"]')?.querySelector<HTMLElement>('[role="radio"]')?.focus();
  });
  function choosePricing(each: boolean) {
    if (each === priced) return;
    if (each) {
      // Two rows to start, named from the business type's suggestions, or the ones put aside.
      const rows = aside?.rows ?? [
        { key: newVariationKey(), id: "", name: "", price: "", usual: false },
        { key: newVariationKey(), id: "", name: "", price: "", usual: false },
      ];
      changeVariations({ label: aside?.label || values.variationLabel || variationSuggestions[0] || "Size", rows });
      // What was typed in the price field meanwhile is the first size's price; "price depends on the size" comes back too.
      const back = new Set(aside?.priceBySize ?? []);
      setValues((v) => ({
        ...v,
        variations: aside && v.unitPrice.trim() !== "" ? v.variations.map((r, i) => (i === 0 ? { ...r, price: v.unitPrice } : r)) : v.variations,
        options: v.options.map((g) => (back.has(g.key) ? { ...g, priceByVariation: true } : g)),
        extras: v.extras.map((x) => (back.has(x.key) ? { ...x, priceByVariation: true } : x)),
      }));
      setAside(null);
    } else {
      setAside({
        label: values.variationLabel,
        rows: values.variations,
        priceBySize: [...values.options, ...values.extras].filter((x) => x.priceByVariation).map((x) => x.key),
      });
      changeVariations({ rows: [] });
    }
  }

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
    setSentOptions(values.options.map((g) => ({ key: g.key, values: g.values.map((x) => x.key) })));
    setSentExtras(values.extras.length);
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
        {/* Services have no photo (founder, 2026-10-03). */}
        {values.kind === "product" && (
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
        )}
      </Section>

      <Section title="Price">
        <FieldSet>
          <FieldLegend variant="label" className="text-base">
            How is it priced?
          </FieldLegend>
          <RadioGroup value={priced ? "each" : "one"} onValueChange={(v) => choosePricing(v === "each")} className="gap-2">
            {(
              [
                ["one", "One price", "The same whatever they choose."],
                ["each", "A price for each size or version", `Like Small ${currencySymbol}300, Large ${currencySymbol}600.`],
              ] as const
            ).map(([value, title, description]) => (
              <Field
                key={value}
                orientation="horizontal"
                className="items-center rounded-xl border border-border px-3 py-2.5 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
              >
                <RadioGroupItem id={fid(value === "one" ? "pricing-one" : "pricing-each")} value={value} />
                <FieldLabel htmlFor={fid(value === "one" ? "pricing-one" : "pricing-each")} className="flex w-full flex-col items-start gap-0.5 text-base">
                  <span>{title}</span>
                  <span className="text-sm font-normal text-muted-foreground">{description}</span>
                </FieldLabel>
              </Field>
            ))}
          </RadioGroup>
        </FieldSet>
        {priced ? (
          <PricedVariations
            label={values.variationLabel}
            rows={values.variations}
            suggestions={variationSuggestions}
            errors={errors.variations}
            priceLabel={priceLabel}
            currencySymbol={currencySymbol}
            fid={fid}
            onChange={(change) => {
              // The last size removed takes the sizes away: focus goes to the answer that is left.
              if (change.rows?.length === 0) focusOnePrice.current = true;
              changeVariations(change);
            }}
          />
        ) : (
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
      </Section>

      <ListsSection
        variations={namedVariations}
        variationWord={values.variationLabel.trim() || "variation"}
        groups={values.options}
        errors={errors.options}
        currencySymbol={currencySymbol}
        fid={fid}
        onChange={(options) => {
          setEditedSinceSave(true);
          setValues((v) => ({ ...v, options }));
        }}
      />
      <ExtrasSection
        rows={values.extras}
        errors={errors.extras}
        variations={namedVariations}
        variationWord={values.variationLabel.trim() || "variation"}
        priceLabel={priceLabel}
        currencySymbol={currencySymbol}
        fid={fid}
        onChange={(extras) => {
          setEditedSinceSave(true);
          setValues((v) => ({ ...v, extras }));
        }}
      />
      {/* Sent as one field each: the rows as lists, read and checked by the server. */}
      <input type="hidden" name="options" value={JSON.stringify(values.options)} />
      <input type="hidden" name="extras" value={JSON.stringify(values.extras)} />
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
