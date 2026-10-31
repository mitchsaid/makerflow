"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ChoiceCards } from "@/components/choice-cards";
import { SelectField, TextAreaField } from "@/components/form-fields";
import { AddButton } from "@/components/add-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAppRouter } from "@/components/use-app-router";
import {
  COLUMN_LABELS,
  guessMapping,
  IMPORT_MAX_ROWS,
  parseDelimited,
  readRows,
  type ColumnKey,
  type Mapping,
  type Table,
} from "@/lib/import/products";
import { formatMoney, type NumberStyle } from "@/lib/money";
import { FOUND_LIST_KEY } from "@/lib/reader";
import type { ProductKind } from "@/lib/products";
import { importProducts } from "./actions";

const MAX_FILE_BYTES = 1_000_000;
const OFFLINE = "Couldn't reach the server, so nothing was added. Try again.";
const TRIM = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

type Step = "paste" | "columns" | "check";

/**
 * Bringing in a list of products (docs/plans/import-onboarding.md, slice 1): paste it or choose a file, check which
 * column is which, check every product, then add the ticked ones. The file is read here in the browser and is not
 * uploaded; only the checked products go to the server, which checks them again.
 */
export function ImportProducts({
  fromDocument,
  initialKind,
  currencyCode,
  currencySymbol,
  numberStyle,
  existingNames,
  priceNote,
}: {
  /** Arrived from reading a document: its items wait in this tab, and go into the box to be checked like any list. */
  fromDocument: boolean;
  initialKind: ProductKind;
  currencyCode: string;
  currencySymbol: string;
  numberStyle: NumberStyle;
  /** The names of the products the business has, in the form `nameKey` gives. */
  existingNames: string[];
  /** How prices are read for a business that charges VAT ("the way you enter prices: including VAT"), or null. */
  priceNote: string | null;
}) {
  const router = useAppRouter();
  const [step, setStep] = useState<Step>("paste");
  const [kind, setKind] = useState<ProductKind>(initialKind);
  const [text, setText] = useState("");
  const [pasteError, setPasteError] = useState<string | undefined>();
  const [table, setTable] = useState<Table>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<Mapping>({});
  const [columnErrors, setColumnErrors] = useState<Partial<Record<ColumnKey, string>>>({});
  const [unticked, setUnticked] = useState<ReadonlySet<number>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (!fromDocument) return;
    try {
      const found = sessionStorage.getItem(FOUND_LIST_KEY);
      if (found) {
        sessionStorage.removeItem(FOUND_LIST_KEY);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reading what another page left for this one, once
        setText(found);
      }
    } catch {
      // No storage: the box is just empty.
    }
  }, [fromDocument]);
  const existing = useMemo(() => new Set(existingNames), [existingNames]);

  const rows = useMemo(
    () => (step === "check" ? readRows(table, hasHeader, mapping, { kind, currency: { symbol: currencySymbol, code: currencyCode }, existingNames: existing }) : []),
    [step, table, hasHeader, mapping, kind, currencySymbol, currencyCode, existing],
  );
  const ready = rows.filter((r) => !r.problem);
  const chosen = ready.filter((r) => !unticked.has(r.line));

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setPasteError("That file is too big. A list of up to 200 products is well under 1 MB; export just the products and try again.");
      return;
    }
    setText(await file.text());
    setPasteError(undefined);
  }

  function toColumns() {
    const parsed = parseDelimited(text);
    if (parsed.length === 0) {
      setPasteError("Paste your list or choose a file first. Each row needs a name and a price.");
      return;
    }
    const guess = guessMapping(parsed);
    const dataRows = guess.hasHeader ? parsed.length - 1 : parsed.length;
    if (dataRows === 0) {
      setPasteError("There is only a heading row. Add the products under it.");
      return;
    }
    if (dataRows > IMPORT_MAX_ROWS) {
      setPasteError(`That is ${dataRows} rows. Add up to ${IMPORT_MAX_ROWS} at a time: split the list and import it in parts.`);
      return;
    }
    setTable(parsed);
    setHasHeader(guess.hasHeader);
    setMapping(guess.mapping);
    setPasteError(undefined);
    setColumnErrors({});
    setStep("columns");
  }

  function toCheck() {
    const errors: Partial<Record<ColumnKey, string>> = {};
    if (mapping.name === undefined) errors.name = "Choose which column has the name.";
    if (mapping.price === undefined) errors.price = "Choose which column has the price.";
    else if (mapping.name === mapping.price) errors.price = "The price can't be in the same column as the name.";
    if (errors.name || errors.price) return setColumnErrors(errors);
    setColumnErrors({});
    setUnticked(new Set());
    setMessage(null);
    setStep("check");
  }

  function add() {
    if (chosen.length === 0) {
      setMessage("Tick at least one product to add.");
      return;
    }
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await importProducts(chosen.map((r) => ({ kind: r.kind, name: r.name, priceCents: r.priceCents!, unit: r.unit, description: r.description })));
        if (result.status === "error") {
          setMessage(result.message);
          return;
        }
        const view = chosen.every((r) => r.kind === "service") ? "&view=services" : "";
        router.push(`/app/products?imported=${result.added}${result.failed.length > 0 ? `&failed=${result.failed.length}` : ""}${view}`);
      } catch {
        setMessage(OFFLINE);
      }
    });
  }

  if (step === "paste") {
    return (
      <form
        className="space-y-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          toColumns();
        }}
      >
        <ChoiceCards
          legend="What is on this list?"
          value={kind}
          onChange={setKind}
          idFor={(v) => `import-kind-${v}`}
          choices={[
            { value: "product", title: "Products" },
            { value: "service", title: "Services" },
          ]}
        />
        <TextAreaField
          id="import-text"
          label="Your list"
          hint="Paste rows from a spreadsheet: a name and a price on each row."
          rows={8}
          value={text}
          error={pasteError}
          onChange={(v) => {
            setText(v);
            setPasteError(undefined);
          }}
        />
        <Field>
          <FieldLabel htmlFor="import-file">Or choose a file (CSV)</FieldLabel>
          <Input id="import-file" type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain" onChange={(e) => void chooseFile(e.target.files?.[0])} />
        </Field>
        <Button type="submit" size="lg" className="w-full">
          Continue
        </Button>
      </form>
    );
  }

  if (step === "columns") {
    const first = table[0] ?? [];
    const labels: Record<string, string> = {};
    const values = first.map((_, i) => {
      const sample = (hasHeader ? table[1] : table[0])?.[i] ?? "";
      labels[String(i)] = `${hasHeader && first[i] ? TRIM(first[i]!, 28) : `Column ${i + 1}`}${sample ? ` (${TRIM(sample, 20)})` : ""}`;
      return String(i);
    });
    const select = (key: ColumnKey, optional: boolean, hint?: string) => (
      <SelectField
        id={`import-col-${key}`}
        label={COLUMN_LABELS[key]}
        hint={hint}
        value={mapping[key] === undefined ? "" : String(mapping[key])}
        placeholder={optional ? "Not in my list" : "Choose a column"}
        options={values}
        optionLabels={labels}
        error={columnErrors[key]}
        onChange={(v) => {
          setMapping((m) => {
            const next = { ...m };
            if (v === "") delete next[key];
            else next[key] = Number(v);
            return next;
          });
          setColumnErrors({});
        }}
      />
    );
    return (
      <form
        className="space-y-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          toCheck();
        }}
      >
        <p className="text-base text-muted-foreground">Which column is which? We guessed from the first row; change any that are wrong.</p>
        <Field orientation="horizontal" className="items-center">
          <Checkbox id="import-header" checked={hasHeader} onCheckedChange={(c) => setHasHeader(c === true)} />
          <FieldLabel htmlFor="import-header">The first row is headings</FieldLabel>
        </Field>
        {select("name", false)}
        {select("price", false, priceNote ?? undefined)}
        {select("unit", true)}
        {select("description", true)}
        {select("type", true, "A column that says Service, or Product, for each row.")}
        <div className="flex flex-col gap-3">
          <Button type="submit" size="lg">
            Check the products
          </Button>
          <Button type="button" size="lg" variant="outline" onClick={() => setStep("paste")}>
            Back
          </Button>
        </div>
      </form>
    );
  }

  const leftOut = rows.length - ready.length;
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-base font-medium" data-testid="import-summary">
          {ready.length === 1 ? "1 product is ready to add" : `${ready.length} products are ready to add`}
          {leftOut > 0 ? `, ${leftOut} left out` : ""}.
        </p>
        {priceNote && <p className="text-sm text-muted-foreground">{priceNote}</p>}
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.line} className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10" data-testid={r.problem ? "import-row-problem" : "import-row"}>
            <div className="flex items-start gap-3">
              {!r.problem && (
                <Checkbox
                  id={`import-row-${r.line}`}
                  aria-label={`Add ${r.name}`}
                  checked={!unticked.has(r.line)}
                  onCheckedChange={(c) =>
                    setUnticked((s) => {
                      const next = new Set(s);
                      if (c === true) next.delete(r.line);
                      else next.add(r.line);
                      return next;
                    })
                  }
                />
              )}
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-base font-medium">{r.name || `Row ${r.line}`}</span>
                  {r.priceCents !== null && <span className="shrink-0 text-base">{formatMoney(r.priceCents, currencyCode, numberStyle)}{r.unit ? ` / ${r.unit}` : ""}</span>}
                </div>
                {r.kind === "service" && <p className="text-sm text-muted-foreground">Service</p>}
                {r.description && <p className="truncate text-sm text-muted-foreground">{r.description}</p>}
                {r.problem && <p className="text-sm text-destructive">{r.problem}</p>}
                {!r.problem && r.note && <p className="text-sm text-muted-foreground">{r.note}</p>}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {message && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-3">
        <AddButton variant="default" size="lg" disabled={pending} onClick={add}>
          {pending ? "Adding…" : chosen.length === 1 ? "Add 1 product" : `Add ${chosen.length} products`}
        </AddButton>
        <Button type="button" size="lg" variant="outline" disabled={pending} onClick={() => setStep("columns")}>
          Back
        </Button>
      </div>
    </div>
  );
}
