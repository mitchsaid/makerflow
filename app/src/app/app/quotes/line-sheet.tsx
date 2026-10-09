"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ComingSoonSection } from "@/components/coming-soon";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { Section, SelectField, TextAreaField, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  currencySymbol,
  formatMoney,
  moneyToInput,
  parseMoney,
  type NumberStyle,
} from "@/lib/money";
import { UnitField } from "@/components/unit-field";
import { productMatchesSearch, type ProductKind, type ProductSummary } from "@/lib/products";
import type { VatStatus } from "@/lib/money";
import type { VatChoice } from "@/lib/quotes/vat-choices";
import type { BusinessType } from "@/lib/business-types";
import { variationSuggestions } from "@/lib/products/variations";
import { VariationChoice } from "./variation-choice";
import { parseLine, type DiscountKind, type LineErrors, type LineFormValues } from "@/lib/quotes";
import { createProductInQuote, updateProduct } from "../products/actions";
import { ProductForm } from "../products/product-form";
import { emptyOfKind, KIND_WORDS, valuesFromProduct } from "../products/product-values";

/**
 * Where the item sheet is: choosing what to add, configuring one line, or the product form
 * (adding a new product, or editing the one a line came from). One sheet whose content moves
 * on, like pages, so a phone never stacks sheets on sheets.
 */
export type LineSheetView =
  | { kind: "pick" }
  | { kind: "configure"; line: LineFormValues; isNew: boolean }
  | {
      kind: "product";
      mode: "add" | "edit";
      /** For "add": a product or a service ("Add new product" / "Add new service"). */
      productKind?: ProductKind;
      product?: ProductSummary;
      /** The line being configured, to go back to after editing its product. */
      returnTo?: { line: LineFormValues; isNew: boolean };
    };

const SEARCH_LIMIT = 30;

export function lineFromProduct(product: ProductSummary, key: string, style: NumberStyle): LineFormValues {
  // A product with variations starts with its usual one, or none (then one must be chosen, and the price
  // comes with it).
  const usual = product.variations.find((v) => v.usual);
  const hasVariations = product.variations.length > 0;
  return {
    key,
    kind: product.kind,
    productId: product.id,
    name: product.name,
    description: product.description ?? "",
    quantity: "1",
    unit: product.unit ?? "",
    unitPrice: hasVariations ? (usual ? moneyToInput(usual.priceCents, style) : "") : moneyToInput(product.unitPriceCents, style),
    discountKind: "none",
    discountValue: "",
    // The product's usual treatment (the item keeps its own copy and can be changed).
    vatStatus: product.vatStatus,
    variationId: usual?.id ?? "",
    variationLabel: usual ? (product.variationLabel ?? "") : "",
    variationName: usual?.name ?? "",
  };
}

