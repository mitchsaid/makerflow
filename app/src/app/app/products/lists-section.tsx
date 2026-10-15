"use client";

import { useEffect, useRef, useState } from "react";
import { SelectField, TextField } from "@/components/form-fields";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Trash2Icon } from "lucide-react";
import { ChoiceImage } from "@/components/choice-image";
import { Button } from "@/components/ui/button";
import {
  OPTIONS_MAX,
  type OptionErrors,
  type OptionGroupFormRow,
  type OptionValueFormRow,
} from "@/lib/products/options";
import { AddButton } from "@/components/add-button";

// New keys come from one counter that is never reset: the lists move (and remount) when sizes are added or removed.
let keyCounter = 0;
const nextKey = (prefix: string) => `${prefix}-${(keyCounter += 1)}`;

/**
 * The further variations, added under the first one with "Add another variation": the ones that do not carry the price,
 * like Flavour or Colour (docs/plans/product-extras.md). You pick one of their choices, each can add an amount to
 * the price (R0 is common), and an amount can be bigger on a bigger size. (The first variation, where each choice
 * has its own price, is above them in the same "Variations" section.)
 * Each is a card; one is open at a time, and any with a problem stays open so the summary can take the person to it.
 */
export function ListsSection({
  groups,
  errors,
  currencySymbol,
  variations,
  variationWord,
  firstNumber,
  fid,
  onPendingChange,
  onImage,
  onChange,
}: {
  groups: OptionGroupFormRow[];
  /** The product's variations (named ones), for choices whose price depends on them. */
  variations: { key: string; name: string }[];
  /** The maker's word for them ("Size"). */
  variationWord: string;
  /** The number of the first one here, for the name it gets when it has none ("Variation 2": the first variation is 1). */
  firstNumber: number;
  errors: OptionErrors | undefined;
  currencySymbol: string;
  fid: (key: string) => string;
  /** A choice's picture is on its way (true) or has arrived (false), so the form can wait for it before saving. */
  onPendingChange: (pending: boolean) => void;
  /** A choice's picture chosen or removed. The form applies it by keys to what the form holds now. */
  onImage: (groupKey: string, valueKey: string, imageId: string) => void;
  onChange: (groups: OptionGroupFormRow[]) => void;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  // What went wrong with a choice's picture, by choice.
  const [problems, setProblems] = useState<Record<string, string>>({});
  const setProblem = (key: string, message: string | null) =>
    setProblems((p) => {
      const rest = { ...p };
      delete rest[key];
      return message ? { ...rest, [key]: message } : rest;
    });
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingFocus.current) return;
    document.getElementById(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  });

  const setGroup = (key: string, change: Partial<OptionGroupFormRow>) =>
    onChange(groups.map((g) => (g.key === key ? { ...g, ...change } : g)));
  const blankValue = (): OptionValueFormRow => ({ key: nextKey("value"), id: "", name: "", price: "", usual: false });

  function add() {
    const group: OptionGroupFormRow = {
      key: nextKey("variation"),
      id: "",
      name: "",
      kind: "one",
      values: [blankValue(), blankValue()],
    };
    onChange([...groups, group]);
    setOpenKey(group.key);
    pendingFocus.current = fid(`option-${group.key}-name`);
  }

  return (
    <>
      {groups.length > 0 && (
        <ol className="space-y-3">
          {groups.map((g, gi) => {
            const e = errors?.groups[g.key];
            const open = openKey === g.key || e !== undefined;
            const byVariation = g.priceByVariation === true && variations.length > 0;
            const title = g.name.trim() || `Variation ${gi + firstNumber}`;
            const summary = `${g.values.length} ${g.values.length === 1 ? "choice" : "choices"} · can add to the price`;
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
                      label="Name of this variation"
                      placeholder={`Variation ${gi + firstNumber}`}
                      hint="Like “Flavour”."
                      autoComplete="off"
                      maxLength={80}
                      value={g.name}
                      error={e?.name}
                      onChange={(v) => setGroup(g.key, { name: v })}
                    />
                    {variations.length > 0 && (
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
                    {/* Each choice: its picture, its name and a remove button, then what it adds (or, priced by size, a
                        price for each size) and a way to remove the picture. */}
                    <div className="space-y-2">
                      <ol className="space-y-4">
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
                          const picture = v.imageId ?? "";
                          const problem = problems[v.key];
                          const setValue = (imageId: string) => onImage(g.key, v.key, imageId);
                          const removePicture = (
                            <Button type="button" variant="outline" onClick={() => setValue("")}>
                              Remove picture<span className="sr-only"> of {vTitle}</span>
                            </Button>
                          );
                          const nameField = (
                            <TextField
                              id={fid(`option-${g.key}-value-${v.key}-name`)}
                              label={`${title}: choice ${vi + 1}`}
                              labelHidden
                              placeholder="Name"
                              autoComplete="off"
                              maxLength={80}
                              value={v.name}
                              error={ve?.name}
                              onChange={(name) => setGroup(g.key, { values: g.values.map((x) => (x.key === v.key ? { ...x, name } : x)) })}
                            />
                          );
                          return (
                            <li key={v.key} className="grid grid-cols-[2.75rem_1fr_2.75rem] items-start gap-x-2 gap-y-2">
                              <ChoiceImage
                                id={fid(`option-${g.key}-value-${v.key}-image`)}
                                label={vTitle}
                                value={picture}
                                onChange={(imageId) => {
                                  setProblem(v.key, null);
                                  setValue(imageId);
                                }}
                                onProblem={(message) => setProblem(v.key, message)}
                                onPendingChange={onPendingChange}
                              />
                              {nameField}
                              {remove}
                              {byVariation ? (
                                <div className="col-span-2 col-start-2 grid grid-cols-2 gap-x-3 gap-y-2">
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
                              ) : (
                                <div className="col-span-2 col-start-2 flex items-start gap-2">
                                  <div className="w-40">
                                    <TextField
                                      id={fid(`option-${g.key}-value-${v.key}-price`)}
                                      label={`${title}: choice ${vi + 1} adds`}
                                      labelHidden
                                      placeholder="Adds"
                                      startText={`+${currencySymbol}`}
                                      inputMode="decimal"
                                      autoComplete="off"
                                      value={v.price}
                                      error={ve?.price}
                                      onChange={(price) => setGroup(g.key, { values: g.values.map((x) => (x.key === v.key ? { ...x, price } : x)) })}
                                    />
                                  </div>
                                  {picture !== "" && removePicture}
                                </div>
                              )}
                              {byVariation && picture !== "" && <div className="col-span-2 col-start-2">{removePicture}</div>}
                              {problem && (
                                <p role="alert" className="col-span-2 col-start-2 text-sm text-destructive">
                                  {problem}
                                </p>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                    {e?.values && <p className="text-sm text-destructive">{e.values}</p>}
                    <p className="text-sm text-muted-foreground">One is always chosen. To make it optional, add a choice like “None”.</p>
                    <AddButton
                      id={fid(`option-${g.key}-add-value`)}
                      className="self-start"
                      onClick={() => {
                        const value = blankValue();
                        setGroup(g.key, { values: [...g.values, value] });
                        pendingFocus.current = fid(`option-${g.key}-value-${value.key}-name`);
                      }}
                    >
                      Add a choice<span className="sr-only"> to {title}</span>
                    </AddButton>
                    <SelectField
                      id={fid(`option-${g.key}-usual`)}
                      label={`Default ${title.toLowerCase()}`}
                      hint="Chosen for you on a quote. Without one, it's chosen each time."
                      value={g.values.find((x) => x.usual && x.name.trim() !== "")?.key ?? ""}
                      placeholder="No default"
                      options={g.values.filter((x) => x.name.trim() !== "").map((x) => x.key)}
                      optionLabels={Object.fromEntries(g.values.map((x) => [x.key, x.name.trim()]))}
                      onChange={(key) => setGroup(g.key, { values: g.values.map((x) => ({ ...x, usual: x.key === key })) })}
                    />

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => {
                          onChange(groups.filter((x) => x.key !== g.key));
                          setOpenKey(null);
                          pendingFocus.current = fid("add-variation");
                        }}
                      >
                        Remove this variation<span className="sr-only">: {title}</span>
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {/* About the lists as a whole (too many, or unreadable): the summary jumps here. */}
      {errors?.list && (
        <p id={fid("options-error")} tabIndex={-1} className="text-sm text-destructive">
          {errors.list}
        </p>
      )}

      {groups.length < OPTIONS_MAX && (
        <AddButton id={fid("add-variation")} className="self-start" onClick={add}>
          Add another variation
        </AddButton>
      )}
    </>
  );
}
