"use client";

import { useEffect, useRef, useState } from "react";
import { Section, SelectField, TextField } from "@/components/form-fields";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { EXTRAS_MAX, usedOnWords, type ExtraErrors, type ExtraFormRow } from "@/lib/products/extras";
import { listSharedExtras, type SharedExtraChoice } from "./extras-actions";

// New keys come from one counter that is never reset (the form keeps rows by key).
let keyCounter = 0;
const nextKey = () => `extra-${(keyCounter += 1)}`;

/**
 * "Extras" (docs/plans/product-extras.md): what people can add to a product, like gift wrap or engraving. An
 * extra is a name, a price and an optional "Ask for wording". It is saved once for every product (one price
 * everywhere) or is for this product only (its own price, which can differ by size). Adding one offers the
 * business's saved extras first. Each is a card; one is open at a time, and any with a problem stays open so
 * the summary can take the person to it.
 */
export function ExtrasSection({
  rows,
  errors,
  variations,
  variationWord,
  priceLabel,
  currencySymbol,
  fid,
  onChange,
}: {
  rows: ExtraFormRow[];
  errors: ExtraErrors | undefined;
  /** The product's variations (named ones), for extras that cost more on a bigger size. */
  variations: { key: string; name: string }[];
  /** The maker's word for them ("Size"). */
  variationWord: string;
  priceLabel: string;
  currencySymbol: string;
  fid: (key: string) => string;
  onChange: (rows: ExtraFormRow[]) => void;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  // The picker of saved extras: null while closed.
  const [picker, setPicker] = useState<SharedExtraChoice[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingFocus.current) return;
    document.getElementById(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  });

  const setRow = (key: string, change: Partial<ExtraFormRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...change } : r)));

  function addNew() {
    const row: ExtraFormRow = { key: nextKey(), id: "", name: "", price: "", asksForWording: false, textMax: "", shared: true, usedOn: 0 };
    onChange([...rows, row]);
    setPicker(null);
    setOpenKey(row.key);
    pendingFocus.current = fid(`extra-${row.key}-name`);
  }

  function addSaved(x: SharedExtraChoice) {
    const row: ExtraFormRow = {
      key: nextKey(),
      id: x.id,
      name: x.name,
      price: x.price,
      asksForWording: x.asksForWording,
      textMax: x.textMax === 100 ? "" : String(x.textMax),
      shared: true,
      // The products that have it now, and this one.
      usedOn: x.usedOn + 1,
    };
    onChange([...rows, row]);
    setPicker(null);
    pendingFocus.current = fid("add-extra");
  }

  async function startAdding() {
    setMessage(null);
    setLoading(true);
    try {
      const result = await listSharedExtras();
      if (result.status === "error") {
        setMessage(result.message);
        return;
      }
      // Saved extras this product does not have yet. With none to offer, go straight to a new one.
      const onThis = new Set(rows.map((r) => r.id).filter(Boolean));
      const offer = result.extras.filter((x) => !onThis.has(x.id));
      if (offer.length === 0) addNew();
      else setPicker(offer);
    } catch {
      setMessage("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Section title="Extras">
      <p className="text-base text-muted-foreground">What can people add? Like gift wrap or engraving. Each has its own price.</p>

      {rows.length > 0 && (
        <ol className="space-y-3">
          {rows.map((x, xi) => {
            const e = errors?.rows[x.key];
            const open = openKey === x.key || e !== undefined;
            const title = x.name.trim() || `Extra ${xi + 1}`;
            const byVariation = !x.shared && x.priceByVariation === true && variations.length > 0;
            const price = byVariation ? "price by size" : x.price.trim() === "" ? "free" : `+${currencySymbol}${x.price.trim()}`;
            const summary = [price, x.asksForWording ? "asks for wording" : null, x.shared ? "any product" : "this product only"]
              .filter(Boolean)
              .join(" · ");
            const also = x.shared ? usedOnWords(x.usedOn) : null;
            return (
              <li key={x.key} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium">{title}</p>
                    <p className="text-sm text-muted-foreground">{summary}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    aria-expanded={open}
                    aria-controls={fid(`extra-${x.key}-body`)}
                    onClick={() => setOpenKey(open ? null : x.key)}
                  >
                    {open ? "Done" : "Edit"}
                    <span className="sr-only"> {title}</span>
                  </Button>
                </div>
                {open && (
                  <div id={fid(`extra-${x.key}-body`)} className="mt-3 space-y-4">
                    <TextField
                      id={fid(`extra-${x.key}-name`)}
                      label="Extra name"
                      hint="Like “Gift wrap” or “Engraving”."
                      autoComplete="off"
                      maxLength={80}
                      value={x.name}
                      error={e?.name}
                      onChange={(name) => setRow(x.key, { name })}
                    />
                    {byVariation ? (
                      <div className="space-y-2">
                        <p className="text-base font-medium">What it adds</p>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                          {variations.map((variation) => (
                            <div key={variation.key} className="space-y-1">
                              <span aria-hidden="true" className="block text-sm text-muted-foreground">
                                {variation.name}
                              </span>
                              <TextField
                                id={fid(`extra-${x.key}-price-${variation.key}`)}
                                label={`${title} adds for ${variation.name}`}
                                labelHidden
                                startText={`+${currencySymbol}`}
                                inputMode="decimal"
                                autoComplete="off"
                                value={x.prices?.[variation.key] ?? ""}
                                error={e?.prices?.[variation.key]}
                                onChange={(p) => setRow(x.key, { prices: { ...(x.prices ?? {}), [variation.key]: p } })}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <TextField
                        id={fid(`extra-${x.key}-price`)}
                        label={priceLabel}
                        hint="Leave empty if it's free."
                        startText={currencySymbol}
                        inputMode="decimal"
                        autoComplete="off"
                        value={x.price}
                        error={e?.price}
                        onChange={(p) => setRow(x.key, { price: p })}
                      />
                    )}

                    <Field orientation="horizontal" className="items-start py-1">
                      <Checkbox
                        id={fid(`extra-${x.key}-wording`)}
                        checked={x.asksForWording}
                        onCheckedChange={(checked) => setRow(x.key, { asksForWording: checked === true })}
                      />
                      <FieldLabel htmlFor={fid(`extra-${x.key}-wording`)} className="text-base">
                        Ask for wording
                      </FieldLabel>
                    </Field>
                    <FieldDescription>You type what it should say when you quote it, like what to engrave.</FieldDescription>
                    {x.asksForWording && (
                      <TextField
                        id={fid(`extra-${x.key}-textMax`)}
                        label="Longest (optional)"
                        hint="Leave empty for up to 100 characters."
                        inputMode="numeric"
                        autoComplete="off"
                        value={x.textMax}
                        error={e?.textMax}
                        onChange={(textMax) => setRow(x.key, { textMax })}
                      />
                    )}

                    <SelectField
                      id={fid(`extra-${x.key}-shared`)}
                      label="Where does it apply?"
                      value={x.shared ? "" : "only"}
                      placeholder="Any product: one price everywhere"
                      options={["only"]}
                      optionLabels={{ only: "This product only" }}
                      hint={
                        x.shared
                          ? (also ?? "Other products can use it too, with this price.")
                          : "Its own price here, and it can cost more on a bigger size."
                      }
                      onChange={(v) => setRow(x.key, v === "only" ? { shared: false } : { shared: true, priceByVariation: false })}
                    />
                    {!x.shared && variations.length > 0 && (
                      <>
                        <Field orientation="horizontal" className="items-start py-1">
                          <Checkbox
                            id={fid(`extra-${x.key}-byVariation`)}
                            checked={x.priceByVariation === true}
                            onCheckedChange={(checked) =>
                              setRow(x.key, {
                                priceByVariation: checked === true,
                                // Each size starts with the price as it was, so nothing becomes free by surprise.
                                prices:
                                  checked === true
                                    ? Object.fromEntries(variations.map((v) => [v.key, x.prices?.[v.key]?.trim() ? x.prices[v.key] : x.price.trim() || "0"]))
                                    : x.prices,
                              })
                            }
                          />
                          <FieldLabel htmlFor={fid(`extra-${x.key}-byVariation`)} className="text-base">
                            Price depends on the {variationWord.toLowerCase()}
                          </FieldLabel>
                        </Field>
                      </>
                    )}

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          onChange(rows.filter((r) => r.key !== x.key));
                          setOpenKey(null);
                          pendingFocus.current = fid("add-extra");
                        }}
                      >
                        Remove this extra<span className="sr-only">: {title}</span>
                      </Button>
                    </div>
                    {x.shared && also && <p className="text-sm text-muted-foreground">Removing it takes it off this product only.</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {errors?.list && (
        <p id={fid("extras-error")} tabIndex={-1} className="text-sm text-destructive">
          {errors.list}
        </p>
      )}
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}

      {picker ? (
        <div role="group" aria-label="Add an extra" className="space-y-2">
          <p className="text-base font-medium">One you already have, or a new one?</p>
          <ul className="space-y-2">
            {picker.map((x) => (
              <li key={x.id}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto w-full justify-between gap-3 whitespace-normal p-3 text-left font-normal"
                  onClick={() => addSaved(x)}
                >
                  <span className="text-base font-medium">{x.name}</span>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {x.free ? "free" : `+${x.priceText}`}
                    {x.asksForWording ? " · asks for wording" : ""}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={addNew}>
              Make a new extra
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPicker(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        rows.length < EXTRAS_MAX && (
          <Button id={fid("add-extra")} type="button" variant="outline" className="self-start" disabled={loading} onClick={startAdding}>
            {loading ? "Looking…" : "Add an extra"}
          </Button>
        )
      )}
    </Section>
  );
}