export function LineSheet({
  open,
  view,
  products,
  numberStyle,
  currencyCode,
  priceLabel,
  vatChoices,
  businessTypes,
  newKey,
  onView,
  onClose,
  onSaveLine,
  onRemoveLine,
  onProductSaved,
  focusOnClose,
}: {
  open: boolean;
  view: LineSheetView | null;
  products: ProductSummary[];
  numberStyle: NumberStyle;
  currencyCode: string;
  /** "Price (including VAT)" and so on. */
  priceLabel: string;
  /** How VAT can treat an item, in the country's words; null when the business is not VAT registered. */
  vatChoices: VatChoice[] | null;
  /** What the business makes, to suggest names for a new product's variations. */
  businessTypes: BusinessType[] | null;
  /** A fresh key for a line that is about to be added. */
  newKey: () => string;
  onView: (view: LineSheetView) => void;
  onClose: () => void;
  onSaveLine: (line: LineFormValues, isNew: boolean) => void;
  /** Takes an existing line off the quote (from its edit view). */
  onRemoveLine: (key: string) => void;
  onProductSaved: (product: ProductSummary) => void;
  /** The id of the element to focus once the sheet has closed (default: what opened it). */
  focusOnClose: () => string | null;
}) {
  // A product save is on its way: closing now would lose it.
  const [saving, setSaving] = useState(false);
  const money = (cents: number) => formatMoney(cents, currencyCode, numberStyle);
  const symbol = currencySymbol(currencyCode, numberStyle);

  const title =
    view?.kind === "pick"
      ? "Add an item"
      : view?.kind === "configure"
        ? view.isNew
          ? view.line.productId
            ? `Add ${view.line.name}`
            : "One-off item"
          : "Edit item"
        : view?.kind === "product"
          ? view.mode === "add"
            ? `Add a ${KIND_WORDS[view.productKind ?? "product"].one}`
            : `Edit ${KIND_WORDS[view.product?.kind ?? "product"].one}`
          : "";
  const description =
    view?.kind === "pick"
      ? "Choose one of your products or services, add a new one, or type a one-off item."
      : view?.kind === "configure"
        ? "Set the quantity and price for this quote. Your quote is kept as it is."
        : view?.kind === "product" && view.mode === "edit"
          ? `Changes are saved to the ${KIND_WORDS[view.product?.kind ?? "product"].one}. Lines already on quotes keep their own price.`
          : "A name and a price are enough to start. Your quote is kept as it is.";

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && !saving && onClose()}>
      <SheetContent
        side="right"
        className="h-dvh gap-0 overflow-y-auto"
        finalFocus={() => {
          const id = focusOnClose();
          return (id && document.getElementById(id)) || true;
        }}
      >
        <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover pr-14">
          <SheetTitle className="text-lg">{title}</SheetTitle>
          <SheetDescription className="text-base">{description}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pt-4">
          {view?.kind === "pick" && (
            <PickView
              products={products}
              money={money}
              onChoose={(p) => onView({ kind: "configure", line: lineFromProduct(p, newKey(), numberStyle), isNew: true })}
              onAdd={(productKind) => onView({ kind: "product", mode: "add", productKind })}
              onOneOff={() =>
                onView({
                  kind: "configure",
                  isNew: true,
                  line: {
                    key: newKey(),
                    kind: "custom",
                    productId: "",
                    name: "",
                    description: "",
                    quantity: "1",
                    unit: "",
                    unitPrice: "",
                    discountKind: "none",
                    discountValue: "",
                    vatStatus: "standard",
                  },
                })
              }
            />
          )}
          {view?.kind === "configure" && (
            <ConfigureView
              key={view.line.key}
              line={view.line}
              isNew={view.isNew}
              product={products.find((p) => p.id === view.line.productId)}
              priceLabel={priceLabel}
              vatChoices={vatChoices}
              currencySymbol={symbol}
              numberStyle={numberStyle}
              money={money}
              onSave={(line) => onSaveLine(line, view.isNew)}
              onRemove={view.isNew ? undefined : () => onRemoveLine(view.line.key)}
              onBack={view.isNew ? () => onView({ kind: "pick" }) : onClose}
              onEditProduct={(product, line) =>
                onView({ kind: "product", mode: "edit", product, returnTo: { line, isNew: view.isNew } })
              }
            />
          )}
          {view?.kind === "product" && (
            <ProductForm
              key={view.product?.id ?? "add"}
              mode={view.mode}
              action={view.mode === "add" ? createProductInQuote : updateProduct.bind(null, view.product!.id)}
              initial={view.product ? valuesFromProduct(view.product, numberStyle) : emptyOfKind(view.productKind ?? "product")}
              priceLabel={priceLabel}
              vatChoices={vatChoices}
              variationSuggestions={variationSuggestions(businessTypes, view.product?.kind ?? view.productKind ?? "product")}
              currencySymbol={symbol}
              idPrefix="product-sheet-"
              embedded={{
                onPendingChange: setSaving,
                onCancel: () =>
                  view.returnTo
                    ? onView({ kind: "configure", ...view.returnTo })
                    : onView({ kind: "pick" }),
                onDone: (product) => {
                  onProductSaved(product);
                  if (view.mode === "add") {
                    // Straight on to configuring it for this quote.
                    onView({ kind: "configure", line: lineFromProduct(product, newKey(), numberStyle), isNew: true });
                  } else if (view.returnTo) {
                    const { line, isNew } = view.returnTo;
                    onView({
                      kind: "configure",
                      isNew,
                      // A line not yet on the quote takes the product's changes for everything
                      // still as the product had it; a line already on the quote keeps its own
                      // copy and is offered the changes instead.
                      line: isNew && view.product ? followProduct(line, view.product, product, numberStyle) : line,
                    });
                  } else {
                    onView({ kind: "pick" });
                  }
                },
              }}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** The fields of a new line that still match the product before it was edited take its new values. */
function followProduct(
  line: LineFormValues,
  before: ProductSummary,
  after: ProductSummary,
  style: NumberStyle,
): LineFormValues {
  return {
    ...line,
    kind: after.kind,
    name: line.name === before.name ? after.name : line.name,
    description: line.description === (before.description ?? "") ? (after.description ?? "") : line.description,
    unit: line.unit === (before.unit ?? "") ? (after.unit ?? "") : line.unit,
    unitPrice:
      line.unitPrice === moneyToInput(before.unitPriceCents, style)
        ? moneyToInput(after.unitPriceCents, style)
        : line.unitPrice,
    vatStatus: line.vatStatus === before.vatStatus ? after.vatStatus : line.vatStatus,
    ...followVariation(line, before, after, style),
  };
}

/** The chosen variation after its product was edited: renamed, repriced or removed. */
function followVariation(line: LineFormValues, before: ProductSummary, after: ProductSummary, style: NumberStyle): Partial<LineFormValues> {
  // Variations were just added to the product: start as a new item from it would (the usual one and its
  // price, or nothing chosen and no price yet), unless the price was changed by hand.
  if (!line.variationId && after.variations.length > 0 && before.variations.length === 0) {
    const fresh = lineFromProduct(after, line.key, style);
    const priceUntouched = line.unitPrice === moneyToInput(before.unitPriceCents, style);
    return {
      variationId: fresh.variationId,
      variationLabel: fresh.variationLabel,
      variationName: fresh.variationName,
      ...(priceUntouched ? { unitPrice: fresh.unitPrice } : {}),
    };
  }
  if (!line.variationId) return {};
  const was = before.variations.find((v) => v.id === line.variationId);
  const now = after.variations.find((v) => v.id === line.variationId);
  if (!now) return { variationId: "", variationLabel: "", variationName: "" };
  return {
    variationLabel: after.variationLabel ?? line.variationLabel,
    variationName: now.name,
    ...(was && line.unitPrice === moneyToInput(was.priceCents, style) ? { unitPrice: moneyToInput(now.priceCents, style) } : {}),
  };
}

function PickView({
  products,
  money,
  onChoose,
  onAdd,
  onOneOff,
}: {
  products: ProductSummary[];
  money: (cents: number) => string;
  onChoose: (product: ProductSummary) => void;
  onAdd: (kind: ProductKind) => void;
  onOneOff: () => void;
}) {
  const [query, setQuery] = useState("");
  const active = products.filter((p) => !p.archived);
  const matching = active.filter((p) => productMatchesSearch(p, query));
  const groups = (["product", "service"] as const)
    .map((kind) => ({ kind, items: matching.filter((p) => p.kind === kind).slice(0, SEARCH_LIMIT) }))
    .filter((g) => active.some((p) => p.kind === g.kind));

  return (
    <div className="space-y-4 pb-8">
      {active.length > 0 && (
        <Field>
          <FieldLabel htmlFor="item-search">Search your products and services</FieldLabel>
          <Input
            id="item-search"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Field>
      )}
      {groups.map((group) => (
        <section key={group.kind} className="space-y-2" aria-labelledby={`item-group-${group.kind}`}>
          <h3 id={`item-group-${group.kind}`} className="text-sm font-medium text-muted-foreground">
            {group.kind === "service" ? "Services" : "Products"}
          </h3>
          {group.items.length === 0 ? (
            <p className="text-muted-foreground">Nothing matches &ldquo;{query}&rdquo;.</p>
          ) : (
            <ul className="space-y-2">
              {group.items.map((p) => (
                <li key={p.id}>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto min-h-14 w-full flex-col items-stretch gap-0.5 px-4 py-2 text-left whitespace-normal"
                    onClick={() => onChoose(p)}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{p.name}</span>
                      <span className="shrink-0">
                        {p.variations.length > 0 ? "from " : ""}{money(p.unitPriceCents)}
                        {p.unit ? ` / ${p.unit}` : ""}
                      </span>
                    </span>
                    {p.description && (
                      <span className="truncate text-sm font-normal text-muted-foreground">{p.description}</span>
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      {active.length === 0 && (
        <p className="text-muted-foreground">
          Nothing saved yet. Add a product or a service to reuse it on every quote, or type a
          one-off item.
        </p>
      )}
      <div className="flex flex-col gap-3">
        <Button type="button" onClick={() => onAdd("product")}>
          Add new product
        </Button>
        <Button type="button" variant="outline" onClick={() => onAdd("service")}>
          Add new service
        </Button>
        <Button type="button" variant="outline" onClick={onOneOff}>
          One-off item (just for this quote)
        </Button>
      </div>
      <ComingSoonSection
        title="Import from Shopify or a CSV"
        description="Bring in a product list you already have, instead of typing it again."
      />
    </div>
  );
}

function ConfigureView({
  line: initialLine,
  isNew,
  product,
  priceLabel,
  vatChoices,
  currencySymbol: symbol,
  numberStyle,
  money,
  onSave,
  onRemove,
  onBack,
  onEditProduct,
}: {
  line: LineFormValues;
  isNew: boolean;
  product: ProductSummary | undefined;
  priceLabel: string;
  vatChoices: VatChoice[] | null;
  currencySymbol: string;
  numberStyle: NumberStyle;
  money: (cents: number) => string;
  onSave: (line: LineFormValues) => void;
  /** Present when editing a line already on the quote. */
  onRemove?: () => void;
  onBack: () => void;
  onEditProduct: (product: ProductSummary, line: LineFormValues) => void;
}) {
  const [line, setLine] = useState(initialLine);
  const [errors, setErrors] = useState<LineErrors>({});
  // Changes every time Save is pressed, so the summary takes focus each time.
  const [attempt, setAttempt] = useState(0);
  const [, startTransition] = useTransition();
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const removeQuestion = useRef<HTMLDivElement>(null);
  // The question opens at the foot of a long form, beside the sticky Save bar: bring it into view and
  // take focus there (its first button), so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (!confirmingRemove) return;
    removeQuestion.current?.scrollIntoView({ block: "center" });
    removeQuestion.current?.querySelector("button")?.focus({ preventScroll: true });
  }, [confirmingRemove]);
  const id = (field: string) => `line-sheet-${field}`;
  const set = <K extends keyof LineFormValues>(key: K) => (value: LineFormValues[K]) =>
    setLine((l) => ({ ...l, [key]: value }));

  // The product's variations, and the one this item has kept if the product no longer lists it.
  const variations = product?.variations ?? [];
  const word = (product?.variationLabel ?? line.variationLabel ?? "").trim() || "Option";
  const chosen = variations.find((v) => v.id === line.variationId);
  const keptOwn = !chosen && (line.variationName ?? "") !== "";
  const showVariations = variations.length > 0 || keptOwn;
  function chooseVariation(key: string) {
    if (key === "kept") return;
    const next = variations.find((v) => v.id === key);
    if (!next) return;
    setLine((l) => {
      const previous = variations.find((v) => v.id === l.variationId);
      // The price follows the variation, unless it was changed by hand for this quote.
      const follows = l.unitPrice.trim() === "" || (previous !== undefined && l.unitPrice === moneyToInput(previous.priceCents, numberStyle));
      return {
        ...l,
        variationId: next.id,
        variationName: next.name,
        variationLabel: product?.variationLabel ?? l.variationLabel ?? "",
        unitPrice: follows ? moneyToInput(next.priceCents, numberStyle) : l.unitPrice,
      };
    });
  }

  const typedPrice = parseMoney(line.unitPrice);
  // What the product charges for what is chosen (its variation's price when it has variations).
  const referencePrice = variations.length > 0 ? chosen?.priceCents : product?.unitPriceCents;
  const priceDiffers = product !== undefined && referencePrice !== undefined && (!typedPrice.ok || typedPrice.value !== referencePrice);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // This form sits inside the quote's form in the React tree: never save the quote with it.
    event.stopPropagation();
    const result = parseLine(line);
    setAttempt((n) => n + 1);
    // A product with variations needs one chosen (the database cannot know: lines keep their own copy).
    const mustChoose = variations.length > 0 && !line.variationName ? { variation: `Choose a ${word.toLowerCase()}.` } : {};
    if (!result.ok || Object.keys(mustChoose).length > 0) {
      setErrors({ ...(result.ok ? {} : result.errors), ...mustChoose });
      return;
    }
    setErrors({});
    startTransition(() => onSave(line));
  }

  const problems: FormProblem[] = (
    [
      ["name", "Name"],
      ["variation", word],
      ["quantity", "Quantity"],
      ["unit", "Unit"],
      ["unitPrice", priceLabel],
      ["description", "Description"],
      ["discountValue", "Discount"],
    ] as const
  ).flatMap(([field, label]) => {
    const message = errors[field];
    return message ? [{ fieldId: id(field), label, message }] : [];
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Section title={line.productId ? (line.kind === "service" ? "Service" : "Product") : "Item"}>
        {line.productId ? (
          <div className="space-y-2">
            <p className="text-base font-medium" data-testid="configure-name">
              {line.name}
            </p>
            {product && product.name !== line.name && (
              <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="product-name-hint">
                <span className="text-muted-foreground">
                  The {KIND_WORDS[product.kind].one} is now called “{product.name}”.
                </span>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => setLine((l) => ({ ...l, name: product.name, kind: product.kind }))}
                >
                  Use the new name
                </Button>
              </div>
            )}
            {product && (
              <Button type="button" variant="outline" onClick={() => onEditProduct(product, line)}>
                Edit this {KIND_WORDS[product.kind].one}
              </Button>
            )}
          </div>
        ) : (
          <TextField
            id={id("name")}
            label="Name"
            autoComplete="off"
            maxLength={200}
            value={line.name}
            error={errors.name}
            onChange={set("name")}
          />
        )}
        {line.productId && errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        {showVariations && (
          <VariationChoice
            id={id("variation")}
            word={word}
            value={keptOwn ? "kept" : (chosen?.id ?? "")}
            error={errors.variation}
            onChange={(key) => {
              setErrors((e) => ({ ...e, variation: undefined }));
              chooseVariation(key);
            }}
            options={[
              ...variations.map((v) => ({ key: v.id, name: v.name, priceText: money(v.priceCents) })),
              ...(keptOwn
                ? [{ key: "kept", name: line.variationName ?? "", priceText: "", note: `No longer on the ${product ? KIND_WORDS[product.kind].one : "product"}. Kept as it was.` }]
                : []),
            ]}
          />
        )}
        <div className="grid grid-cols-2 gap-3">
          <TextField
            id={id("quantity")}
            label="Quantity"
            inputMode="decimal"
            autoComplete="off"
            value={line.quantity}
            error={errors.quantity}
            onChange={set("quantity")}
          />
          <UnitField id={id("unit")} value={line.unit} error={errors.unit} onChange={set("unit")} />
        </div>
        <TextField
          id={id("unitPrice")}
          label={line.unit.trim() ? `${priceLabel} per ${line.unit.trim()}` : priceLabel}
          startText={symbol}
          inputMode="decimal"
          autoComplete="off"
          value={line.unitPrice}
          error={errors.unitPrice}
          onChange={set("unitPrice")}
        />
        {product && priceDiffers && referencePrice !== undefined && (
          <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="product-price-hint">
            <span className="text-muted-foreground">
              {chosen
                ? `The ${KIND_WORDS[product.kind].one}'s price for ${chosen.name} is ${money(referencePrice)}.`
                : `The ${KIND_WORDS[product.kind].one}'s price is ${money(referencePrice)}.`}
            </span>
            <Button
              type="button"
              variant="link"
              className="h-auto p-0"
              onClick={() => set("unitPrice")(moneyToInput(referencePrice, numberStyle))}
            >
              Use {money(referencePrice)}
            </Button>
          </div>
        )}
        <TextAreaField
          id={id("description")}
          label="Description (optional)"
          hint="Shown on the quote under the name."
          maxLength={1000}
          value={line.description}
          error={errors.description}
          onChange={set("description")}
        />
        <SelectField
          id={id("discountKind")}
          label="Discount on this item"
          value={line.discountKind === "none" ? "" : line.discountKind}
          onChange={(kind) =>
            setLine((l) => ({
              ...l,
              discountKind: (kind === "" ? "none" : kind) as DiscountKind,
              discountValue: kind === "" ? "" : l.discountValue,
            }))
          }
          placeholder="No discount"
          options={["percent", "fixed"]}
          optionLabels={{ percent: "A percentage", fixed: "An amount" }}
        />
        {line.discountKind !== "none" && (
          <TextField
            id={id("discountValue")}
            label={line.discountKind === "percent" ? "Item discount (%)" : "Item discount amount"}
            startText={line.discountKind === "fixed" ? symbol : undefined}
            inputMode="decimal"
            autoComplete="off"
            value={line.discountValue}
            error={errors.discountValue}
            onChange={set("discountValue")}
          />
        )}
        {vatChoices && (
          <SelectField
            id={id("vatStatus")}
            label="VAT on this item"
            value={line.vatStatus && line.vatStatus !== "standard" ? line.vatStatus : ""}
            onChange={(status) => setLine((l) => ({ ...l, vatStatus: (status === "" ? "standard" : status) as VatStatus }))}
            placeholder={vatChoices.find((c) => c.value === "standard")?.label ?? "Standard-rated"}
            options={vatChoices.filter((c) => c.value !== "standard").map((c) => c.value)}
            optionLabels={Object.fromEntries(vatChoices.map((c) => [c.value, c.label]))}
            hint={vatChoices.find((c) => c.value === (line.vatStatus ?? "standard"))?.hint}
          />
        )}
      </Section>

      <ComingSoonSection
        title="Options and extras"
        description="Choose this item's options, like flavour, add-ons like gold leaf or a gift box, and text like a message on the cake."
      />

      <FormSummary problems={problems} trigger={attempt} />

      {onRemove && (
        <section className="space-y-3" aria-label="Remove this item">
          {!confirmingRemove ? (
            <Button id="remove-item" type="button" variant="ghost" className="text-destructive" onClick={() => setConfirmingRemove(true)}>
              Remove this item
            </Button>
          ) : (
            <div ref={removeQuestion} className="space-y-3 rounded-xl border border-destructive/50 p-3 scroll-mb-28" role="alertdialog" aria-label="Remove this item?">
              <p className="text-base">Take {line.name.trim() || "this item"} off the quote?</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="destructive" onClick={onRemove}>
                  Yes, remove it
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setConfirmingRemove(false);
                    // Back to the button that asked.
                    setTimeout(() => document.getElementById("remove-item")?.focus(), 0);
                  }}
                >
                  Keep it
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t border-border bg-popover px-4 py-3 sm:flex-row">
        <Button type="submit" className="w-full sm:w-auto">
          {isNew ? "Add to quote" : "Save item"}
        </Button>
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onBack}>
          {isNew ? "Back" : "Cancel"}
        </Button>
      </div>
    </form>
  );
}
