"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { OptionGroup } from "@/lib/products/options";
import type { LineOption } from "@/lib/quotes";

/**
 * The product's options and extras on a quote item (docs/plans/product-choices.md): choose one as rows, choose
 * any as ticks, type something as a box. The item keeps its own copy of what was chosen. Choices the product
 * no longer offers stay on the item ("kept as they were") until they are removed.
 */
export function OptionChoices({
  idPrefix,
  groups,
  chosen,
  errors,
  money,
  variationId,
  onChange,
}: {
  idPrefix: string;
  /** The variation chosen on the item, for options whose price depends on it. */
  variationId: string;
  groups: OptionGroup[];
  chosen: LineOption[];
  /** By option id: what is missing ("Choose a flavour."). */
  errors: Record<string, string>;
  money: (cents: number) => string;
  onChange: (options: LineOption[]) => void;
}) {
  const id = (part: string) => `${idPrefix}${part}`;
  const plus = (cents: number, from = false) => (cents > 0 ? `${from ? "from " : ""}+${money(cents)} each` : "");
  // What each option shows as chosen: entries of its current kind that it still offers ("choose one": the
  // first only). Anything else on the item is shown under "Kept as they were", and is never hidden.
  const shownIn = (g: OptionGroup): LineOption[] => {
    const mine = chosen.filter((o) => o.groupId === g.id && o.kind === g.kind);
    if (g.kind === "text") return mine.slice(0, 1);
    const offered = mine.filter((o) => g.values.some((v) => v.id === o.valueId));
    return g.kind === "one" ? offered.slice(0, 1) : offered;
  };
  const shown = new Set(groups.flatMap(shownIn));
  const inGroup = shownIn;
  // Everything but what this option shows: changing a choice never drops a kept one.
  const others = (g: OptionGroup) => {
    const own = new Set(shownIn(g));
    return chosen.filter((o) => !own.has(o));
  };
  const amountOf = (g: OptionGroup, v: OptionGroup["values"][number]) => optionValueAmount(g, v, variationId);
  const copyOf = (g: OptionGroup, v: OptionGroup["values"][number]): LineOption => ({
    groupId: g.id,
    group: g.name,
    kind: g.kind,
    valueId: v.id,
    value: v.name,
    text: "",
    amountCents: amountOf(g, v),
  });
  // What is on the item but not shown by the product's options as they are now.
  const kept = chosen.filter((o) => !shown.has(o));

  return (
    <div className="space-y-5">
      {groups.map((g) => {
        const mine = inGroup(g);
        const error = errors[g.id];
        const describedBy = error ? id(`option-${g.id}-error`) : undefined;
        if (g.kind === "text") {
          const text = mine[0]?.text ?? "";
          return (
            <Field key={g.id} data-invalid={!!error}>
              <FieldLabel htmlFor={id(`option-${g.id}`)}>
                {g.name}
                {g.required ? "" : " (optional)"}
              </FieldLabel>
              <Textarea
                id={id(`option-${g.id}`)}
                rows={2}
                maxLength={g.textMax}
                value={text}
                aria-invalid={!!error}
                aria-describedby={[id(`option-${g.id}-hint`), describedBy].filter(Boolean).join(" ")}
                onChange={(e) => {
                  const next = e.target.value;
                  onChange([
                    ...others(g),
                    ...(next.trim() === ""
                      ? []
                      : [{ groupId: g.id, group: g.name, kind: "text" as const, valueId: "", value: "", text: next, amountCents: g.textPriceCents }]),
                  ]);
                }}
              />
              <FieldDescription id={id(`option-${g.id}-hint`)}>
                {`${text.length} of ${g.textMax} characters`}
                {g.textPriceCents > 0 ? ` · ${plus(g.textPriceCents)}` : ""}
              </FieldDescription>
              {error && <FieldError id={id(`option-${g.id}-error`)}>{error}</FieldError>}
            </Field>
          );
        }
        if (g.kind === "one") {
          const value = mine[0]?.valueId ?? "";
          return (
            <FieldSet key={g.id} data-invalid={!!error}>
              <FieldLegend variant="label" className="text-base">
                {g.name}
                {g.required ? "" : " (optional)"}
              </FieldLegend>
              <RadioGroup
                aria-describedby={describedBy}
                aria-invalid={!!error}
                value={value || (g.required ? "" : "none")}
                onValueChange={(key) => {
                  const v = g.values.find((x) => x.id === key);
                  onChange([...others(g), ...(v ? [copyOf(g, v)] : [])]);
                }}
                className="gap-2"
              >
                {[...g.values, ...(g.required ? [] : [{ id: "none", name: "None", priceCents: 0, usual: false, prices: {} }])].map((v, i) => (
                  <Field
                    key={v.id}
                    orientation="horizontal"
                    className="items-center rounded-xl border border-border px-3 py-2.5 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                  >
                    <RadioGroupItem id={i === 0 ? id(`option-${g.id}`) : id(`option-${g.id}-${v.id}`)} value={v.id} />
                    <FieldLabel htmlFor={i === 0 ? id(`option-${g.id}`) : id(`option-${g.id}-${v.id}`)} className="flex w-full items-baseline justify-between gap-3 text-base">
                      <span>{v.name}</span>
                      <span className="shrink-0 text-sm text-muted-foreground">{plus(amountOf(g, v), g.priceByVariation && !variationId)}</span>
                    </FieldLabel>
                  </Field>
                ))}
              </RadioGroup>
              {error && <FieldError id={id(`option-${g.id}-error`)}>{error}</FieldError>}
            </FieldSet>
          );
        }
        return (
          <FieldSet key={g.id}>
            <FieldLegend variant="label" className="text-base">
              {g.name} (choose any)
            </FieldLegend>
            <div className="space-y-2">
              {g.values.map((v, i) => {
                const checked = mine.some((o) => o.valueId === v.id);
                const fieldId = i === 0 ? id(`option-${g.id}`) : id(`option-${g.id}-${v.id}`);
                return (
                  <Field
                    key={v.id}
                    orientation="horizontal"
                    className="items-center rounded-xl border border-border px-3 py-2.5 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                  >
                    <Checkbox
                      id={fieldId}
                      checked={checked}
                      onCheckedChange={(on) => {
                        // Keep the product's order for the ticked ones.
                        const ticked = new Set(mine.map((o) => o.valueId));
                        if (on === true) ticked.add(v.id);
                        else ticked.delete(v.id);
                        onChange([...others(g), ...g.values.filter((x) => ticked.has(x.id)).map((x) => copyOf(g, x))]);
                      }}
                    />
                    <FieldLabel htmlFor={fieldId} className="flex w-full items-baseline justify-between gap-3 text-base">
                      <span>{v.name}</span>
                      <span className="shrink-0 text-sm text-muted-foreground">{plus(amountOf(g, v), g.priceByVariation && !variationId)}</span>
                    </FieldLabel>
                  </Field>
                );
              })}
            </div>
          </FieldSet>
        );
      })}

      {kept.length > 0 && (
        <section className="space-y-2" aria-labelledby={id("kept-options")}>
          <p id={id("kept-options")} className="text-base font-medium">
            Kept as they were
          </p>
          <p className="text-sm text-muted-foreground">These are no longer on the product. They stay on this item until you remove them.</p>
          <ul className="space-y-2">
            {kept.map((o, i) => (
              <li key={`${o.groupId}-${o.valueId}-${i}`} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
                <span className="text-base">
                  {o.group}: {o.kind === "text" ? `“${o.text}”` : o.value}
                  {o.amountCents > 0 && <span className="block text-sm text-muted-foreground">{plus(o.amountCents)}</span>}
                </span>
                <Button type="button" variant="ghost" className="text-destructive" onClick={() => onChange(chosen.filter((x) => x !== o))}>
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

/** What a value adds on an item: its price for the item's variation when the option is priced by variation. */
export function optionValueAmount(g: OptionGroup, v: OptionGroup["values"][number], variationId: string | undefined): number {
  if (g.priceByVariation && variationId && v.prices[variationId] !== undefined) return v.prices[variationId];
  return v.priceCents;
}

/** The options chosen on an item, with the amounts for its variation (after the variation changes). */
export function repriceOptions(groups: readonly OptionGroup[], chosen: readonly LineOption[], variationId: string | undefined): LineOption[] {
  return chosen.map((o) => {
    const g = groups.find((x) => x.id === o.groupId && x.kind === o.kind);
    const v = g?.priceByVariation ? g.values.find((x) => x.id === o.valueId) : undefined;
    return g && v ? { ...o, amountCents: optionValueAmount(g, v, variationId) } : o;
  });
}

/** What is missing on an item: each required option with nothing chosen or typed. */
export function missingOptions(groups: readonly OptionGroup[], chosen: readonly LineOption[]): Record<string, string> {
  const missing: Record<string, string> = {};
  for (const g of groups) {
    if (!g.required) continue;
    const has = chosen.some(
      (o) => o.groupId === g.id && o.kind === g.kind && (g.kind === "text" ? o.text.trim() !== "" : g.values.some((v) => v.id === o.valueId)),
    );
    if (!has) missing[g.id] = g.kind === "text" ? `Type the ${g.name.toLowerCase()}.` : `Choose a ${g.name.toLowerCase()}.`;
  }
  return missing;
}
