"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ComingSoonSection } from "@/components/coming-soon";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { UnitField } from "@/components/unit-field";
import { Section, SelectField, TextAreaField, TextField } from "@/components/form-fields";
import type { Cents, NumberStyle, VatSettings, VatStatus } from "@/lib/money";
import type { CostRowErrors } from "@/lib/products/costs";
import { extraCostOf, summariseCosts } from "@/lib/products/cost-summary";
import { formatMoney } from "@/lib/money";
import type { AddMaterialConfig } from "./add-material";
import { CostsSection, type MaterialOption } from "./costs-section";
import { ImageField } from "@/components/image-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ProductFieldErrors, ProductKind, ProductSummary } from "@/lib/products";
import { carryPrice } from "@/lib/products/variations";
import type { PriceBase } from "@/lib/products/added-price";
import { carryPriceBreaks, sentPriceBreaks } from "@/lib/products/price-breaks";
import Link from "@/components/app-link";
import type { ProductSaveState } from "./actions";
import type { VatChoice } from "@/lib/quotes/vat-choices";
import { newVariationKey, PricedVariations } from "./variations-section";
import { ListsSection } from "./lists-section";
import { ExtrasSection } from "./extras-section";
import { QuantityPrices } from "./quantity-prices-section";
import { newStepKey, StepsSection } from "./steps-section";
import type { StepFormRow } from "@/lib/products/steps";
import { KIND_WORDS, listHref, type ProductFormValues } from "./product-values";
import { AddButton } from "@/components/add-button";
import { ChoiceCards } from "@/components/choice-cards";
import { FormErrorScope, useEditedFields } from "@/components/form-errors";
import { TabList, TabPanel } from "@/components/tab-list";
import { productTabOf, type ProductTab } from "./product-tabs";

/**
 * The bar of three tabs, pinned at the top. It reads which problems are still unfixed (a field edited since the last
 * save drops its problem at once, as in the summary), and says so in words on the tab that holds them.
 */
function ProductTabBar({
  kind,
  active,
  onChange,
  problemTabs,
  inputs,
  fid,
}: {
  kind: ProductKind;
  active: ProductTab;
  onChange: (tab: ProductTab) => void;
  /** The tab each problem is on, with the id of its field. */
  problemTabs: readonly { fieldId: string; tab: ProductTab }[];
  /** How many cost lines. */
  inputs: number;
  fid: (key: string) => string;
}) {
  const { edited } = useEditedFields();
  const fixes = (tab: ProductTab) => problemTabs.filter((p) => p.tab === tab && !edited.has(p.fieldId)).length;
  const note = (tab: ProductTab) => (fixes(tab) > 0 ? `${fixes(tab)} to fix` : undefined);
  return (
    <div className="sticky top-0 z-20 -mx-4 border-b border-border bg-background px-4 py-2">
      <TabList
        label="Parts of the form"
        layout="equal"
        active={active}
        onChange={onChange}
        tabId={(tab) => fid(`tab-${tab}`)}
        panelId={(tab) => fid(`panel-${tab}`)}
        tabs={[
          { key: "details", label: "Details", note: note("details") },
          { key: "production", label: kind === "service" ? "Steps" : "Production", note: note("production") },
          { key: "inputs", label: "Inputs", count: inputs, note: note("inputs") },
        ]}
      />
    </div>
  );
}

/**
 * The layers a product will grow, shown where they will live but not working yet
 * (docs/plans/products.md). Each becomes a real section when it is built.
 */
const COMING_SOON: Record<ProductKind, readonly (readonly [string, string])[]> = {
  product: [
    ["Costs and margin", "What it costs to make, to show your profit."],
    ["Stock", "How many you have ready to sell."],
  ],
  // Services (founder, 2026-10-03): no photo or stock; costs are mostly your time.
  service: [["Costs and margin", "Your time and other costs, to show your profit."]],
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
        message: "Couldn't reach the server. Try again. Nothing you typed is lost.",
      };
    }
  };
}

