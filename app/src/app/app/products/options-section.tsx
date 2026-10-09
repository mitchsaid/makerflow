"use client";

import { useEffect, useRef, useState } from "react";
import { Section, SelectField, TextField } from "@/components/form-fields";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
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
 * "Options and extras" (docs/plans/product-choices.md): choose one (Flavour), choose any (Extras) or type
 * something (Message on the cake). Each option is a card; one is open at a time, and any with a problem
 * stays open so the summary can take the person to it.
 */
export function OptionsSection({
  groups,
  errors,
  priceLabel,
  currencySymbol,
  variations,
  variationWord,
  fid,
  onChange,
}: {
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
  const newKey = (prefix: string) => `${prefix}-${(counter.current += 1)}`;
  useEffect(() => {
    if (!pendingFocus.current) return;
    document.getElementById(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  });

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
      charge: "item",
      textPrice: "",
      textMax: String(OPTION_TEXT_DEFAULT),
      values: kind === "text" ? [] : [blankValue(), blankValue()],
    };
    onChange([...groups, group]);
    setChoosingKind(false);
    setOpenKey(group.key);
    pendingFocus.current = fid(`option-${group.key}-name`);
  }

  return (
    <Section title="Options and extras">
      <p className="text-base text-muted-foreground">
        Choices like flavour, extras like gold leaf or a gift box, or a message on the cake. Each can add to the price.
      </p>

      {groups.length > 0 && (
        <ol className="space-y-3">
          {groups.map((g, gi) => {
            const e = errors?.groups[g.key];
            const open = openKey === g.key || e !== undefined;
            const byVariation = g.kind !== "text" && g.priceByVariation === true && variations.length > 0;
            const title = g.name.trim() || `Option ${gi + 1}`;
            const summary = `${OPTION_KIND_WORDS[g.kind].title}${g.kind === "text" ? "" : ` · ${g.values.length} ${g.values.length === 1 ? "choice" : "choices"}`}${g.charge === "line" ? " · once per line" : ""}`;
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
                      label="Option name"
                      hint={g.kind === "text" ? "Like “Message on the cake”." : g.kind === "one" ? "Like “Flavour”." : "Like “Extras”."}
                      autoComplete="off"
                      maxLength={80}
                      value={g.name}
                      error={e?.name}
                      onChange={(v) => setGroup(g.key, { name: v })}
                    />
                    <SelectField
                      id={fid(`option-${g.key}-kind`)}
                      label="Kind"
                      value={g.kind === "one" ? "" : g.kind}
                      placeholder={OPTION_KIND_WORDS.one.title}
                      options={["any", "text"]}
                      optionLabels={{ any: OPTION_KIND_WORDS.any.title, text: OPTION_KIND_WORDS.text.title }}
                      hint={OPTION_KIND_WORDS[g.kind].hint}
                      onChange={(v) => {
                        const kind: OptionKind = v === "any" ? "any" : v === "text" ? "text" : "one";
                        setGroup(g.key, {
                          kind,
                          required: kind === "any" ? false : g.required,
                          values: kind === "text" ? [] : g.values.length > 0 ? g.values : [blankValue(), blankValue()],
                        });
                      }}
                    />
                    {g.kind !== "text" && variations.length > 0 && (
                      <Field orientation="horizontal" className="items-start py-1">
                        <Checkbox
                          id={fid(`option-${g.key}-byVariation`)}
                          checked={g.priceByVariation === true}
                          onCheckedChange={(checked) => setGroup(g.key, { priceByVariation: checked === true })}
                        />
                        <FieldLabel htmlFor={fid(`option-${g.key}-byVariation`)} className="text-base">
                          Price depends on the {variationWord.toLowerCase()}
                        </FieldLabel>
                      </Field>
                    )}
                    {g.kind !== "any" && (
                      <Field orientation="horizontal" className="items-start py-1">
                        <Checkbox
                          id={fid(`option-${g.key}-required`)}
                          checked={g.required}
                          onCheckedChange={(checked) => setGroup(g.key, { required: checked === true })}
                        />
                        <FieldLabel htmlFor={fid(`option-${g.key}-required`)} className="text-base">
                          {g.kind === "text" ? "Something must be typed" : "One must be chosen"}
                        </FieldLabel>
                      </Field>
                    )}
                    <SelectField
                      id={fid(`option-${g.key}-charge`)}
                      label="How is the price added?"
                      value={g.charge === "item" ? "" : "line"}
                      placeholder="To each item (12 cupcakes: 12 times)"
                      options={["line"]}
                      optionLabels={{ line: "Once for the item line (12 cupcakes: once)" }}
                      onChange={(v) => setGroup(g.key, { charge: v === "line" ? "line" : "item" })}
                    />

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
                          label="Longest (characters)"
                          inputMode="numeric"
                          autoComplete="off"
                          value={g.textMax}
                          error={e?.textMax}
                          onChange={(v) => setGroup(g.key, { textMax: v })}
                        />
                      </div>
                    ) : (
                      <>
                        <ol className="space-y-3">
                          {g.values.map((v, vi) => {
                            const ve = e?.rows[v.key];
                            const vTitle = v.name.trim() || `${title}: choice ${vi + 1}`;
                            return (
                              <li key={v.key} className="space-y-2 rounded-lg bg-muted/40 p-2">
                                <div className={byVariation ? "space-y-3" : "grid grid-cols-[1fr_8rem] gap-3"}>
                                  <TextField
                                    id={fid(`option-${g.key}-value-${v.key}-name`)}
                                    label={`${title}: choice ${vi + 1}`}
                                    autoComplete="off"
                                    maxLength={80}
                                    value={v.name}
                                    error={ve?.name}
                                    onChange={(name) =>
                                      setGroup(g.key, { values: g.values.map((x) => (x.key === v.key ? { ...x, name } : x)) })
                                    }
                                  />
                                  {byVariation ? (
                                    <div className="grid grid-cols-2 gap-3">
                                      {variations.map((variation) => (
                                        <TextField
                                          key={variation.key}
                                          id={fid(`option-${g.key}-value-${v.key}-price-${variation.key}`)}
                                          label={`${title}: choice ${vi + 1} adds for ${variation.name}`}
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
                                      ))}
                                    </div>
                                  ) : (
                                  <TextField
                                    id={fid(`option-${g.key}-value-${v.key}-price`)}
                                    label={`${title}: choice ${vi + 1} adds`}
                                    startText={`+${currencySymbol}`}
                                    inputMode="decimal"
                                    autoComplete="off"
                                    value={v.price}
                                    error={ve?.price}
                                    onChange={(price) =>
                                      setGroup(g.key, { values: g.values.map((x) => (x.key === v.key ? { ...x, price } : x)) })
                                    }
                                  />
                                  )}
                                </div>
                                <div className="flex justify-end">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="text-destructive"
                                    onClick={() => {
                                      const next = g.values.filter((x) => x.key !== v.key);
                                      setGroup(g.key, { values: next });
                                      pendingFocus.current =
                                        next.length > 0 ? fid(`option-${g.key}-value-${next[Math.max(0, vi - 1)].key}-name`) : fid(`option-${g.key}-add-value`);
                                    }}
                                  >
                                    Remove<span className="sr-only"> {vTitle}</span>
                                  </Button>
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                        {e?.values && <p className="text-sm text-destructive">{e.values}</p>}
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
                            hint="Chosen for you on a quote. With none, it's chosen each time."
                            value={g.values.find((x) => x.usual && x.name.trim() !== "")?.key ?? ""}
                            placeholder="None"
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
                          pendingFocus.current = fid("add-option");
                        }}
                      >
                        Remove this option<span className="sr-only">: {title}</span>
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

      {choosingKind ? (
        <div role="group" aria-label="What kind of option?" className="space-y-2">
          <p className="text-base font-medium">What kind of option?</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {(["one", "any", "text"] as const).map((kind) => (
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
            Add an option
          </Button>
        )
      )}
    </Section>
  );
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
