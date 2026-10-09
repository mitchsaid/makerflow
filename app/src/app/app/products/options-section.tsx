"use client";

import { useEffect, useRef, useState } from "react";
import { Section, SelectField, TextField } from "@/components/form-fields";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  OPTION_KIND_WORDS,
  OPTIONS_MAX,
  OPTION_TEXT_DEFAULT,
  type OptionErrors,
  type OptionGroupFormRow,
  type OptionKind,
  type OptionValueFormRow,
} from "@/lib/products/options";

/**
 * The option cards (docs/plans/product-extras.md). "lists" are the lists you pick one from, like Flavour:
 * they live inside the Variations section (`bare`: no section of their own). "extras" are the things people
 * add, like gold leaf or a message on the cake. Each is a card; one is open at a time, and any with a problem
 * stays open so the summary can take the person to it.
 */
export function OptionsSection({
  show,
  bare = false,
  hasPricedList = false,
  groups,
  errors,
  priceLabel,
  currencySymbol,
  variations,
  variationWord,
  fid,
  onChange,
}: {
  show: "lists" | "extras";
  /** Without a section of its own (the lists sit inside Variations). */
  bare?: boolean;
  /** The product has a list where each has its own price (sizes): the lists here add to that price. */
  hasPricedList?: boolean;
  groups: OptionGroupFormRow[];
  /** The product's variations (named ones), for options whose price depends on them. */
  variations: { key: string; name: string }[];
  /** The maker's word for them ("Size"). */
  variationWord: string;
  errors: OptionErrors | undefined;
  priceLabel: string;
  currencySymbol: string;
  fid: (key: string) => string;
  onChange: (groups: OptionGroupFormRow[]) => void;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [choosingKind, setChoosingKind] = useState(false);
  const pendingFocus = useRef<string | null>(null);
  const counter = useRef(0);
  // The two sections share the list of options, so their new keys must not collide.
  const newKey = (prefix: string) => `${show === "lists" ? "list-" : ""}${prefix}-${(counter.current += 1)}`;
  useEffect(() => {
    if (!pendingFocus.current) return;
    document.getElementById(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  });

  const lists = show === "lists";
  // This section's cards, in the maker's order; the others belong to the other section.
  const mine = groups.filter((g) => (g.kind === "one") === lists);
  const noun = lists ? "list" : "extra";
  const setGroup = (key: string, change: Partial<OptionGroupFormRow>) =>
    onChange(groups.map((g) => (g.key === key ? { ...g, ...change } : g)));
  const blankValue = (): OptionValueFormRow => ({ key: newKey("value"), id: "", name: "", price: "", usual: false });

  function add(kind: OptionKind) {
    const group: OptionGroupFormRow = {
      key: newKey("option"),
      id: "",
      name: "",
      kind,
      required: kind === "one",
      textPrice: "",
      textMax: "",
      values: kind === "text" ? [] : [blankValue(), blankValue()],
    };
    onChange([...groups, group]);
    setChoosingKind(false);
    setOpenKey(group.key);
    pendingFocus.current = fid(`option-${group.key}-name`);
  }

  const body = (
    <>
      {!bare && (
        <p className="text-base text-muted-foreground">
          Things people can add, like gold leaf or a gift box, or a message on the cake. Each can add to the price.
        </p>
      )}

      {mine.length > 0 && (
        <ol className="space-y-3">
          {mine.map((g, gi) => {
            const e = errors?.groups[g.key];
            const open = openKey === g.key || e !== undefined;
            const byVariation = g.kind !== "text" && g.priceByVariation === true && variations.length > 0;
            const title = g.name.trim() || `${lists ? "List" : "Extra"} ${gi + 1}`;
            const summary = lists
              ? `${g.values.length} ${g.values.length === 1 ? "choice" : "choices"}${hasPricedList ? " · adds to the price" : ""}`
              : `${OPTION_KIND_WORDS[g.kind].title}${g.kind === "text" ? "" : ` · ${g.values.length} ${g.values.length === 1 ? "choice" : "choices"}`}`;
            return (
              <li key={g.key} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium">{title}</p>
                    <p className="text-sm text-muted-foreground">{summary}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    aria-expanded={open}
                    aria-controls={fid(`option-${g.key}-body`)}
                    onClick={() => setOpenKey(open ? null : g.key)}
                  >
                    {open ? "Done" : "Edit"}
                    <span className="sr-only"> {title}</span>
                  </Button>
                </div>
                {open && (
                  <div id={fid(`option-${g.key}-body`)} className="mt-3 space-y-4">
                    <TextField
                      id={fid(`option-${g.key}-name`)}
                      label={lists ? "List name" : "Extra name"}
                      hint={g.kind === "text" ? "Like “Message on the cake”." : g.kind === "one" ? "Like “Flavour”." : "Like “Extras”."}
                      autoComplete="off"
                      maxLength={80}
                      value={g.name}
                      error={e?.name}
                      onChange={(v) => setGroup(g.key, { name: v })}
                    />
                    {g.kind !== "text" && variations.length > 0 && (
                      <Field orientation="horizontal" className="items-start py-1">
                        <Checkbox
                          id={fid(`option-${g.key}-byVariation`)}
                          checked={g.priceByVariation === true}
                          onCheckedChange={(checked) =>
                            setGroup(g.key, {
                              priceByVariation: checked === true,
                              // Each size starts with the choice's price as it was, so nothing becomes free by surprise.
                              values:
                                checked === true
                                  ? g.values.map((x) => ({
                                      ...x,
                                      prices: Object.fromEntries(
                                        variations.map((variation) => [variation.key, x.prices?.[variation.key]?.trim() ? x.prices[variation.key] : x.price.trim() || "0"]),
                                      ),
                                    }))
                                  : g.values,
                            })
                          }
                        />
                        <FieldLabel htmlFor={fid(`option-${g.key}-byVariation`)} className="text-base">
                          Price depends on the {variationWord.toLowerCase()}
                        </FieldLabel>
                      </Field>
                    )}
                    {/* "Choose one" always needs a choice ("None" makes it optional); "choose any" never does. */}
                    {g.kind === "text" && (
                      <Field orientation="horizontal" className="items-start py-1">
                        <Checkbox
                          id={fid(`option-${g.key}-required`)}
                          checked={g.required}
                          onCheckedChange={(checked) => setGroup(g.key, { required: checked === true })}
                        />
                        <FieldLabel htmlFor={fid(`option-${g.key}-required`)} className="text-base">
                          Something must be typed
                        </FieldLabel>
                      </Field>
                    )}

                    {g.kind === "text" ? (
                      <div className="grid grid-cols-2 gap-3">
                        <TextField
                          id={fid(`option-${g.key}-textPrice`)}
                          label={priceLabel.replace(/^Price/, "Price when typed")}
                          hint="Leave empty if it's free."
                          startText={currencySymbol}
                          inputMode="decimal"
                          autoComplete="off"
                          value={g.textPrice}
                          error={e?.textPrice}
                          onChange={(v) => setGroup(g.key, { textPrice: v })}
                        />
                        <TextField
                          id={fid(`option-${g.key}-textMax`)}
                          label="Longest (optional)"
                          hint={`Leave empty for up to ${OPTION_TEXT_DEFAULT} characters.`}
                          inputMode="numeric"
                          autoComplete="off"
                          value={g.textMax}
                          error={e?.textMax}
                          onChange={(v) => setGroup(g.key, { textMax: v })}
                        />
                      </div>
                    ) : (
                      <>
                        {/* One line each: the choice, what it adds and a remove button, under shared headings.
                            Priced by size: the choice's line, then a price for each size under it. */}
                        <div className="space-y-2">
                          <div
                            aria-hidden="true"
                            className={`grid items-end gap-2 text-sm font-medium ${byVariation ? "grid-cols-[1fr_2.75rem]" : "grid-cols-[1fr_7.5rem_2.75rem]"}`}
                          >
                            <span>Choice</span>
                            {!byVariation && <span>Adds</span>}
                            <span />
                          </div>
                          <ol className={byVariation ? "space-y-4" : "space-y-2"}>
                            {g.values.map((v, vi) => {
                              const ve = e?.rows[v.key];
                              const vTitle = v.name.trim() || `${title}: choice ${vi + 1}`;
                              const remove = (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive"
                                  aria-label={`Remove ${vTitle}`}
                                  onClick={() => {
                                    const next = g.values.filter((x) => x.key !== v.key);
                                    setGroup(g.key, { values: next });
                                    pendingFocus.current =
                                      next.length > 0 ? fid(`option-${g.key}-value-${next[Math.max(0, vi - 1)].key}-name`) : fid(`option-${g.key}-add-value`);
                                  }}
                                >
                                  <Trash2Icon aria-hidden="true" />
                                </Button>
                              );
                              const nameField = (
                                <TextField
                                  id={fid(`option-${g.key}-value-${v.key}-name`)}
                                  label={`${title}: choice ${vi + 1}`}
                                  labelHidden
                                  autoComplete="off"
                                  maxLength={80}
                                  value={v.name}
                                  error={ve?.name}
                                  onChange={(name) => setGroup(g.key, { values: g.values.map((x) => (x.key === v.key ? { ...x, name } : x)) })}
                                />
                              );
                              return (
                                <li key={v.key} className="space-y-2">
                                  {byVariation ? (
                                    <>
                                      <div className="grid grid-cols-[1fr_2.75rem] items-start gap-2">
                                        {nameField}
                                        {remove}
                                      </div>
                                      <div className="grid grid-cols-2 gap-x-3 gap-y-2 pl-3">
                                        {variations.map((variation) => (
                                          <div key={variation.key} className="space-y-1">
                                            <span aria-hidden="true" className="block text-sm text-muted-foreground">
                                              {variation.name}
                                            </span>
                                            <TextField
                                              id={fid(`option-${g.key}-value-${v.key}-price-${variation.key}`)}
                                              label={`${title}: choice ${vi + 1} adds for ${variation.name}`}
                                              labelHidden
                                              startText={`+${currencySymbol}`}
                                              inputMode="decimal"
                                              autoComplete="off"
                                              value={v.prices?.[variation.key] ?? ""}
                                              error={ve?.prices?.[variation.key]}
                                              onChange={(price) =>
                                                setGroup(g.key, {
                                                  values: g.values.map((x) => (x.key === v.key ? { ...x, prices: { ...(x.prices ?? {}), [variation.key]: price } } : x)),
                                                })
                                              }
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    </>
                                  ) : (
                                    <div className="grid grid-cols-[1fr_7.5rem_2.75rem] items-start gap-2">
                                      {nameField}
                                      <TextField
                                        id={fid(`option-${g.key}-value-${v.key}-price`)}
                                        label={`${title}: choice ${vi + 1} adds`}
                                        labelHidden
                                        startText={`+${currencySymbol}`}
                                        inputMode="decimal"
                                        autoComplete="off"
                                        value={v.price}
                                        error={ve?.price}
                                        onChange={(price) => setGroup(g.key, { values: g.values.map((x) => (x.key === v.key ? { ...x, price } : x)) })}
                                      />
                                      {remove}
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ol>
                        </div>
                        {e?.values && <p className="text-sm text-destructive">{e.values}</p>}
                        {g.kind === "one" && (
                          <p className="text-sm text-muted-foreground">
                            One is always chosen. To make it optional, add a choice like “None”.
                          </p>
                        )}
                        <Button
                          id={fid(`option-${g.key}-add-value`)}
                          type="button"
                          variant="outline"
                          className="self-start"
                          onClick={() => {
                            const value = blankValue();
                            setGroup(g.key, { values: [...g.values, value] });
                            pendingFocus.current = fid(`option-${g.key}-value-${value.key}-name`);
                          }}
                        >
                          Add a choice<span className="sr-only"> to {title}</span>
                        </Button>
                        {g.kind === "one" && (
                          <SelectField
                            id={fid(`option-${g.key}-usual`)}
                            label={`Usual ${title.toLowerCase()}`}
                            hint="Chosen for you on a quote. Without one, it's chosen each time."
                            value={g.values.find((x) => x.usual && x.name.trim() !== "")?.key ?? ""}
                            placeholder="No usual one"
                            options={g.values.filter((x) => x.name.trim() !== "").map((x) => x.key)}
                            optionLabels={Object.fromEntries(g.values.map((x) => [x.key, x.name.trim()]))}
                            onChange={(key) => setGroup(g.key, { values: g.values.map((x) => ({ ...x, usual: x.key === key })) })}
                          />
                        )}
                      </>
                    )}

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          onChange(groups.filter((x) => x.key !== g.key));
                          setOpenKey(null);
                          pendingFocus.current = fid(lists ? "add-list" : "add-option");
                        }}
                      >
                        Remove this {noun}<span className="sr-only">: {title}</span>
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {errors?.list && <p className="text-sm text-destructive">{errors.list}</p>}

      {lists ? (
        groups.length < OPTIONS_MAX && (
          <div className="space-y-1">
            <Button id={fid("add-list")} type="button" variant="outline" className="self-start" onClick={() => add("one")}>
              {mine.length > 0 || hasPricedList ? "Add another list" : "Add a list"}
            </Button>
            <p className="text-sm text-muted-foreground">
              A list you pick one from, like Flavour. Each choice can add to the price.
            </p>
          </div>
        )
      ) : choosingKind ? (
        <div role="group" aria-label="What kind of extra?" className="space-y-2">
          <p className="text-base font-medium">What kind of extra?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["any", "text"] as const).map((kind) => (
              <Button
                key={kind}
                type="button"
                variant="outline"
                className="h-auto flex-col items-start gap-1 whitespace-normal p-3 text-left font-normal"
                onClick={() => add(kind)}
              >
                <KindDrawing kind={kind} />
                <span className="text-base font-medium">{OPTION_KIND_WORDS[kind].title}</span>
                <span className="text-sm text-muted-foreground">{OPTION_KIND_WORDS[kind].hint}</span>
              </Button>
            ))}
          </div>
          <Button type="button" variant="ghost" onClick={() => setChoosingKind(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        groups.length < OPTIONS_MAX && (
          <Button id={fid("add-option")} type="button" variant="outline" className="self-start" onClick={() => setChoosingKind(true)}>
            Add an extra
          </Button>
        )
      )}
    </>
  );
  return bare ? <div className="space-y-4">{body}</div> : <Section title="Extras">{body}</Section>;
}

/** A small picture of each kind: dots for choose one, ticks for choose any, a box for text. */
function KindDrawing({ kind }: { kind: OptionKind }) {
  const row = (mark: React.ReactNode, width: string) => (
    <span className="flex items-center gap-1.5">
      {mark}
      <span className="h-1.5 rounded-full bg-foreground/40" style={{ width }} />
    </span>
  );
  return (
    <span aria-hidden="true" className="flex h-10 w-full flex-col justify-center gap-1">
      {kind === "text" ? (
        <span className="flex h-7 w-full items-center rounded-md border border-foreground/40 px-1.5">
          <span className="h-1.5 w-1/2 rounded-full bg-foreground/40" />
        </span>
      ) : (
        <>
          {row(<span className={`size-2.5 border border-foreground/60 ${kind === "one" ? "rounded-full bg-foreground/70" : "rounded-sm bg-foreground/70"}`} />, "60%")}
          {row(<span className={`size-2.5 border border-foreground/60 ${kind === "one" ? "rounded-full" : "rounded-sm bg-foreground/70"}`} />, "45%")}
        </>
      )}
    </span>
  );
}
