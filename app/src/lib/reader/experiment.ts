import type { FoundBusiness, FoundItem, Reading } from "./index";

/**
 * Scoring for the reader experiment (docs/runbooks/document-reader.md): given what the reader found on a document and
 * what a person says is really on it, which fields were right. Pure: the script that calls the real service is
 * `src/lib/reader/__experiment__/run.experiment.ts`. Text is compared without regard to case, spacing or punctuation,
 * and phone, postal code and VAT numbers by their digits alone, so "082 555 0101" and "0825550101" are the same.
 */

/** What a person says is on the document. Every field is optional: only the ones given are scored. */
export type Expected = { businessName?: string; business?: FoundBusiness; items?: { name: string; priceCents: number }[] };

const DIGITS_FIELDS = new Set(["phone", "postalCode", "vatNumber"]);
const plain = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const digits = (text: string) => text.replace(/\D/g, "");

export type FieldScore = { field: string; expected: string; found: string | null; right: boolean };

export function scoreBusiness(found: Reading, expected: Expected): FieldScore[] {
  const scores: FieldScore[] = [];
  if (expected.businessName !== undefined) {
    scores.push({ field: "businessName", expected: expected.businessName, found: found.businessName, right: found.businessName !== null && plain(found.businessName) === plain(expected.businessName) });
  }
  for (const [field, value] of Object.entries(expected.business ?? {})) {
    if (value === undefined || typeof value === "boolean") continue;
    const got = (found.business as Record<string, unknown>)[field];
    const gotText = typeof got === "string" ? got : null;
    const right = gotText !== null && (DIGITS_FIELDS.has(field) ? digits(gotText) === digits(value) : plain(gotText) === plain(value));
    scores.push({ field, expected: value, found: gotText, right });
  }
  return scores;
}

export type ItemScore = { expected: number; found: number; matched: number; priceRight: number };

/** Items match by name; a matched item's price is right when it is the same to the cent. Precision is matched/found, recall matched/expected. */
export function scoreItems(found: readonly FoundItem[], expected: readonly { name: string; priceCents: number }[]): ItemScore {
  const byName = new Map(found.map((i) => [plain(i.name), i]));
  let matched = 0;
  let priceRight = 0;
  for (const want of expected) {
    const got = byName.get(plain(want.name));
    if (!got) continue;
    matched++;
    if (got.priceCents === want.priceCents) priceRight++;
  }
  return { expected: expected.length, found: found.length, matched, priceRight };
}

/** US dollars per million tokens (input, output) as cached 2026-10-06: **check them again before relying on a cost**. */
export const PRICES_PER_MILLION: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
};

export function costOf(model: string, usage: { inputTokens: number; outputTokens: number }): number | null {
  const price = PRICES_PER_MILLION[model];
  return price ? (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1_000_000 : null;
}

export type Run = { file: string; model: string; seconds: number; ok: boolean; failure?: string; fields: FieldScore[]; items: ItemScore | null; costUsd: number | null; foundFields: number; foundItems: number };

export type ModelSummary = { model: string; documents: number; failed: number; avgSeconds: number; avgCostUsd: number | null; fieldsRight: number; fieldsScored: number; itemRecall: number | null; itemPriceRight: number | null };

export function summarise(runs: readonly Run[]): ModelSummary[] {
  const models = [...new Set(runs.map((r) => r.model))];
  return models.map((model) => {
    const mine = runs.filter((r) => r.model === model);
    const done = mine.filter((r) => r.ok);
    const costs = done.map((r) => r.costUsd).filter((c): c is number => c !== null);
    const fields = done.flatMap((r) => r.fields);
    const items = done.flatMap((r) => (r.items ? [r.items] : []));
    const expectedItems = items.reduce((n, i) => n + i.expected, 0);
    return {
      model,
      documents: mine.length,
      failed: mine.length - done.length,
      avgSeconds: done.length === 0 ? 0 : done.reduce((n, r) => n + r.seconds, 0) / done.length,
      avgCostUsd: costs.length === 0 ? null : costs.reduce((n, c) => n + c, 0) / costs.length,
      fieldsRight: fields.filter((f) => f.right).length,
      fieldsScored: fields.length,
      itemRecall: expectedItems === 0 ? null : items.reduce((n, i) => n + i.matched, 0) / expectedItems,
      itemPriceRight: expectedItems === 0 ? null : items.reduce((n, i) => n + i.priceRight, 0) / expectedItems,
    };
  });
}

const pct = (n: number | null) => (n === null ? "n/a" : `${Math.round(n * 100)}%`);

/** A short markdown report: one table of the models side by side, then every wrong field with what was expected. */
export function reportMarkdown(runs: readonly Run[]): string {
  const lines = ["# Reader experiment", "", "| Model | Documents | Failed | Avg seconds | Avg cost (USD) | Fields right | Items found | Item prices right |", "| --- | --- | --- | --- | --- | --- | --- | --- |"];
  for (const s of summarise(runs)) {
    lines.push(
      `| ${s.model} | ${s.documents} | ${s.failed} | ${s.avgSeconds.toFixed(1)} | ${s.avgCostUsd === null ? "n/a" : s.avgCostUsd.toFixed(4)} | ${s.fieldsScored === 0 ? "n/a" : `${s.fieldsRight}/${s.fieldsScored} (${pct(s.fieldsRight / s.fieldsScored)})`} | ${pct(s.itemRecall)} | ${pct(s.itemPriceRight)} |`,
    );
  }
  const wrong = runs.flatMap((r) => r.fields.filter((f) => !f.right).map((f) => `- ${r.model}, ${r.file}: ${f.field}: expected “${f.expected}”, found ${f.found === null ? "nothing" : `“${f.found}”`}`));
  const failed = runs.filter((r) => !r.ok).map((r) => `- ${r.model}, ${r.file}: ${r.failure}`);
  if (wrong.length > 0) lines.push("", "## Wrong or missing fields", ...wrong);
  if (failed.length > 0) lines.push("", "## Documents it could not read", ...failed);
  lines.push("", "Prices per million tokens are cached figures: check them before relying on a cost.");
  return lines.join("\n");
}
