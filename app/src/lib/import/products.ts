import { parseMoney, type Cents } from "../money";
import { PRODUCT_DESCRIPTION_MAX, PRODUCT_NAME_MAX, PRODUCT_UNIT_MAX, type ProductKind } from "../products";

/**
 * Reading a pasted list or a CSV into products (docs/plans/import-onboarding.md, slice 1). Pure: no browser, no
 * server. A list is cut into rows and cells, the columns are guessed from their headings, and each row becomes a
 * product (name, price, unit, description, kind) or says what is wrong with it and how to fix it. Prices are read with
 * `parseMoney` and kept as integer cents; nothing here uses floating point. Only flat products come out: variations
 * are not guessed from a flat sheet.
 */

/** The most products one import takes. */
export const IMPORT_MAX_ROWS = 200;

export type Table = string[][];

/** Cuts text into rows and cells. The separator (tab, semicolon or comma) is the one the first lines use most. Quotes, doubled quotes, line breaks inside quotes, a byte-order mark and Windows line ends are handled. */
export function parseDelimited(input: string): Table {
  const text = input.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const rows: Table = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"' && cell === "") {
      quoted = true;
    } else if (c === delimiter) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // Blank lines carry nothing.
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

/** Tab beats semicolon beats comma when it appears (outside quotes) in the first lines; a sheet pasted from a spreadsheet is tab separated. */
function detectDelimiter(text: string): string {
  const head = text.split(/\r\n|\n|\r/).slice(0, 5).join("\n").replace(/"[^"]*"/g, "");
  if (head.includes("\t")) return "\t";
  if (head.includes(";")) return ";";
  return ",";
}

export type ColumnKey = "name" | "price" | "unit" | "description" | "type";
export type Mapping = Partial<Record<ColumnKey, number>>;

export const COLUMN_LABELS: Record<ColumnKey, string> = {
  name: "Name",
  price: "Price",
  unit: "Unit",
  description: "Description",
  type: "Product or service",
};

/** Heading words, lower case with no spaces or punctuation, that each column answers to. Xero, QuickBooks and plain sheets. */
const HEADINGS: Record<ColumnKey, string[]> = {
  name: ["name", "item", "itemname", "product", "productname", "productservicename", "service", "title"],
  price: ["price", "unitprice", "salesprice", "salespricerate", "salesunitprice", "sellingprice", "rate", "amount", "retailprice"],
  unit: ["unit", "uom", "unitofmeasure", "per"],
  description: ["description", "salesdescription", "details", "notes"],
  type: ["type", "kind"],
};

const squash = (heading: string) => heading.toLowerCase().replace(/[^a-z0-9]/g, "");
const KEYS: ColumnKey[] = ["name", "price", "unit", "description", "type"];

/**
 * Which column holds which part. From the first row when it reads as headings (a heading that is recognised keeps its
 * column; a name or price that was not found takes the next free column in order). With no heading words at all, a
 * first row with no price in it is taken as headings and one with a price is data: the first column is the name and
 * the second the price.
 */
export function guessMapping(table: Table): { hasHeader: boolean; mapping: Mapping } {
  const first = table[0] ?? [];
  const mapping: Mapping = {};
  const taken = new Set<number>();
  for (const key of KEYS) {
    const at = first.findIndex((h, i) => !taken.has(i) && HEADINGS[key].includes(squash(h)));
    if (at !== -1) {
      mapping[key] = at;
      taken.add(at);
    }
  }
  const recognised = Object.keys(mapping).length > 0;
  const firstRowHasPrice = first.some((cell) => parsePriceCell(cell, { symbol: "R", code: "ZAR" }).ok);
  const hasHeader = recognised || (!firstRowHasPrice && first.length > 1 && table.length > 1);
  const free = () => first.findIndex((_, i) => !taken.has(i));
  for (const key of ["name", "price"] as const) {
    if (mapping[key] === undefined) {
      const at = free();
      if (at !== -1) {
        mapping[key] = at;
        taken.add(at);
      }
    }
  }
  return { hasHeader, mapping };
}

export type PriceCell = { ok: true; cents: Cents; unit?: string; note?: string } | { ok: false; error: string };

/**
 * One price as a maker writes it: "R1 450", "450.00", "from R3 500", "R250/hour", "R450 each". A currency symbol or
 * code is dropped, "each" is dropped, "/hour" or "per hour" becomes the unit, "from" is kept with a note. A range
 * ("R2 800–R4 500") is not one price, so it says so rather than guessing.
 */
