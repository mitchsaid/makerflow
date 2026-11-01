"use client";

import { useMemo, useState, useTransition } from "react";
import { SelectField, TextAreaField } from "@/components/form-fields";
import { AddButton } from "@/components/add-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAppRouter } from "@/components/use-app-router";
import {
  CUSTOMER_COLUMN_LABELS,
  guessCustomerMapping,
  IMPORT_MAX_CUSTOMERS,
  readCustomers,
  type CustomerColumn,
  type CustomerMapping,
} from "@/lib/import/customers";
import { parseDelimited, type Table } from "@/lib/import/products";
import { getLocalePack } from "@/lib/locale";
import { importCustomers } from "./actions";

const MAX_FILE_BYTES = 1_000_000;
const OFFLINE = "Couldn't reach the server, so nothing was added. Try again.";
const TRIM = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const COLUMNS = Object.keys(CUSTOMER_COLUMN_LABELS) as CustomerColumn[];

type Step = "paste" | "columns" | "check";

/**
 * Bringing in a list of customers (docs/plans/import-onboarding.md, slice 3). The same three steps as the product
 * import: paste it or choose a file, check which column is which, check every customer, then add the ticked ones.
 * The file is read here in the browser and is not uploaded; only the checked customers go to the server, which
 * checks them again. (The steps are written out again here rather than shared; a generic stepper is a follow-up.)
 */
export function ImportCustomers({ countryCode, existingNames }: { countryCode: string; existingNames: string[] }) {
  const router = useAppRouter();
  const locale = useMemo(() => getLocalePack(countryCode), [countryCode]);
  const [step, setStep] = useState<Step>("paste");
  const [text, setText] = useState("");
  const [pasteError, setPasteError] = useState<string | undefined>();
  const [table, setTable] = useState<Table>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<CustomerMapping>({});
  const [columnError, setColumnError] = useState<string | undefined>();
  const [unticked, setUnticked] = useState<ReadonlySet<number>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const existing = useMemo(() => new Set(existingNames), [existingNames]);

  const rows = useMemo(
    () => (step === "check" ? readCustomers(table, hasHeader, mapping, { locale, existingNames: existing }) : []),
    [step, table, hasHeader, mapping, locale, existing],
  );
  const ready = rows.filter((r) => !r.problem);
  const chosen = ready.filter((r) => !unticked.has(r.line));

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setPasteError("That file is too big. A list of up to 200 customers is well under 1 MB; export just the customers and try again.");
      return;
    }
    setText(await file.text());
    setPasteError(undefined);
  }

  function toColumns() {
    const parsed = parseDelimited(text);
    if (parsed.length === 0) {
      setPasteError("Paste your list or choose a file first. Each row needs a name.");
      return;
    }
    const guess = guessCustomerMapping(parsed);
    const dataRows = guess.hasHeader ? parsed.length - 1 : parsed.length;
    if (dataRows === 0) {
      setPasteError("There is only a heading row. Add the customers under it.");
      return;
    }
    if (dataRows > IMPORT_MAX_CUSTOMERS) {
      setPasteError(`That is ${dataRows} rows. Add up to ${IMPORT_MAX_CUSTOMERS} at a time: split the list and import it in parts.`);
      return;
    }
    setTable(parsed);
    setHasHeader(guess.hasHeader);
    setMapping(guess.mapping);
    setPasteError(undefined);
    setColumnError(undefined);
    setStep("columns");
  }

  function toCheck() {
    if (mapping.name === undefined) return setColumnError("Choose which column has the name.");
    setColumnError(undefined);
    setUnticked(new Set());
    setMessage(null);
    setStep("check");
  }

  function add() {
    if (chosen.length === 0) {
      setMessage("Tick at least one customer to add.");
      return;
    }
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await importCustomers(
          chosen.map((r) => ({ name: r.name, email: r.email, phone: r.phone, addressLine1: r.addressLine1, city: r.city, region: r.region, postalCode: r.postalCode, notes: r.notes })),
        );
        if (result.status === "error") {
          setMessage(result.message);
          return;
        }
        router.push(`/app/customers?imported=${result.added}`);
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
        <TextAreaField
          id="import-text"
          label="Your list"
          hint="Paste rows from a spreadsheet: a name on each row, and anything else you have."
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
        {COLUMNS.map((key) => (
          <SelectField
            key={key}
            id={`import-col-${key}`}
            label={CUSTOMER_COLUMN_LABELS[key]}
            value={mapping[key] === undefined ? "" : String(mapping[key])}
            placeholder={key === "name" ? "Choose a column" : "Not in my list"}
            options={values}
            optionLabels={labels}
            error={key === "name" ? columnError : undefined}
            onChange={(v) => {
              setMapping((m) => {
                const next = { ...m };
                if (v === "") delete next[key];
                else next[key] = Number(v);
                return next;
              });
              setColumnError(undefined);
            }}
          />
        ))}
        <div className="flex flex-col gap-3">
          <Button type="submit" size="lg">
            Check the customers
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
      <p className="text-base font-medium" data-testid="import-summary">
        {ready.length === 1 ? "1 customer is ready to add" : `${ready.length} customers are ready to add`}
        {leftOut > 0 ? `, ${leftOut} left out` : ""}.
      </p>
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
                <span className="block min-w-0 truncate text-base font-medium">{r.name || `Row ${r.line}`}</span>
                {[r.email, r.phone, [r.city, r.region].filter(Boolean).join(", ")].some(Boolean) && (
                  <p className="truncate text-sm text-muted-foreground">{[r.email, r.phone, [r.city, r.region].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</p>
                )}
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
          {pending ? "Adding…" : chosen.length === 1 ? "Add 1 customer" : `Add ${chosen.length} customers`}
        </AddButton>
        <Button type="button" size="lg" variant="outline" disabled={pending} onClick={() => setStep("columns")}>
          Back
        </Button>
      </div>
    </div>
  );
}
