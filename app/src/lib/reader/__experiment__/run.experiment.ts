import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { describe, it, vi } from "vitest";
import { getLocalePack } from "../../locale";
import { costOf, reportMarkdown, scoreBusiness, scoreItems, type Expected, type Run } from "../experiment";
import { detectMediaType, sanitiseReading } from "../index";

vi.mock("server-only", () => ({}));

/**
 * The reader experiment (docs/runbooks/document-reader.md; docs/plans/onboarding.md, "Extraction experiment"): runs the
 * real reader over a folder of real quotes and invoices, once for each model, and reports speed, cost and how many
 * fields were right. Run on a developer's own computer with `pnpm reader:experiment <folder>`; it is not part of the
 * tests and never runs in CI or on a hosted server. The documents stay in your folder: nothing is copied into the
 * repository, and the report is written back beside them.
 *
 * Put each document in the folder (PDF, PNG, JPG or WebP). To score accuracy, put `<name>.expected.json` beside it with
 * only what you want checked: { "businessName": "...", "business": { "phone": "...", "city": "..." }, "items": [ { "name": "...", "priceCents": 45000 } ] }.
 * Without it, the report just lists what was found, for you to check by eye.
 */
const dir = process.env.READER_EXPERIMENT_DIR;
const models = (process.env.READER_EXPERIMENT_MODELS ?? "claude-sonnet-5-5,claude-haiku-5-5").split(",").map((m) => m.trim()).filter(Boolean);

describe.skipIf(!dir)("reader experiment", () => {
  it(
    "runs the reader over the folder",
    async () => {
      if (process.env.VERCEL || process.env.CI || process.env.NODE_ENV === "production") throw new Error("the reader experiment only runs on a developer's own computer");
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("set ANTHROPIC_API_KEY to run the experiment");
      const { readDocument, ReaderError } = await import("../provider");
      const locale = getLocalePack("ZA");
      const files = readdirSync(dir!).filter((f) => /\.(pdf|png|jpe?g|webp)$/i.test(f)).sort();
      if (files.length === 0) throw new Error(`no documents (PDF, PNG, JPG or WebP) in ${dir}`);

      const runs: Run[] = [];
      for (const file of files) {
        const bytes = new Uint8Array(readFileSync(join(dir!, file)));
        const mediaType = detectMediaType(bytes);
        const expectedPath = join(dir!, `${basename(file, extname(file))}.expected.json`);
        const expected: Expected | null = existsSync(expectedPath) ? (JSON.parse(readFileSync(expectedPath, "utf8")) as Expected) : null;
        for (const model of models) {
          const started = performance.now();
          let usage: { inputTokens: number; outputTokens: number } | null = null;
          if (!mediaType) {
            runs.push({ file, model, seconds: 0, ok: false, failure: "not a PDF or a picture", fields: [], items: null, costUsd: null, foundFields: 0, foundItems: 0 });
            continue;
          }
          try {
            const raw = await readDocument({ bytes, mediaType }, { apiKey, model, baseUrl: process.env.ANTHROPIC_BASE_URL?.trim() || undefined, onUsage: (u) => (usage = u) });
            const reading = sanitiseReading(raw, locale);
            const seconds = (performance.now() - started) / 1000;
            console.log(`${model} · ${file} · ${seconds.toFixed(1)}s · found ${JSON.stringify({ name: reading.businessName, ...reading.business })} · ${reading.items.length} items`);
            runs.push({
              file,
              model,
              seconds,
              ok: true,
              fields: expected ? scoreBusiness(reading, expected) : [],
              items: expected?.items ? scoreItems(reading.items, expected.items) : null,
              costUsd: usage ? costOf(model, usage) : null,
              foundFields: Object.keys(reading.business).length,
              foundItems: reading.items.length,
            });
          } catch (error) {
            runs.push({ file, model, seconds: (performance.now() - started) / 1000, ok: false, failure: error instanceof ReaderError ? error.reason : "unexpected", fields: [], items: null, costUsd: null, foundFields: 0, foundItems: 0 });
          }
        }
      }
      const report = reportMarkdown(runs);
      writeFileSync(join(dir!, "reader-experiment-report.md"), report);
      console.log(`\n${report}\n\nReport written to ${join(dir!, "reader-experiment-report.md")}`);
    },
    30 * 60_000,
  );
});