export function parsePriceCell(raw: string, currency: { symbol: string; code: string }): PriceCell {
  let text = raw.replace(/[  ]/g, " ").trim();
  if (text === "") return { ok: false, error: "No price. Add one, or leave this row out." };
  let note: string | undefined;
  if (/^from\s+/i.test(text)) {
    text = text.replace(/^from\s+/i, "");
    note = "Priced “from”: this is the lowest price. You can set the price and choices on the product.";
  }
  if (/\d\s*(?:[–—-]|\sto\s)\s*\D{0,4}\d/i.test(text)) {
    return { ok: false, error: "This is a range. Use one price (like the lowest), and add the rest as choices on the product." };
  }
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  text = text.replace(new RegExp(`^(?:${escape(currency.code)}|${escape(currency.symbol)})\\s*`, "i"), "");
  let unit: string | undefined;
  const per = /\s*(?:\/|\bper\b)\s*([a-z][a-z .]{0,19})$/i.exec(text);
  if (per) {
    text = text.slice(0, per.index);
    const word = per[1]!.trim().toLowerCase();
    if (word !== "each" && word !== "ea") unit = word;
  }
  text = text.replace(/\s*\b(?:each|ea)\b\.?$/i, "").replace(/\s*\b(?:incl|excl|ex)\.?\s*vat\b$/i, "");
  const money = parseMoney(text);
  if (!money.ok) return { ok: false, error: `“${raw.trim()}” isn't a price I can read. Use numbers only, like 1 450 or 1 450,50.` };
  return { ok: true, cents: money.value, ...(unit ? { unit } : {}), ...(note ? { note } : {}) };
}

export type ImportRow = {
  /** The row's place in the pasted list (the first row of data is 1). */
  line: number;
  kind: ProductKind;
  name: string;
  priceCents: Cents | null;
  unit: string | null;
  description: string | null;
  /** Why the row is left out, in words that say how to fix it; undefined when it can be added. */
  problem?: string;
  /** Something to know that does not stop it (a "from" price, a description cut short). */
  note?: string;
  /** The cells of the columns that were not given a part (Scent, Size…), with their headings: what tells same-named rows apart. */
  extras?: { heading: string; value: string }[];
};

export type ReadOptions = {
  kind: ProductKind;
  currency: { symbol: string; code: string };
  /** The names of the products the business already has, lower case: those rows are left out. */
  existingNames: ReadonlySet<string>;
};

export const nameKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