/** What the Inputs tab (what it costs to make) is worked out with. */
export type ProductFormCosting = {
  materials: MaterialOption[];
  /** What an hour of the maker's time is worth, or null when it is not set in Product settings. */
  hourlyRateCents: Cents | null;
  vat: VatSettings;
  /** The margin the business aims for (basis points), or null when it has not said. */
  targetMarginBp: number | null;
  /** The country's word for the tax ("VAT"), for the new material form. */
  taxName: string;
};

/** Add or edit a product. The basics work; the later layers are shown as "coming soon". */
export function ProductForm({
  action,
  initial,
  mode,
  priceLabel,
  vatChoices,
  variationSuggestions,
  currencySymbol,
  currencyCode,
  numberStyle,
  idPrefix = "",
  embedded,
  costing,
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
  /** "ZAR" and the country's number style: the price each that a quantity price leaves is written with them. */
  currencyCode: string;
  numberStyle: NumberStyle;
  /** In front of every field id, for when the form shares a page with other fields. */
  idPrefix?: string;
  embedded?: EmbeddedProductForm;
  /**
   * What the "What it costs to make" section needs. When a page has not loaded it, the Inputs tab says it is coming
   * and what is saved for the costs is left as it is.
   */
  costing?: ProductFormCosting;
}) {
  // Materials added from a cost line while the form is open (it is not reloaded, so what is typed stays).
  const [addedMaterials, setAddedMaterials] = useState<MaterialOption[]>([]);
  // (Once the page has been refreshed with the new material in it, the one added here is not listed twice.)
  const costingMaterials = costing ? [...costing.materials, ...addedMaterials.filter((a) => !costing.materials.some((m) => m.id === a.id))] : [];
  const addMaterial: AddMaterialConfig | undefined = costing
    ? {
        vatRateBp: costing.vat.registered ? costing.vat.standardRateBp : null,
        taxName: costing.taxName,
        currencyCode,
        numberStyle,
        currencySymbol,
        onAdded: (material) => setAddedMaterials((list) => (list.some((m) => m.id === material.id) ? list : [...list, material])),
      }
    : undefined;
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
  // How many pictures of choices are on their way (each choice has its own).
  const [choiceUploads, setChoiceUploads] = useState(0);
  const uploadsRef = useRef(0);
  const onChoicePending = (busy: boolean) => {
    uploadsRef.current = Math.max(0, uploadsRef.current + (busy ? 1 : -1));
    setChoiceUploads(uploadsRef.current);
    // The "wait" note goes only when the last one has arrived.
    if (uploadsRef.current === 0) setWaiting(false);
  };
  // A picture that finishes uploading is put on its choice in the form as it is NOW (by key): what was typed while
  // it was on its way must not be put back the way it was when the picture was chosen.
  const setVariationImage = (key: string, imageId: string) => {
    setEditedSinceSave(true);
    setValues((v) => ({ ...v, variations: v.variations.map((r) => (r.key === key ? { ...r, imageId } : r)) }));
  };
  const setValueImage = (groupKey: string, valueKey: string, imageId: string) => {
    setEditedSinceSave(true);
    setValues((v) => ({
      ...v,
      options: v.options.map((g) => (g.key === groupKey ? { ...g, values: g.values.map((x) => (x.key === valueKey ? { ...x, imageId } : x)) } : g)),
    }));
  };
  const uploadingAny = uploading || choiceUploads > 0;
  useEffect(() => {
    // A sheet over a quote must not close while either the save or a picture is on its way.
    embeddedRef.current?.onPendingChange(pending || uploadingAny);
  }, [pending, uploadingAny]);
  const [, startTransition] = useTransition();
  const [values, setValues] = useState<ProductFormValues>(initial);
  // Which of the three tabs is open (not in the address: it is a view of one unsaved form).
  const [tab, setTab] = useState<ProductTab>("details");
  // Steps are tracked step by step only when the product has some (the usual is as a whole); the rows typed are kept when it is switched back.
  const [trackedAsSteps, setTrackedAsSteps] = useState(initial.steps.length > 0);
  // After a save, new variations take the ids the database gave them, so saving again keeps them (and the
  // quote items that point at them) instead of replacing them.
  // The rows as they were sent, in order: the saved product lists its variations in the same order.
  const [sentKeys, setSentKeys] = useState<string[]>([]);
  const [sentOptions, setSentOptions] = useState<{ key: string; values: string[] }[]>([]);
  const [sentExtras, setSentExtras] = useState(0);
  // The sizes put aside when the maker goes back to one price, so changing their mind loses nothing typed.
  const [aside, setAside] = useState<{ label: string; rows: ProductFormValues["variations"]; options: ProductFormValues["options"]; priceBySize: string[] } | null>(null);
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
            ? v.extras.map((r, i) => ({ ...r, id: savedExtras[i].id, shared: savedExtras[i].shared, usedOn: savedExtras[i].usedOn, edited: false, costsEdited: false }))
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
  // The further variations are numbered after the first one ("Variation 2"), and a further variation with no name
  // is called that (the same words in the card, the summary and what is saved).
  const furtherNumber = values.variations.length > 0 ? 2 : 1;
  // What a step can depend on: the variations, the choices in the lists, and the extras, as named on this form.
  const stepChoices = [
    ...values.variations.filter((r) => r.name.trim() !== "").map((r) => ({ value: `variation:${r.key}`, label: `${values.variationLabel.trim() || "Variation"}: ${r.name.trim()}` })),
    ...values.options.flatMap((g, gi) =>
      g.values.filter((x) => x.name.trim() !== "").map((x) => ({ value: `value:${g.key}/${x.key}`, label: `${g.name.trim() || `Variation ${gi + furtherNumber}`}: ${x.name.trim()}` })),
    ),
    ...values.extras.filter((x) => x.name.trim() !== "").map((x) => ({ value: `extra:${x.key}`, label: `Extra: ${x.name.trim()}` })),
  ];
  // The prices that choices and extras add to: each variation's, or the product's own. An amount added is shown with
  // what it makes.
  const priceBases: PriceBase[] =
    values.variations.length > 0
      ? values.variations.filter((r) => r.name.trim() !== "").map((r) => ({ key: r.key, name: r.name.trim(), price: r.price }))
      : [{ key: "", name: "", price: values.unitPrice }];
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
  const variationWord = values.variationLabel.trim() || "Choice";
  if (values.variations.length > 0 && errors.variations?.label) problems.push({ fieldId: fid("variationLabel"), label: "Variation name", message: errors.variations.label });
  values.variations.forEach((row, i) => {
    const e = errors.variations?.rows[row.key];
    if (e?.name) problems.push({ fieldId: fid(`variation-${row.key}-name`), label: `${variationWord} ${i + 1}`, message: e.name });
    if (e?.price) problems.push({ fieldId: fid(`variation-${row.key}-price`), label: `${variationWord} ${i + 1} price`, message: e.price });
  });
  if (values.variations.length > 0 && errors.variations?.list) problems.push({ fieldId: fid("variations"), label: "Variations", message: errors.variations.list });
  values.options.forEach((g, gi) => {
    const e = errors.options?.groups[g.key];
    if (!e) return;
    const title = g.name.trim() || `Variation ${gi + furtherNumber}`;
    if (e.name) problems.push({ fieldId: fid(`option-${g.key}-name`), label: `${title}: name`, message: e.name });
    if (e.values) problems.push({ fieldId: fid(`option-${g.key}-add-value`), label: title, message: e.values });
    g.values.forEach((v, vi) => {
      const ve = e.rows[v.key];
      if (ve?.name) problems.push({ fieldId: fid(`option-${g.key}-value-${v.key}-name`), label: `${title}: choice ${vi + 1}`, message: ve.name });
      if (ve?.price) problems.push({ fieldId: fid(`option-${g.key}-value-${v.key}-price`), label: `${title}: choice ${vi + 1} price`, message: ve.price });
      if (ve?.offered && values.variations.length > 0) {
        problems.push({ fieldId: fid(`option-${g.key}-value-${v.key}-in-${values.variations[0].key}`), label: `${title}: choice ${vi + 1} comes in`, message: ve.offered });
      }
      for (const [vk, message] of values.variations.length > 0 ? Object.entries(ve?.prices ?? {}) : []) {
        const variationName = values.variations.find((r) => r.key === vk)?.name.trim() ?? "";
        problems.push({ fieldId: fid(`option-${g.key}-value-${v.key}-price-${vk}`), label: `${title}: choice ${vi + 1} for ${variationName}`, message });
      }
    });
  });
  if ((values.variations.length > 0 || values.options.length > 0) && errors.options?.list) problems.push({ fieldId: fid("options-error"), label: "Variations", message: errors.options.list });
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
  // The quantity prices' problems, in the order they appear: the product's own, then each variation's.
  const scopes = values.variations.length > 0 ? values.variations.map((r, i) => ({ key: r.key, name: r.name.trim() || `${variationWord} ${i + 1}` })) : [{ key: "", name: "" }];
  for (const scope of scopes) {
    values.priceBreaks
      .filter((row) => row.variationKey === scope.key)
      .forEach((row, i) => {
        const e = errors.priceBreaks?.rows[row.key];
        const title = `${scope.name ? `${scope.name}: ` : ""}quantity price ${i + 1}`;
        if (e?.from) problems.push({ fieldId: fid(`price-break-${row.key}-from`), label: `${title}: from`, message: e.from });
        if (e?.value) problems.push({ fieldId: fid(`price-break-${row.key}-value`), label: `${title}: ${row.kind === "percent" ? "percent off" : "amount off"}`, message: e.value });
      });
  }
  if (errors.priceBreaks?.list) problems.push({ fieldId: fid("price-breaks-error"), label: "Quantity prices", message: errors.priceBreaks.list });
  values.steps.forEach((row, i) => {
    const e = errors.steps?.rows[row.key];
    if (e?.name) problems.push({ fieldId: fid(`step-${row.key}-name`), label: `Step ${i + 1}`, message: e.name });
    if (e?.list) problems.push({ fieldId: fid(`step-${row.key}-add-condition`), label: `Step ${i + 1}`, message: e.list });
    row.conditions.forEach((c, ci) => {
      const ce = e?.conditions?.[c.key];
      if (ce?.ref) problems.push({ fieldId: fid(`step-${row.key}-c-${c.key}-ref`), label: `Step ${i + 1}: condition ${ci + 1}`, message: ce.ref });
      if (ce?.quantity) problems.push({ fieldId: fid(`step-${row.key}-c-${c.key}-quantity`), label: `Step ${i + 1}: condition ${ci + 1} quantity`, message: ce.quantity });
    });
  });
  if (errors.steps?.list) problems.push({ fieldId: fid("steps-error"), label: "Steps", message: errors.steps.list });
  // The cost lines' problems, in the order they appear (the product's, then each extra's).
  const pushCostProblems = (lines: ProductFormValues["costLines"], rowErrors: Record<string, CostRowErrors> | undefined, prefix: string, listFieldId?: string, list?: string) => {
    lines.forEach((row, i) => {
      const e = rowErrors?.[row.key];
      if (!e) return;
      const title = `${prefix}Cost ${i + 1}`;
      const id = (field: string) => fid(`cost-${row.key}-${field}`);
      if (e.materialId) problems.push({ fieldId: id("first"), label: `${title}: material`, message: e.materialId });
      if (e.amount) problems.push({ fieldId: id("amount"), label: `${title}: how much`, message: e.amount });
      if (e.unit) problems.push({ fieldId: id("unit"), label: `${title}: unit`, message: e.unit });
      if (e.time) problems.push({ fieldId: id("first"), label: `${title}: how long`, message: e.time });
      if (e.name) problems.push({ fieldId: id("first"), label: `${title}: what is it`, message: e.name });
      if (e.cost) problems.push({ fieldId: id("cost"), label: `${title}: what it costs`, message: e.cost });
      if (e.list) problems.push({ fieldId: id("cond-add-condition"), label: title, message: e.list });
      row.conditions.forEach((c, ci) => {
        const ce = e.conditions?.[c.key];
        if (ce?.ref) problems.push({ fieldId: id(`cond-c-${c.key}-ref`), label: `${title}: condition ${ci + 1}`, message: ce.ref });
        if (ce?.quantity) problems.push({ fieldId: id(`cond-c-${c.key}-quantity`), label: `${title}: condition ${ci + 1} quantity`, message: ce.quantity });
      });
    });
    if (list && listFieldId) problems.push({ fieldId: listFieldId, label: `${prefix}Costs`, message: list });
  };
  pushCostProblems(values.costLines, errors.costs?.rows, "");
  if (errors.costs?.makes) problems.push({ fieldId: fid("makes"), label: "How many one batch makes", message: errors.costs.makes });
  if (errors.costs?.list) problems.push({ fieldId: fid("costs-error"), label: "Costs", message: errors.costs.list });
  values.extras.forEach((x, xi) => {
    const ce = errors.extraCosts?.byExtra[x.key];
    if (ce) pushCostProblems(x.costLines ?? [], ce.rows, `${x.name.trim() || `Extra ${xi + 1}`}: `, fid(`extra-${x.key}-costs-error`), ce.list);
  });
  if (errors.extraCosts?.list) problems.push({ fieldId: fid("add-extra"), label: "Extras' costs", message: errors.extraCosts.list });

  // The tab each problem is on: the steps' on Production, the product's own cost lines' on Inputs, the rest on Details
  // (an extra's cost lines are edited with the extra).
  const costKeys = values.costLines.map((r) => r.key);
  const tabOfField = (fieldId: string): ProductTab => productTabOf(fieldId, fid, costKeys);
  const problemTabs = problems.map((p) => ({ fieldId: p.fieldId, tab: tabOfField(p.fieldId) }));
  // A save that comes back with problems opens the first tab that has one (staying put if the open tab has one).
  const [seenForTab, setSeenForTab] = useState(state);
  if (state !== seenForTab) {
    setSeenForTab(state);
    if (state.status === "error" && problemTabs.length > 0 && !problemTabs.some((p) => p.tab === tab)) setTab(problemTabs[0].tab);
  }

  // Whether it comes in any variations is one yes/no question about the product, asked before the price. The
  // answer decides which of the two the form shows (a product has one or the other).
  const priced = values.variations.length > 0;
  // "Yes" to the question: it has variations of the kind that set the price, or others that add to it.
  const hasVariations = priced || values.options.length > 0;
  // The question's examples come from what we know of the business ("size, material, flavour").
  const examples = variationSuggestions.slice(0, 3).map((w) => w.toLowerCase()).join(", ");
  function changeBreaks(priceBreaks: ProductFormValues["priceBreaks"]) {
    setEditedSinceSave(true);
    setValues((v) => ({ ...v, priceBreaks }));
  }
  // The price moves into the first choice when variations start, and back when the last one goes.
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
              priceBreaks: carryPriceBreaks(v.priceBreaks, v.variations, carried.rows),
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
  // Where focus goes after the last choice (or the last further variation) is removed and its part of the form goes:
  // to the "No" answer when nothing is left, or to the button that adds the first variation again.
  const focusAfter = useRef<"no" | "first" | null>(null);
  useEffect(() => {
    const what = focusAfter.current;
    if (!what) return;
    focusAfter.current = null;
    if (what === "first") document.getElementById(fid("add-first-variation"))?.focus();
    else document.getElementById(fid("pricing-one"))?.closest('[data-slot="field"]')?.querySelector<HTMLElement>('[role="radio"]')?.focus();
  });
  // The variation that sets the price: two empty choices to start, or what was put aside (never an empty list).
  function startFirstVariation() {
    const rows =
      aside && aside.rows.length > 0
        ? aside.rows
        : [
            { key: newVariationKey(), id: "", name: "", price: "", usual: false },
            { key: newVariationKey(), id: "", name: "", price: "", usual: false },
          ];
    changeVariations({ label: aside && aside.rows.length > 0 ? aside.label : values.variationLabel, rows });
    focusAfter.current = null;
  }
  // Answering the variations question rebuilds a big part of the form under the person's finger. In a sheet on a desktop
  // browser the sheet's scroll was seen going back to the top (founder, 2026-10-30), so where it was is put back if it did.
  function keepScroll() {
    const sheet = document.getElementById(fid("pricing-one"))?.closest<HTMLElement>('[data-slot="sheet-content"]');
    if (!sheet) return;
    const top = sheet.scrollTop;
    if (top === 0) return;
    for (const ms of [0, 50, 150, 400]) {
      setTimeout(() => {
        if (sheet.isConnected && sheet.scrollTop < top / 2) sheet.scrollTop = top;
      }, ms);
    }
  }
  function choosePricing(yes: boolean) {
    if (yes === hasVariations) return;
    keepScroll();
    if (yes) {
      // Two empty choices to start (nothing pre-filled), or what was put aside.
      startFirstVariation();
      // What was typed in the price field meanwhile is the first choice's price; "price depends on the size" comes back too.
      const back = new Set(aside?.priceBySize ?? []);
      setValues((v) => ({
        ...v,
        variations: aside && v.unitPrice.trim() !== "" ? v.variations.map((r, i) => (i === 0 ? { ...r, price: v.unitPrice } : r)) : v.variations,
        options: (aside?.options ?? v.options).map((g) => (back.has(g.key) ? { ...g, priceByVariation: true } : g)),
        extras: v.extras.map((x) => (back.has(x.key) ? { ...x, priceByVariation: true } : x)),
      }));
      setAside(null);
    } else {
      setAside({
        label: values.variationLabel,
        rows: values.variations,
        options: values.options,
        priceBySize: [...values.options, ...values.extras].filter((x) => x.priceByVariation).map((x) => x.key),
      });
      changeVariations({ rows: [] });
      setValues((v) => ({ ...v, options: [] }));
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
    if (uploadingAny) {
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

  // The same three tabs in a sheet over a quote: a step or a cost that is wrong is found while quoting.
  const panel = (key: ProductTab, children: React.ReactNode) => (
    <TabPanel id={fid(`panel-${key}`)} tabId={fid(`tab-${key}`)} open={tab === key}>
      {children}
    </TabPanel>
  );

  return (
    <FormErrorScope epoch={state}>
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <ProductTabBar kind={values.kind} active={tab} onChange={setTab} problemTabs={problemTabs} inputs={costing ? values.costLines.length : 0} fid={fid} />
      {panel("details", (
      <>
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
          hint="A line about it for your quotes, like the size or what's included."
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
            hint="Shown small beside the item. Cropped square, so centre the product."
            error={errors.photo ?? (waiting && uploading ? "Wait for the photo to finish uploading, then save." : undefined)}
            onChange={(photoImageId) => set("photoImageId")(photoImageId)}
            onPendingChange={(busy) => {
              setUploading(busy);
              if (!busy) setWaiting(false);
            }}
          />
        )}
      </Section>

      <Section title="Variations">
        <ChoiceCards
          legend={<>Does this {KIND_WORDS[values.kind].one} come in any variations (e.g. {examples})?</>}
          value={hasVariations ? "each" : "one"}
          onChange={(v) => choosePricing(v === "each")}
          idFor={(v) => fid(v === "one" ? "pricing-one" : "pricing-each")}
          choices={[
            { value: "one", title: "No" },
            { value: "each", title: "Yes" },
          ]}
        />
        {priced && (
          <PricedVariations
            label={values.variationLabel}
            rows={values.variations}
            suggestions={variationSuggestions}
            errors={errors.variations}
            priceLabel={priceLabel}
            currencySymbol={currencySymbol}
            currencyCode={currencyCode}
            numberStyle={numberStyle}
            unit={values.unit}
            breaks={values.priceBreaks}
            breakErrors={errors.priceBreaks}
            onBreaksChange={changeBreaks}
            fid={fid}
            onPendingChange={onChoicePending}
            onImage={setVariationImage}
            onChange={(change) => {
              // The last choice removed takes the first variation away: focus goes to what is left to press.
              if (change.rows?.length === 0) focusAfter.current = values.options.length > 0 ? "first" : "no";
              changeVariations(change);
            }}
          />
        )}
        {hasVariations && !priced && (
          // Only further variations are left (an older product, or the first one was removed): the first one can be added again.
          <div className="space-y-2">
            <p className="text-base text-muted-foreground">One variation sets the price: each choice has its own.</p>
            <AddButton id={fid("add-first-variation")} className="self-start" onClick={startFirstVariation}>
              Add choices with their own prices
            </AddButton>
          </div>
        )}
        {hasVariations && (
          <ListsSection
            firstNumber={furtherNumber}
            variations={namedVariations}
            variationWord={values.variationLabel.trim() || "variation"}
            groups={values.options}
            errors={errors.options}
            currencySymbol={currencySymbol}
            currencyCode={currencyCode}
            numberStyle={numberStyle}
            bases={priceBases}
            fid={fid}
            onPendingChange={onChoicePending}
            onImage={setValueImage}
            onChange={(options) => {
              // The last further variation removed with nothing else left answers the question "No": focus goes there.
              if (options.length === 0 && !priced) focusAfter.current = "no";
              setEditedSinceSave(true);
              setValues((v) => ({ ...v, options }));
            }}
          />
        )}
      </Section>

      <Section title="Price">
        {priced ? (
          <p className="text-base text-muted-foreground">The price is set on each choice above.</p>
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
        {!priced && (
          <QuantityPrices
            rows={values.priceBreaks}
            scope=""
            scopeName=""
            priceText={values.unitPrice}
            unit={values.unit}
            currencyCode={currencyCode}
            currencySymbol={currencySymbol}
            numberStyle={numberStyle}
            errors={errors.priceBreaks}
            fid={fid}
            onChange={changeBreaks}
          />
        )}
        {errors.priceBreaks?.list && (
          <p id={fid("price-breaks-error")} tabIndex={-1} className="text-sm text-destructive">
            {errors.priceBreaks.list}
          </p>
        )}
        <UnitField
          id={fid("unit")}
          name="unit"
          value={values.unit}
          error={errors.unit}
          onChange={set("unit")}
          hint="Like kg, dozen or hour. Prices are per unit. Empty for a plain count."
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
            hint={`${vatChoices.find((c) => c.value === values.vatStatus)?.hint ?? ""} You can change it on the quote.`}
            error={errors.vatStatus}
          />
        )}
      </Section>

      <ExtrasSection
        costing={costing ? { materials: costingMaterials, hourlyRateSet: costing.hourlyRateCents !== null, addMaterial } : undefined}
        costErrors={errors.extraCosts?.byExtra}
        costNote={(x) => {
          if (!costing) return null;
          const cost = extraCostOf({
            rows: x.costLines ?? [],
            settings: { materials: new Map(costingMaterials.map((m) => [m.id, m])), hourlyRateCents: costing.hourlyRateCents, vatRateBp: costing.vat.registered ? costing.vat.standardRateBp : null },
            materialUnits: new Map(costingMaterials.map((m) => [m.id, m.unit])),
          });
          return cost ? `Costs ${formatMoney(cost.cents, currencyCode, numberStyle)}${cost.incomplete ? " or more" : ""} each.` : null;
        }}
        rows={values.extras}
        errors={errors.extras}
        variations={namedVariations}
        variationWord={values.variationLabel.trim() || "variation"}
        priceLabel={priceLabel}
        currencySymbol={currencySymbol}
        currencyCode={currencyCode}
        numberStyle={numberStyle}
        bases={priceBases}
        fid={fid}
        onChange={(extras) => {
          setEditedSinceSave(true);
          setValues((v) => ({ ...v, extras }));
        }}
      />
      {!embedded && COMING_SOON[values.kind].filter(([title]) => title === "Stock").map(([title, description]) => (
        <ComingSoonSection key={title} title={title} description={description} />
      ))}
      </>
      ))}
      {panel("production", (
      <StepsSection
        title={values.kind === "service" ? "Steps" : "Production steps"}
        tracked={trackedAsSteps}
        onTrackedChange={(tracked) => {
          setEditedSinceSave(true);
          setTrackedAsSteps(tracked);
          // Steps start with one empty row to name; the ones typed before stay if the choice is changed back.
          if (tracked && values.steps.length === 0) {
            const row: StepFormRow = { key: newStepKey(), name: "", logic: "all", conditions: [] };
            setValues((v) => ({ ...v, steps: [row] }));
          }
        }}
        rows={values.steps}
        errors={errors.steps}
        choices={stepChoices}
        unit={values.unit.trim() || undefined}
        fid={fid}
        onChange={(steps) => {
          setEditedSinceSave(true);
          setValues((v) => ({ ...v, steps }));
        }}
      />
      ))}
      {/* Sent as one field each: the rows as lists, read and checked by the server. */}
      <input type="hidden" name="steps" value={JSON.stringify(trackedAsSteps ? values.steps : [])} />
      <input type="hidden" name="priceBreaks" value={JSON.stringify(sentPriceBreaks(values.priceBreaks, values.variations))} />
      <input
        type="hidden"
        name="options"
        value={JSON.stringify(values.options.map((g, gi) => (g.name.trim() === "" ? { ...g, name: `Variation ${gi + furtherNumber}` } : g)))}
      />
      <input type="hidden" name="extras" value={JSON.stringify(values.extras)} />
      {/* The extras' own cost lines: only the ones that were changed are saved. */}
      <input
        type="hidden"
        name="extraCosts"
        value={JSON.stringify(values.extras.map((x) => ({ key: x.key, changed: x.costsEdited === true, lines: x.costLines ?? [] })))}
      />
      <input type="hidden" name="makes" value={values.makes} />

      <input type="hidden" name="variationLabel" value={values.variationLabel} />
      <input type="hidden" name="variations" value={JSON.stringify(values.variations)} />

      {panel("inputs", (costing ? (
        <>
          <CostsSection
            title={values.kind === "service" ? "What it costs" : "What it costs to make"}
            rows={values.costLines}
            makes={values.makes}
            errors={errors.costs}
            choices={stepChoices}
            materials={costingMaterials}
            addMaterial={addMaterial}
            hourlyRateSet={costing.hourlyRateCents !== null}
            targetBp={costing.targetMarginBp}
            summary={summariseCosts({
              rows: values.costLines,
              makes: values.makes,
              variations: values.variations.filter((r) => r.name.trim() !== "").map((r) => ({ key: r.key, name: r.name.trim(), price: r.price })),
              unitPrice: values.unitPrice,
              vatStatus: values.vatStatus,
              vat: costing.vat,
              settings: {
                materials: new Map(costingMaterials.map((m) => [m.id, m])),
                hourlyRateCents: costing.hourlyRateCents,
                vatRateBp: costing.vat.registered ? costing.vat.standardRateBp : null,
              },
              materialUnits: new Map(costingMaterials.map((m) => [m.id, m.unit])),
            })}
            unit={values.unit.trim() || undefined}
            numberStyle={numberStyle}
            currencySymbol={currencySymbol}
            currencyCode={currencyCode}
            vatRegistered={costing.vat.registered}
            fid={fid}
            onChange={(costLines) => {
              setEditedSinceSave(true);
              setValues((v) => ({ ...v, costLines }));
            }}
            onMakesChange={(makes) => {
              setEditedSinceSave(true);
              setValues((v) => ({ ...v, makes }));
            }}
          />
          <input type="hidden" name="costLines" value={JSON.stringify(values.costLines)} />
        </>
      ) : (
        COMING_SOON[values.kind].filter(([title]) => title === "Costs and margin").map(([title, description]) => (
          <ComingSoonSection key={title} title={title} description={description} />
        ))
      )))}

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

      {waiting && choiceUploads > 0 && (
        <p role="alert" className="text-sm text-destructive">
          Wait for the pictures to finish uploading, then save.
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
    </FormErrorScope>
  );
}
