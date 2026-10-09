"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { TextAreaField, TextField } from "@/components/form-fields";
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
  variationId,
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
  onChange: (options: LineOption[]) => void;
}) {
  const id = (part: string) => `${idPrefix}${part}`;
  const plus = (cents: number, from = false) => (cents > 0 ? `${from ? "from " : ""}+${money(cents)} each` : "");

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
    return mine.filter((o) => g.values.some((v) => v.id === o.valueId)).slice(0, 1);
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
              {g.values.map((v, i) => (
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
                        {quantity === null ? plus(amount, from) : `${quantity / 1000} × ${money(amount)}`}
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
                      <TextField
                        id={id(`extra-${x.id}-quantity`)}
                        label={`${x.name}: how many (optional)`}
                        hint="Leave empty for one for each item."
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={6}
                        value={quantity === null ? "" : String(quantity / 1000)}
                        onChange={(text) => {
                          const digits = text.replace(/\D/g, "");
                          replace(entry, { ...entry, quantityMilli: digits === "" || Number(digits) < 1 ? null : Number(digits) * 1000 });
                        }}
                      />
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
          <p className="text-sm text-muted-foreground">These are no longer on the product. They stay on this item until you remove them.</p>
          <ul className="space-y-2">
            {kept.map((o, i) => (
              <li key={`${o.groupId}-${o.valueId}-${i}`} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
                <span className="text-base">
                  {o.group}: {o.kind === "text" ? `“${o.text}”` : o.value}
                  {o.amountCents > 0 && (
                    <span className="block text-sm text-muted-foreground">
                      {o.quantityMilli == null ? plus(o.amountCents) : `${o.quantityMilli / 1000} × ${money(o.amountCents)}`}
                    </span>
                  )}
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
  return chosen.map((o) => {
    if (o.kind === "one") {
      const g = groups.find((x) => x.id === o.groupId);
      const v = g?.priceByVariation ? g.values.find((x) => x.id === o.valueId) : undefined;
      return g && v ? { ...o, amountCents: optionValueAmount(g, v, variationId) } : o;
    }
    const x = extras.find((e) => e.id === o.valueId && (o.kind === "text") === e.asksForWording);
    return x?.priceByVariation ? { ...o, amountCents: extraAmount(x, variationId ?? "") } : o;
  });
}

/** What is missing on an item: each list with nothing chosen, each ticked extra that asks for wording with none typed. */
export function missingOptions(groups: readonly OptionGroup[], extras: readonly ExtraSummary[], chosen: readonly LineOption[]): Record<string, string> {
  const missing: Record<string, string> = {};
  for (const g of groups) {
    const has = chosen.some((o) => o.groupId === g.id && o.kind === "one" && g.values.some((v) => v.id === o.valueId));
    if (!has) missing[g.id] = `Choose a ${g.name.toLowerCase()}.`;
  }
  for (const x of extras) {
    if (!x.asksForWording) continue;
    const entry = chosen.find((o) => o.kind === "text" && o.valueId === x.id);
    if (entry && entry.text.trim() === "") missing[x.id] = `Type what the ${x.name.toLowerCase()} should say.`;
  }
  return missing;
}