/** Turns the data rows into products to add, each with a problem when it can't be. */
export function readRows(table: Table, hasHeader: boolean, mapping: Mapping, options: ReadOptions): ImportRow[] {
  const data = hasHeader ? table.slice(1) : table;
  const seen = new Map<string, number>();
  return data.map((cells, index): ImportRow => {
    const line = index + 1;
    const cell = (key: ColumnKey) => (mapping[key] === undefined ? "" : (cells[mapping[key]!] ?? "").trim());
    const name = cell("name").replace(/\s+/g, " ");
    const typeText = cell("type").toLowerCase();
    // A Type column (QuickBooks) can say service or product per row; any other word in it (a category) changes nothing.
    const kind: ProductKind = typeText.includes("service") ? "service" : /product|inventory|goods|bundle/.test(typeText) ? "product" : options.kind;
    const row: ImportRow = { line, kind, name, priceCents: null, unit: null, description: null };
    const used = new Set(Object.values(mapping));
    const extras = cells.flatMap((value, i) => (used.has(i) || value.trim() === "" ? [] : [{ heading: hasHeader ? (table[0]?.[i] ?? "").trim() : "", value: value.trim() }]));
    if (extras.length > 0) row.extras = extras;

    const notes: string[] = [];
    const description = cell("description");
    if (description !== "") {
      row.description = description.slice(0, PRODUCT_DESCRIPTION_MAX);
      if (description.length > PRODUCT_DESCRIPTION_MAX) notes.push(`The description was cut to ${PRODUCT_DESCRIPTION_MAX} characters.`);
    }
    const unitText = cell("unit");
    if (unitText !== "") {
      if (unitText.length > PRODUCT_UNIT_MAX) notes.push(`The unit “${unitText.slice(0, 12)}…” is too long, so it was left out.`);
      else row.unit = unitText.toLowerCase();
    }

    if (name === "") row.problem = "No name. Add one, or leave this row out.";
    else if (name.length > PRODUCT_NAME_MAX) row.problem = `The name is longer than ${PRODUCT_NAME_MAX} characters. Shorten it.`;

    const price = parsePriceCell(cell("price"), options.currency);
    if (price.ok) {
      row.priceCents = price.cents;
      if (price.unit && row.unit === null) row.unit = price.unit.length <= PRODUCT_UNIT_MAX ? price.unit : null;
      if (price.note) notes.push(price.note);
    } else if (!row.problem) row.problem = price.error;

    if (!row.problem) {
      const key = nameKey(name);
      if (options.existingNames.has(key)) row.problem = "You already have one with this name, so it is left out.";
      else if (seen.has(key)) row.problem = `Same name as row ${seen.get(key)}, so it is left out.`;
      else seen.set(key, line);
    }
    if (notes.length > 0) row.note = notes.join(" ");
    return row;
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Suggested grouping: rows that look like one product with choices (docs/plans/import-onboarding.md, slice 3)
// ---------------------------------------------------------------------------------------------------------------

export type ImportGroup = {
  /** Stable for the list: the base name in lower case. */
  key: string;
  name: string;
  kind: ProductKind;
  description: string | null;
  unit: string | null;
  /** The maker's word for the choices ("Size", "Scent and Size"), or "Option" when the list did not say. */
  variationLabel: string;
  variations: { line: number; name: string; priceCents: Cents }[];
  /** How it was recognised: the same name on several rows (told apart by other columns), or a name that ends " - 20cm". */
  basis: "extras" | "name";
};

const SEPARATOR = /^(.+?)\s+[-–—:]\s+(.+)$/;
/** The most choices a product can have (the database's own limit). */
export const IMPORT_MAX_VARIATIONS = 50;
const VARIANT_MAX = 80;
const LABEL_MAX = 40;

/**
 * Finds sets of rows that look like one product with choices, so the maker can say yes instead of retyping them. Two
 * ways it recognises them, both only a suggestion: several rows with the SAME name that other columns tell apart (a
 * candle in Lavender and in Vanilla, in two sizes), or names that share a start and differ in an ending after a dash
 * ("Chocolate cake - 20cm", "Chocolate cake - 25cm"). A set is offered only if it has at least two rows, each with
 * a price, no two choices read the same, there are not too many, and the maker does not already have a product by that
 * name. The product's own price is the lowest of the choices, as everywhere else.
 */
export function suggestGroups(rows: readonly ImportRow[]): ImportGroup[] {
  // Rows that have a price and are not already among the products (a repeated name within the list is what we are here for).
  const candidates = rows.filter((r) => r.priceCents !== null && (!r.problem || /^Same name as row/.test(r.problem)));
  const byName = new Map<string, ImportRow[]>();
  for (const r of candidates) byName.set(nameKey(r.name), [...(byName.get(nameKey(r.name)) ?? []), r]);
  const taken = new Set<number>();
  const groups: ImportGroup[] = [];

  const make = (key: string, name: string, members: { row: ImportRow; variant: string }[], variationLabel: string, basis: ImportGroup["basis"]) => {
    if (members.length < 2 || members.length > IMPORT_MAX_VARIATIONS) return;
    if (members.some((m) => m.variant === "" || m.variant.length > VARIANT_MAX)) return;
    if (new Set(members.map((m) => nameKey(m.variant))).size !== members.length) return;
    const first = members[0]!.row;
    groups.push({
      key,
      name,
      kind: first.kind,
      description: members.map((m) => m.row.description).find((d) => d !== null) ?? null,
      unit: members.map((m) => m.row.unit).find((u) => u !== null) ?? null,
      variationLabel: variationLabel.slice(0, LABEL_MAX) || "Option",
      variations: members.map((m) => ({ line: m.row.line, name: m.variant, priceCents: m.row.priceCents! })),
      basis,
    });
    for (const m of members) taken.add(m.row.line);
  };

  // 1. The same name on several rows, told apart by the other columns.
  for (const [key, members] of byName) {
    if (members.length < 2) continue;
    const named = members.map((row) => ({ row, variant: (row.extras ?? []).map((e) => e.value).join(", ") }));
    const label = [...new Set((members[0]!.extras ?? []).map((e) => e.heading).filter((h) => h !== ""))].join(" and ");
    make(key, members[0]!.name, named, label, "extras");
  }

  // 2. Names that share a start and differ after a dash. Only rows not already grouped, and only a name seen once as a whole.
  const byBase = new Map<string, { row: ImportRow; base: string; variant: string }[]>();
  for (const r of candidates) {
    if (taken.has(r.line) || (byName.get(nameKey(r.name))?.length ?? 0) > 1) continue;
    const m = SEPARATOR.exec(r.name);
    if (!m) continue;
    const base = m[1]!.trim();
    byBase.set(nameKey(base), [...(byBase.get(nameKey(base)) ?? []), { row: r, base, variant: m[2]!.trim() }]);
  }
  for (const [key, members] of byBase) {
    // A product by that exact name already among the rows would be confused with the group: leave both alone.
    if (byName.has(key)) continue;
    make(key, members[0]!.base, members, "Option", "name");
  }
  return groups;
}
