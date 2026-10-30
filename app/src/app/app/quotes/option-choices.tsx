"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { TextAreaField } from "@/components/form-fields";
import { QuantityField } from "@/components/quantity-field";
import { quantityToInput, parseQuantity, type NumberStyle } from "@/lib/money";
import { useState } from "react";
import { imageUrl } from "@/lib/images";
import { extraAmount, type ExtraSummary } from "@/lib/products/extras";
import type { OptionGroup } from "@/lib/products/options";
import type { LineOption } from "@/lib/quotes";

/**
 * The product's lists and extras on a quote item (docs/plans/product-extras.md): each list as rows to pick one
 * from, each extra as a tick (with how many, and its wording when it asks for some). The item keeps its own copy
 * of what was chosen. Choices the product no longer offers stay on the item ("kept as they were") until they are
 * removed.
 */
export function OptionChoices({
  idPrefix,
  groups,
  extras,
  chosen,
  errors,
  money,
  showPrices = true,
  variationId,
  numberStyle,
  onChange,
}: {
  idPrefix: string;
  /** The variation chosen on the item, for choices whose price depends on it. */
  variationId: string;
  groups: OptionGroup[];
  extras: ExtraSummary[];
  chosen: LineOption[];
  /** By list or extra id: what is missing ("Choose a flavour."). */
  errors: Record<string, string>;
  money: (cents: number) => string;
  /** False on a job: it has no prices to show. */
  showPrices?: boolean;
  /** How the country writes numbers: for the minus and plus on a set number of an extra. */
  numberStyle: NumberStyle;
  onChange: (options: LineOption[]) => void;
}) {
  const id = (part: string) => `${idPrefix}${part}`;
  const plus = (cents: number, from = false) => (showPrices && cents > 0 ? `${from ? "from " : ""}+${money(cents)} each` : "");

  // An extra is on the item when its copy is: of the extra's current kind (ticked, or ticked with wording).
  const entryOf = (x: ExtraSummary) => chosen.find((o) => o.kind !== "one" && o.valueId === x.id && (o.kind === "text") === x.asksForWording);
  const extraEntry = (x: ExtraSummary, previous?: LineOption): LineOption => ({
    groupId: "",
    group: x.asksForWording ? x.name : "Extras",
    kind: x.asksForWording ? "text" : "any",
    valueId: x.id,
    value: x.asksForWording ? "" : x.name,
    text: previous?.text ?? "",
    amountCents: extraAmount(x, variationId),
    quantityMilli: previous?.quantityMilli ?? null,
  });

  // What each list shows as chosen: entries it still offers (the first only). Anything else on the item is shown
  // under "Kept as they were", and is never hidden.
  const shownIn = (g: OptionGroup): LineOption[] => {
    const mine = chosen.filter((o) => o.groupId === g.id && o.kind === "one");
    return mine.filter((o) => offeredValues(g, variationId).some((v) => v.id === o.valueId)).slice(0, 1);
  };
  const shown = new Set([...groups.flatMap(shownIn), ...extras.flatMap((x) => entryOf(x) ?? [])]);
  // Everything but what this list shows: changing a choice never drops another.
  const others = (g: OptionGroup) => {
    const own = new Set(shownIn(g));
    return chosen.filter((o) => !own.has(o));
  };
  const amountOf = (g: OptionGroup, v: OptionGroup["values"][number]) => optionValueAmount(g, v, variationId);
  const copyOf = (g: OptionGroup, v: OptionGroup["values"][number]): LineOption => ({
    groupId: g.id,
    group: g.name,
    kind: "one",
    valueId: v.id,
    value: v.name,
    text: "",
    amountCents: amountOf(g, v),
  });
  // What is on the item but not shown by the product's lists and extras as they are now.
  const kept = chosen.filter((o) => !shown.has(o));
  // Changing an entry keeps its place (typing in an extra's box must not move it to the end of what prints).
  const replace = (from: LineOption | undefined, to: LineOption | null) => {
    if (from && to) return onChange(chosen.map((o) => (o === from ? to : o)));
    const rest = chosen.filter((o) => o !== from);
    onChange(to ? [...rest, to] : rest);
  };

  return (
    <div className="space-y-5">
      {groups.map((g) => {
        const mine = shownIn(g);
        const error = errors[g.id];
        const describedBy = error ? id(`option-${g.id}-error`) : undefined;
        // One is always chosen: an optional list has a choice like "None" of its own.
        const value = mine[0]?.valueId ?? "";
        return (
          <FieldSet key={g.id} data-invalid={!!error}>
            <FieldLegend variant="label" className="text-base">
              {g.name}
            </FieldLegend>
            <RadioGroup
              aria-describedby={describedBy}
              aria-invalid={!!error}
              value={value}
              onValueChange={(key) => {
                const v = g.values.find((x) => x.id === key);
                const had = mine[0];
                if (v && had) onChange(chosen.map((o) => (o === had ? copyOf(g, v) : o)));
                else onChange([...others(g), ...(v ? [copyOf(g, v)] : [])]);
              }}
              className="gap-2"
            >
              {offeredValues(g, variationId).map((v, i) => (
                <Field
                  key={v.id}
                  orientation="horizontal"
                  className="items-center rounded-xl border border-border px-3 py-2.5 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                >
                  <RadioGroupItem id={i === 0 ? id(`option-${g.id}`) : id(`option-${g.id}-${v.id}`)} value={v.id} />
                  <FieldLabel htmlFor={i === 0 ? id(`option-${g.id}`) : id(`option-${g.id}-${v.id}`)} className="flex w-full items-baseline justify-between gap-3 text-base">
                    <span className="flex min-w-0 items-center gap-3">
                      {v.imageId && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imageUrl(v.imageId, "thumb")} alt="" className="size-10 shrink-0 rounded-md object-cover ring-1 ring-foreground/10" />
                      )}
                      <span>{v.name}</span>
                    </span>
                    <span className="shrink-0 text-sm text-muted-foreground">{plus(amountOf(g, v), g.priceByVariation && !variationId)}</span>
                  </FieldLabel>
                </Field>
              ))}
            </RadioGroup>
            {error && <FieldError id={id(`option-${g.id}-error`)}>{error}</FieldError>}
          </FieldSet>
        );
      })}

      {extras.length > 0 && (
        <FieldSet>
          <FieldLegend variant="label" className="text-base">
            Extras
          </FieldLegend>
          <div className="space-y-2">
            {extras.map((x) => {
              const entry = entryOf(x);
              const error = errors[x.id];
              const fieldId = id(`extra-${x.id}`);
              // "from" when the price depends on the size and none is chosen yet.
              const amount = extraAmount(x, variationId);
              const from = x.priceByVariation && !variationId;
              const quantity = entry?.quantityMilli ?? null;
              return (
                <div key={x.id} className="rounded-xl border border-border px-3 py-2.5 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                  <Field orientation="horizontal" className="items-center">
                    <Checkbox
                      id={fieldId}
                      checked={!!entry}
                      onCheckedChange={(on) => replace(entry, on === true ? extraEntry(x) : null)}
                    />
                    <FieldLabel htmlFor={fieldId} className="flex w-full items-baseline justify-between gap-3 text-base">
                      <span>{x.name}</span>
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {quantity === null ? plus(amount, from) : showPrices ? `${quantity / 1000} × ${money(amount)}` : ""}
                      </span>
                    </FieldLabel>
                  </Field>
                  {entry && (
                    <div className="mt-3 space-y-3 pl-9">
                      {x.asksForWording && (
                        <TextAreaField
                          id={id(`extra-${x.id}-text`)}
                          label={`${x.name}: what should it say?`}
                          rows={2}
                          maxLength={x.textMax}
                          value={entry.text}
                          error={error}
                          hint={`${entry.text.length} of ${x.textMax} characters`}
                          onChange={(text) => replace(entry, { ...entry, text })}
                        />
                      )}
                      <FieldSet>
                        <FieldLegend variant="label" className="text-base">
                          How many?<span className="sr-only"> {x.name}</span>
                        </FieldLegend>
                        <RadioGroup
                          value={quantity === null ? "each" : "set"}
                          onValueChange={(v) => replace(entry, { ...entry, quantityMilli: v === "set" ? 1000 : null })}
                        >
                          {(
                            [
                              ["each", "One for each item"],
                              ["set", "A set number"],
                            ] as const
                          ).map(([choice, label]) => (
                            <Field key={choice} orientation="horizontal" className="items-center">
                              <RadioGroupItem id={id(`extra-${x.id}-${choice}`)} value={choice} />
                              <FieldLabel htmlFor={id(`extra-${x.id}-${choice}`)} className="text-base">
                                {label}
                              </FieldLabel>
                            </Field>
                          ))}
                        </RadioGroup>
                      </FieldSet>
                      {quantity !== null && (
                        <ExtraCount
                          id={id(`extra-${x.id}-quantity`)}
                          label={`${x.name}: how many`}
                          quantityMilli={quantity}
                          numberStyle={numberStyle}
                          onChange={(quantityMilli) => replace(entry, { ...entry, quantityMilli })}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </FieldSet>
      )}

      {kept.length > 0 && (
        <section className="space-y-2" aria-labelledby={id("kept-options")}>
          <p id={id("kept-options")} className="text-base font-medium">
            Kept as they were
          </p>
          <p className="text-sm text-muted-foreground">No longer on the product. Kept on this item until you remove them.</p>
          <ul className="space-y-2">
            {kept.map((o, i) => (
              <li key={`${o.groupId}-${o.valueId}-${i}`} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
                <span className="text-base">
                  {o.group}: {o.kind === "text" ? `“${o.text}”` : o.value}
                  {(showPrices ? o.amountCents > 0 : o.quantityMilli != null) && (
                    <span className="block text-sm text-muted-foreground">
                      {o.quantityMilli == null ? plus(o.amountCents) : showPrices ? `${o.quantityMilli / 1000} × ${money(o.amountCents)}` : `${o.quantityMilli / 1000} ×`}
                    </span>
                  )}
                </span>
                <Button type="button" variant="danger" onClick={() => onChange(chosen.filter((x) => x !== o))}>
                  Remove<span className="sr-only"> {o.kind === "text" ? o.group : o.value}</span>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** The choices of a list that come in the item's variation (all of them while none is chosen). */
export function offeredValues(g: OptionGroup, variationId: string | undefined): OptionGroup["values"] {
  return variationId ? g.values.filter((v) => !v.notOffered?.includes(variationId)) : g.values;
}

/** What a choice adds on an item: its price for the item's variation when the list is priced by variation. */
export function optionValueAmount(g: OptionGroup, v: OptionGroup["values"][number], variationId: string | undefined): number {
  if (g.priceByVariation && variationId && v.prices[variationId] !== undefined) return v.prices[variationId];
  return v.priceCents;
}

/** The choices and extras on an item, with the amounts for its variation (after the variation changes). */
export function repriceOptions(
  groups: readonly OptionGroup[],
  extras: readonly ExtraSummary[],
  chosen: readonly LineOption[],
  variationId: string | undefined,
): LineOption[] {
  const repriced = chosen.flatMap((o): LineOption[] => {
    if (o.kind === "one") {
      const g = groups.find((x) => x.id === o.groupId);
      const stored = g?.values.find((x) => x.id === o.valueId);
      // A choice the new variation does not come in goes (its list gets the usual choice below, if it comes in).
      if (g && stored && !offeredValues(g, variationId).includes(stored)) return [];
      const v = g?.priceByVariation ? stored : undefined;
      return [g && v ? { ...o, amountCents: optionValueAmount(g, v, variationId) } : o];
    }
    const x = extras.find((e) => e.id === o.valueId && (o.kind === "text") === e.asksForWording);
    return [x?.priceByVariation ? { ...o, amountCents: extraAmount(x, variationId ?? "") } : o];
  });
  // A list left without a choice starts with its usual one, when that comes in this variation.
  for (const g of groups) {
    if (repriced.some((o) => o.groupId === g.id && o.kind === "one")) continue;
    if (!chosen.some((o) => o.groupId === g.id && o.kind === "one")) continue;
    const usual = offeredValues(g, variationId).find((v) => v.usual);
    if (usual) repriced.push({ groupId: g.id, group: g.name, kind: "one", valueId: usual.id, value: usual.name, text: "", amountCents: optionValueAmount(g, usual, variationId) });
  }
  return repriced;
}

/** What is missing on an item: each list with nothing chosen, each ticked extra that asks for wording with none typed. */
export function missingOptions(
  groups: readonly OptionGroup[],
  extras: readonly ExtraSummary[],
  chosen: readonly LineOption[],
  variationId?: string,
): Record<string, string> {
  const missing: Record<string, string> = {};
  for (const g of groups) {
    const has = chosen.some((o) => o.groupId === g.id && o.kind === "one" && offeredValues(g, variationId).some((v) => v.id === o.valueId));
    if (!has) missing[g.id] = `Choose a ${g.name.toLowerCase()}.`;
  }
  for (const x of extras) {
    if (!x.asksForWording) continue;
    const entry = chosen.find((o) => o.kind === "text" && o.valueId === x.id);
    if (entry && entry.text.trim() === "") missing[x.id] = `Type what the ${x.name.toLowerCase()} should say.`;
  }
  return missing;
}

/**
 * How many of an extra, when it is a set number and not one for each item: whole numbers, 1 or more, with minus and plus.
 * What is typed is held here while it is being typed (an empty box is not yet a number); the item takes the number once it is one.
 */
function ExtraCount({ id, label, quantityMilli, numberStyle, onChange }: { id: string; label: string; quantityMilli: number; numberStyle: NumberStyle; onChange: (milli: number) => void }) {
  const [text, setText] = useState(quantityToInput(quantityMilli, numberStyle));
  const [problem, setProblem] = useState<string | undefined>();
  function typed(next: string) {
    setText(next);
    const parsed = parseQuantity(next);
    if (!parsed.ok || parsed.value < 1000 || parsed.value % 1000 !== 0) {
      setProblem("Enter a whole number, 1 or more.");
      return;
    }
    setProblem(undefined);
    onChange(parsed.value);
  }
  return <QuantityField id={id} label={label} stepper numberStyle={numberStyle} value={text} error={problem} onChange={typed} />;
}
