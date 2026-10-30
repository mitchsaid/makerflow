"use client";

import { withoutEmptyOptionals } from "@/lib/quotes/optional";
import { PrivateTag } from "@/components/private-tag";
import { useEffect, useRef, useState, useTransition } from "react";
import { ComingSoonSection } from "@/components/coming-soon";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { Section, SelectField, TextAreaField, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  formatPercent,
  moneyToInput,
  parseMoney,
  parseQuantity,
  type NumberStyle,
} from "@/lib/money";
import { UnitField } from "@/components/unit-field";
import { PhotoThumb } from "@/components/photo-thumb";
import { productMatchesSearch, type ProductKind, type ProductSummary } from "@/lib/products";
import type { VatSettings, VatStatus } from "@/lib/money";
import { priceForMarginCents, priceToEnterCents } from "@/lib/costing/target";
import type { VatChoice } from "@/lib/quotes/vat-choices";
import type { BusinessType } from "@/lib/business-types";
import { variationSuggestions } from "@/lib/products/variations";
import { VariationChoice } from "./variation-choice";
import { missingOptions, OptionChoices, optionValueAmount, repriceOptions } from "./option-choices";
import { extraAmount } from "@/lib/products/extras";
import { optionsFixed, optionsPerItem, parseLine, type LineOption, type DiscountKind, type LineErrors, type LineFormValues } from "@/lib/quotes";
import { createProductInQuote, updateProduct } from "../products/actions";
import { ProductForm } from "../products/product-form";
import { QuantityField } from "@/components/quantity-field";
import { listPriceOf, priceBreakText, referencePrice } from "@/lib/products/price-breaks";
import { emptyOfKind, KIND_WORDS, valuesFromProduct } from "../products/product-values";
import { AddButton } from "@/components/add-button";
import { ErrorScopeBridge, FormErrorScope, type ErrorScopeHandle } from "@/components/form-errors";

/** What a quote shows of an item, as the quote has it now, and how to change it. */
export type QuoteShows = {
  photos: boolean;
  quantityPrices: boolean;
  onChange: (change: { photos: boolean; quantityPrices: boolean }) => void;
};

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
    unitPrice: hasVariations ? (usual ? moneyToInput(referencePrice(product, usual.id, "1")?.cents ?? usual.priceCents, style) : "") : moneyToInput(referencePrice(product, undefined, "1")?.cents ?? product.unitPriceCents, style),
    discountKind: "none",
    discountValue: "",
    // The product's usual treatment (the item keeps its own copy and can be changed).
    vatStatus: product.vatStatus,
    variationId: usual?.id ?? "",
    variationLabel: usual ? (product.variationLabel ?? "") : "",
    variationName: usual?.name ?? "",
    // Each "choose one" option starts with its usual value, if it has one.
    options: product.options.flatMap((g) => {
      const v = g.kind === "one" ? g.values.find((x) => x.usual) : undefined;
      return v
        ? [{ groupId: g.id, group: g.name, kind: g.kind, valueId: v.id, value: v.name, text: "", amountCents: optionValueAmount(g, v, usual?.id) }]
        : [];
    }),
  };
}

export function LineSheet({
  mode = "quote",
  document: documentWord = "quote",
  open,
  view,
  products,
  numberStyle,
  currencyCode,
  priceLabel,
  vatChoices,
  pricing,
  quoteShows,
  costing,
  businessTypes,
  newKey,
  onView,
  onClose,
  onSaveLine,
  onRemoveLine,
  onProductSaved,
  focusOnClose,
}: {
  /**
   * What the item is for. A "job" item is picked, configured and removed the same way as a quote's, but has no
   * price, discount or VAT: just what to make (the product, its variation and choices, the quantity and details).
   */
  mode?: "quote" | "job";
  /** What the items are on, for the words: a "quote" (the default) or an "invoice". */
  document?: "quote" | "invoice";
  open: boolean;
  view: LineSheetView | null;
  products: ProductSummary[];
  numberStyle: NumberStyle;
  currencyCode: string;
  /** "Price (including VAT)" and so on. */
  priceLabel: string;
  /** How VAT can treat an item, in the country's words; null when the business is not VAT registered. */
  vatChoices: VatChoice[] | null;
  /** The margin the business aims for and how it enters prices, for the "charge R…" hint on a one-off item's cost. */
  pricing?: { targetBp: number | null; vat: VatSettings };
  /**
   * What the quote shows of this item, decided on the item itself (founder, 2026-10-30): the product's photo, and the
   * quantity price that set its price. They are the quote's own settings; the item sheet shows them where they apply and
   * hands the choice back when the item is saved. Absent for a job or an invoice.
   */
  quoteShows?: QuoteShows;
  /** What the product form's Inputs tab needs (materials, the hourly rate), when the page has loaded it. */
  costing?: React.ComponentProps<typeof ProductForm>["costing"];
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
  const job = mode === "job";
  const subject = job ? "job" : documentWord;

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
        ? job
          ? "Set the quantity and details for this job."
          : `Set the quantity and price for this ${subject}.`
        : view?.kind === "product" && view.mode === "edit"
          ? job
            ? `Changes are saved to the ${KIND_WORDS[view.product?.kind ?? "product"].one}.`
            : `Changes are saved to the ${KIND_WORDS[view.product?.kind ?? "product"].one}. Lines already on quotes keep their own price.`
          : job
            ? "A name and a price are enough to start. It is saved to your products and added to this job."
            : "A name and a price are enough to start.";

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
              subject={subject}
              showPrices={!job}
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
              job={job}
              subject={subject}
              product={products.find((p) => p.id === view.line.productId)}
              priceLabel={priceLabel}
              vatChoices={vatChoices}
              pricing={pricing}
              quoteShows={quoteShows}
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
              currencyCode={currencyCode}
              numberStyle={numberStyle}
              idPrefix="product-sheet-"
              costing={costing}
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
  const followed = followVariation(line, before, after, style);
  return {
    ...line,
    kind: after.kind,
    name: line.name === before.name ? after.name : line.name,
    description: line.description === (before.description ?? "") ? (after.description ?? "") : line.description,
    unit: line.unit === (before.unit ?? "") ? (after.unit ?? "") : line.unit,
    unitPrice:
      line.unitPrice === moneyToInput(referencePrice(before, undefined, line.quantity)?.cents ?? before.unitPriceCents, style)
        ? moneyToInput(referencePrice(after, undefined, line.quantity)?.cents ?? after.unitPriceCents, style)
        : line.unitPrice,
    vatStatus: line.vatStatus === before.vatStatus ? after.vatStatus : line.vatStatus,
    ...followed,
    options: followOptions(line.options ?? [], after, followed.variationId ?? line.variationId),
  };
}

/**
 * The choices and extras on a new item after its product was edited: each takes the new words and amount; ones
 * the product no longer offers go; lists with nothing chosen get their usual choice.
 */
function followOptions(chosen: readonly LineOption[], after: ProductSummary, variationId: string | undefined): LineOption[] {
  const next: LineOption[] = [];
  for (const o of chosen) {
    if (o.kind === "one") {
      const g = after.options.find((x) => x.id === o.groupId);
      const v = g?.values.find((x) => x.id === o.valueId);
      if (!g || !v || next.some((x) => x.groupId === g.id)) continue;
      next.push({ ...o, group: g.name, value: v.name, amountCents: optionValueAmount(g, v, variationId) });
      continue;
    }
    const x = after.extras.find((e) => e.id === o.valueId && (o.kind === "text") === e.asksForWording);
    if (!x) continue;
    next.push({ ...o, group: x.asksForWording ? x.name : "Extras", value: x.asksForWording ? "" : x.name, amountCents: extraAmount(x, variationId ?? "") });
  }
  for (const g of after.options) {
    if (next.some((x) => x.groupId === g.id)) continue;
    const usual = g.values.find((x) => x.usual);
    if (usual) next.push({ groupId: g.id, group: g.name, kind: "one", valueId: usual.id, value: usual.name, text: "", amountCents: optionValueAmount(g, usual, variationId) });
  }
  return next;
}

/** The chosen variation after its product was edited: renamed, repriced or removed. */
function followVariation(line: LineFormValues, before: ProductSummary, after: ProductSummary, style: NumberStyle): Partial<LineFormValues> {
  // Variations were just added to the product: start as a new item from it would (the usual one and its
  // price, or nothing chosen and no price yet), unless the price was changed by hand.
  if (!line.variationId && after.variations.length > 0 && before.variations.length === 0) {
    const fresh = lineFromProduct(after, line.key, style);
    const priceUntouched = line.unitPrice === moneyToInput(referencePrice(before, undefined, line.quantity)?.cents ?? before.unitPriceCents, style);
    return {
      variationId: fresh.variationId,
      variationLabel: fresh.variationLabel,
      variationName: fresh.variationName,
      ...(priceUntouched
        ? {
            unitPrice:
              fresh.variationId && after.variations.length > 0
                ? moneyToInput(referencePrice(after, fresh.variationId, line.quantity)?.cents ?? 0, style)
                : fresh.unitPrice,
          }
        : {}),
    };
  }
  if (!line.variationId) return {};
  const was = before.variations.find((v) => v.id === line.variationId);
  const now = after.variations.find((v) => v.id === line.variationId);
  if (!now) return { variationId: "", variationLabel: "", variationName: "" };
  return {
    variationLabel: after.variationLabel ?? line.variationLabel,
    variationName: now.name,
    ...(was && line.unitPrice === moneyToInput(referencePrice(before, was.id, line.quantity)?.cents ?? was.priceCents, style)
      ? { unitPrice: moneyToInput(referencePrice(after, now.id, line.quantity)?.cents ?? now.priceCents, style) }
      : {}),
  };
}

function PickView({
  products,
  money,
  subject,
  showPrices,
  onChoose,
  onAdd,
  onOneOff,
}: {
  products: ProductSummary[];
  money: (cents: number) => string;
  /** "quote" or "job", for the words. */
  subject: string;
  showPrices: boolean;
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
                    <span className="flex items-center gap-3">
                      {/* Only when there is a photo: no empty square for a product without one. */}
                      <PhotoThumb imageId={p.photoImageId} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="font-medium">{p.name}</span>
                          {showPrices ? (
                            <span className="shrink-0">
                              {p.variations.length > 0 ? "from " : ""}{money(p.unitPriceCents)}
                              {p.unit ? ` / ${p.unit}` : ""}
                            </span>
                          ) : (
                            p.unit && <span className="shrink-0 text-muted-foreground">per {p.unit}</span>
                          )}
                        </span>
                        {p.description && (
                          <span className="block truncate text-sm font-normal text-muted-foreground">{p.description}</span>
                        )}
                      </span>
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      {active.length === 0 && (
        <p className="text-muted-foreground">
          Nothing saved yet. Add a product or service, or type a one-off item.
        </p>
      )}
      <div className="flex flex-col gap-3">
        <AddButton variant="default" onClick={() => onAdd("product")}>
          Add new product
        </AddButton>
        <AddButton onClick={() => onAdd("service")}>
          Add new service
        </AddButton>
        <Button type="button" variant="outline" onClick={onOneOff}>
          One-off item (just for this {subject})
        </Button>
      </div>
      <ComingSoonSection
        title="Import from Shopify or a CSV"
        description="Bring in a product list you already have."
      />
    </div>
  );
}

function ConfigureView({
  line: initialLine,
  isNew,
  job,
  subject,
  product,
  priceLabel,
  vatChoices,
  pricing,
  quoteShows,
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
  /** An item for a job: no price, discount or VAT. */
  job: boolean;
  /** "quote", "invoice" or "job", for the words. */
  subject: string;
  product: ProductSummary | undefined;
  priceLabel: string;
  vatChoices: VatChoice[] | null;
  pricing?: { targetBp: number | null; vat: VatSettings };
  quoteShows?: QuoteShows;
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
  // What the quote shows of this item, held here until Save (cancelling leaves the quote as it was).
  const [shows, setShows] = useState({ photos: quoteShows?.photos ?? true, quantityPrices: quoteShows?.quantityPrices ?? false });
  // The line as it stands, for the save below (which works on a tidied copy of it under the same name).
  const lineNow = line;
  const [errors, setErrors] = useState<LineErrors>({});
  // Required options with nothing chosen, by option id (shown after Save is pressed).
  const [optionErrors, setOptionErrors] = useState<Record<string, string>>({});
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
  // A one-off item that says what it costs: what to charge, the way prices are typed, for the margin the business aims for.
  const typedCost = !job && !line.productId && (line.unitCost ?? "").trim() !== "" ? parseMoney(line.unitCost ?? "") : null;
  const targetNet = typedCost?.ok && pricing?.targetBp != null ? priceForMarginCents(typedCost.value, pricing.targetBp) : null;
  const targetPrice =
    targetNet !== null && pricing
      ? priceToEnterCents(targetNet, pricing.vat, vatStatusOf(line.vatStatus ?? ""))
      : null;
  const currentPrice = (() => {
    const typed = parseMoney(line.unitPrice);
    return typed.ok ? typed.value : null;
  })();
  // The error scope is below this component, so it reports up: edits made by buttons (not the shared fields) count too.
  const [scope, setScope] = useState<ErrorScopeHandle | null>(null);
  const set = <K extends keyof LineFormValues>(key: K) => (value: LineFormValues[K]) => {
    scope?.markEdited(id(String(key)));
    setLine((l) => ({ ...l, [key]: value }));
  };

  // The product's lists and extras, and what they add to this item.
  const optionGroups = product?.options ?? [];
  const productExtras = product?.extras ?? [];
  const showOptions = optionGroups.length > 0 || productExtras.length > 0 || (line.options ?? []).length > 0;
  const extrasEach = optionsPerItem(line.options ?? []);
  const extrasFixed = optionsFixed(line.options ?? []);

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
      const follows =
        l.unitPrice.trim() === "" ||
        (previous !== undefined && product !== undefined && l.unitPrice === moneyToInput(referencePrice(product, previous.id, l.quantity)?.cents ?? previous.priceCents, numberStyle));
      return {
        ...l,
        variationId: next.id,
        variationName: next.name,
        variationLabel: product?.variationLabel ?? l.variationLabel ?? "",
        unitPrice: follows ? moneyToInput((product ? referencePrice(product, next.id, l.quantity)?.cents : undefined) ?? next.priceCents, numberStyle) : l.unitPrice,
        // Options priced by variation take the new one's price.
        options: repriceOptions(product?.options ?? [], product?.extras ?? [], l.options ?? [], next.id),
      };
    });
  }

  const typedPrice = parseMoney(line.unitPrice);
  // What the product charges for what is chosen (its variation's price when it has variations).
  // (with the quantity price that applies at the quantity typed)
  const asked = product ? referencePrice(product, line.variationId, line.quantity) : undefined;
  const reference = asked?.cents;
  const applied = asked?.applied ?? null;
  const priceDiffers = product !== undefined && reference !== undefined && (!typedPrice.ok || typedPrice.value !== reference);

  // The quantity changes: a price that follows the product's takes the new quantity's price.
  function changeQuantity(text: string) {
    scope?.markEdited(id("quantity"));
    setLine((l) => {
      if (!product) return { ...l, quantity: text };
      const before = referencePrice(product, l.variationId, l.quantity)?.cents;
      const after = referencePrice(product, l.variationId, text)?.cents;
      const follows = before !== undefined && l.unitPrice === moneyToInput(before, numberStyle);
      return { ...l, quantity: text, ...(follows && after !== undefined ? { unitPrice: moneyToInput(after, numberStyle) } : {}) };
    });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const current = lineNow;
    event.preventDefault();
    // This form sits inside the quote's form in the React tree: never save the quote with it.
    event.stopPropagation();
    // A discount opened and left empty is dropped, not refused (the same rule as the quote's own discount).
    const line = withoutEmptyOptionals(current);
    if (line !== current) setLine(line);
    // A job item has no price: the parser still wants one, so it is given a neutral one that is never kept.
    const result = parseLine(job ? { ...line, unitPrice: "0", discountKind: "none", discountValue: "", vatStatus: "standard" } : line);
    setAttempt((n) => n + 1);
    // A product with variations needs one chosen, and its required options answered (the database cannot
    // know: lines keep their own copy).
    const mustChoose = variations.length > 0 && !line.variationName ? { variation: `Choose a ${word.toLowerCase()}.` } : {};
    const missing = missingOptions(optionGroups, productExtras, line.options ?? []);
    setOptionErrors(missing);
    if (!result.ok || Object.keys(mustChoose).length > 0 || Object.keys(missing).length > 0) {
      // An extra ticked without its wording is also "options that cannot be used": say it once, at the extra.
      const { options: unusable, ...rest } = result.ok ? ({} as LineErrors) : result.errors;
      setErrors({ ...(Object.keys(missing).length > 0 ? rest : { ...rest, ...(unusable ? { options: unusable } : {}) }), ...mustChoose });
      return;
    }
    setErrors({});
    // When a quantity price set the price each (and it was not typed over), the item keeps the price before it and
    // its words, for the quote to show if the maker wants; otherwise nothing is kept.
    const before = product && applied && !priceDiffers ? listPriceOf(product, line.variationId) : undefined;
    const saved: LineFormValues =
      before !== undefined && applied
        ? { ...line, listPrice: moneyToInput(before, numberStyle), quantityPriceText: priceBreakText(applied, line.unit.trim() || null, numberStyle, money) }
        : { ...line, listPrice: undefined, quantityPriceText: undefined };
    startTransition(() => {
      if (quoteShows && (shows.photos !== quoteShows.photos || shows.quantityPrices !== quoteShows.quantityPrices)) quoteShows.onChange(shows);
      onSave(saved);
    });
  }

  const problems: FormProblem[] = (
    [
      ["name", "Name"],
      ["variation", word],
      ["options", "Options and extras"],
      ["quantity", "Quantity"],
      ["unit", "Unit"],
      ...(job ? [] : ([["unitPrice", priceLabel]] as const)),
      ...(job || line.productId ? [] : ([["unitCost", "What it costs you"]] as const)),
      ["description", "Description"],
      ...(job ? [] : ([["discountValue", "Discount"]] as const)),
    ] as const
  ).flatMap(([field, label]) => {
    const message = errors[field as keyof LineErrors];
    return message ? [{ fieldId: id(field), label, message }] : [];
  });
  for (const g of optionGroups) {
    if (optionErrors[g.id]) problems.push({ fieldId: id(`option-${g.id}`), label: g.name, message: optionErrors[g.id] });
  }
  for (const x of productExtras) {
    if (optionErrors[x.id]) problems.push({ fieldId: id(`extra-${x.id}-text`), label: x.name, message: optionErrors[x.id] });
  }

  // "12 × R17 = R204": the line as it will add up, once something is chosen that costs.
  const quantity = parseQuantity(line.quantity);
  const sum =
    (extrasEach > 0 || extrasFixed > 0) && typedPrice.ok && quantity.ok
      ? (() => {
          const each = typedPrice.value + extrasEach;
          const total = Math.round((quantity.value * each) / 1000) + extrasFixed;
          return `${line.quantity} × ${money(each)}${extrasFixed > 0 ? ` + ${money(extrasFixed)}` : ""} = ${money(total)}`;
        })()
      : null;

  return (
    <FormErrorScope epoch={attempt}>
      <ErrorScopeBridge onScope={setScope} />
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
            {/* The product's photo, as it is on file; the quote shows it only if this is ticked (a setting of the whole quote). */}
            {product?.photoImageId && !job && (
              <div className="space-y-2" data-testid="item-photo">
                <PhotoThumb imageId={product.photoImageId} size="xl" className="self-start" />
                {quoteShows && (
                  <Field orientation="horizontal" className="items-start py-1">
                    <Checkbox
                      id={id("showPhoto")}
                      checked={shows.photos}
                      onCheckedChange={(checked) => setShows((s) => ({ ...s, photos: checked === true }))}
                    />
                    <FieldLabel htmlFor={id("showPhoto")} className="text-base">
                      Show product photos on this quote
                    </FieldLabel>
                  </Field>
                )}
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
              ...variations.map((v) => ({ key: v.id, name: v.name, priceText: job ? "" : money(v.priceCents), imageId: v.imageId ?? undefined })),
              ...(keptOwn
                ? [{ key: "kept", name: line.variationName ?? "", priceText: "", note: `No longer on the ${product ? KIND_WORDS[product.kind].one : "product"}. Kept as it was.` }]
                : []),
            ]}
          />
        )}
        <QuantityField
          id={id("quantity")}
          label="Quantity"
          stepper
          numberStyle={numberStyle}
          unit={line.unit.trim() || undefined}
          value={line.quantity}
          error={errors.quantity}
          onChange={changeQuantity}
        />
        {/* A product's line has the product's unit (shown with the quantity); only a one-off item asks for one. */}
        {!line.productId && <UnitField id={id("unit")} value={line.unit} error={errors.unit} onChange={set("unit")} />}
        {!job && (
          <TextField
            id={id("unitPrice")}
            label={line.unit.trim() ? `${priceLabel} per ${line.unit.trim()}` : priceLabel}
            startText={symbol}
            inputMode="decimal"
            autoComplete="off"
            hint={applied && !priceDiffers ? `Quantity price: ${priceBreakText(applied, line.unit.trim() || null, numberStyle, money)}.` : undefined}
            value={line.unitPrice}
            error={errors.unitPrice}
            onChange={set("unitPrice")}
          />
        )}
        {/* Where the quantity price shows it is applied: the quote can say so under the item (a setting of the whole quote). */}
        {!job && quoteShows && applied && !priceDiffers && (
          <Field orientation="horizontal" className="items-start py-1" data-testid="show-quantity-price">
            <Checkbox
              id={id("showQuantityPrice")}
              checked={shows.quantityPrices}
              onCheckedChange={(checked) => setShows((s) => ({ ...s, quantityPrices: checked === true }))}
            />
            <FieldLabel htmlFor={id("showQuantityPrice")} className="text-base">
              Show quantity prices on this quote
            </FieldLabel>
          </Field>
        )}
        {!job && !line.productId && (
          <TextField
            id={id("unitCost")}
            label={line.unit.trim() ? `What it costs you per ${line.unit.trim()} (optional)` : "What it costs you (optional)"}
            tag={<PrivateTag id={`${id("unitCost")}-tag`} />}
            startText={symbol}
            inputMode="decimal"
            autoComplete="off"
            value={line.unitCost ?? ""}
            error={errors.unitCost}
            onChange={set("unitCost")}
          />
        )}
        {!job && !line.productId && targetPrice !== null && targetPrice !== currentPrice && (
          <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="target-price-hint">
            <span className="text-muted-foreground">
              For your {formatPercent(pricing?.targetBp ?? 0, numberStyle)} target, charge {money(targetPrice)}
              {line.unit.trim() ? ` per ${line.unit.trim()}` : " each"}.
            </span>
            <Button type="button" variant="link" className="h-auto p-0" onClick={() => set("unitPrice")(moneyToInput(targetPrice, numberStyle))}>
              Use {money(targetPrice)}
            </Button>
          </div>
        )}
        {!job && product && priceDiffers && reference !== undefined && (
          <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="product-price-hint">
            <span className="text-muted-foreground">
              {applied
                ? `The quantity price (${priceBreakText(applied, line.unit.trim() || null, numberStyle, money)}) is ${money(reference)}.`
                : chosen
                  ? `The ${KIND_WORDS[product.kind].one}'s price for ${chosen.name} is ${money(reference)}.`
                  : `The ${KIND_WORDS[product.kind].one}'s price is ${money(reference)}.`}
            </span>
            <Button
              type="button"
              variant="link"
              className="h-auto p-0"
              onClick={() => set("unitPrice")(moneyToInput(reference, numberStyle))}
            >
              Use {money(reference)}
            </Button>
          </div>
        )}
        <TextAreaField
          id={id("description")}
          label="Description (optional)"
          hint={job ? "Size, colour, wording: anything you need at the bench." : `Shown on the ${subject} under the name.`}
          maxLength={1000}
          value={line.description}
          error={errors.description}
          onChange={set("description")}
        />
        {/* A discount on the item is an optional thing, added and removed the way the quote's own discount is. */}
        {!job && line.discountKind === "none" && (
          <div>
            <AddButton
              id={id("add-discount")}
              onClick={() => {
                setLine((l) => ({ ...l, discountKind: "percent", discountValue: "" }));
                setTimeout(() => document.getElementById(id("discountValue"))?.focus(), 0);
              }}
            >
              Add a discount
            </AddButton>
          </div>
        )}
        {!job && line.discountKind !== "none" && (
          <div className="space-y-4 rounded-xl border border-border p-3" role="group" aria-label="Item discount">
            <SelectField
              id={id("discountKind")}
              label="Discount on this item"
              value={line.discountKind}
              onChange={(kind) => setLine((l) => ({ ...l, discountKind: (kind === "fixed" ? "fixed" : "percent") as DiscountKind }))}
              options={["percent", "fixed"]}
              optionLabels={{ percent: "A percentage", fixed: "An amount" }}
            />
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
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLine((l) => ({ ...l, discountKind: "none", discountValue: "" }));
                setTimeout(() => document.getElementById(id("add-discount"))?.focus(), 0);
              }}
            >
              Remove discount
            </Button>
          </div>
        )}
        {!job && vatChoices && (
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

      {showOptions && (
        <Section title="Options and extras">
          <OptionChoices
            idPrefix="line-sheet-"
            groups={optionGroups}
            extras={productExtras}
            chosen={line.options ?? []}
            variationId={line.variationId ?? ""}
            errors={optionErrors}
            money={money}
            showPrices={!job}
            numberStyle={numberStyle}
            onChange={(options) => {
              setLine((l) => ({ ...l, options }));
              // A problem goes away once it is fixed.
              setOptionErrors((e) => Object.fromEntries(Object.entries(e).filter(([gid]) => missingOptions(optionGroups, productExtras, options)[gid])));
            }}
          />
          {errors.options && (
            <p id={id("options")} tabIndex={-1} className="text-sm text-destructive">
              {errors.options}
            </p>
          )}
          {!job && sum && (
            <p className="text-base" data-testid="line-sum">
              {sum}
            </p>
          )}
        </Section>
      )}

      <FormSummary problems={problems} trigger={attempt} />

      {onRemove && (
        <section className="space-y-3" aria-label="Remove this item">
          {!confirmingRemove ? (
            <Button id="remove-item" type="button" variant="danger" onClick={() => setConfirmingRemove(true)}>
              Remove this item
            </Button>
          ) : (
            <div ref={removeQuestion} className="space-y-3 rounded-xl border border-destructive/50 p-3 scroll-mb-28" role="alertdialog" aria-label="Remove this item?">
              <p className="text-base">Take {line.name.trim() || "this item"} off the {subject}?</p>
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
          {isNew ? `Add to ${subject}` : "Save item"}
        </Button>
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onBack}>
          {isNew ? "Back" : "Cancel"}
        </Button>
      </div>
    </form>
    </FormErrorScope>
  );
}

const vatStatusOf = (value: string): VatStatus => (value === "zero" || value === "exempt" ? value : "standard");
