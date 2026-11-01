# Plan: the reader experiment script

Status: **built 2026-11-01.** Founder, 2026-11-01: "OK do those" (item 3 of the five). It is the "extraction experiment" that `docs/plans/onboarding.md` called for before relying on AI to read a maker's documents, and it settles the Sonnet-or-Haiku question (`docs/plans/import-onboarding.md`, questions for the founder).

## Prototype read
No prototype counterpart (the prototype has no document reading).

## What it does
A command, `pnpm reader:experiment <folder>`, run by the founder on their own computer with their own key. For each document in the folder and each model it calls the same code the app uses (`lib/reader`), cleans the answer the same way, and writes `reader-experiment-report.md` beside the documents: a table of the models side by side (documents, failures, average seconds, average cost, fields right, items found, item prices right) and a list of every wrong field and every document that could not be read.

## Decisions
1. **Documents stay outside the repository.** The script reads a folder you name and writes its report there; nothing is copied in.
2. **Accuracy is optional.** A `<name>.expected.json` beside a document says what is really on it; only the fields given are scored (text compared without case or punctuation, phone, postal and VAT numbers by their digits, items by name and price to the cent). Without it the report still shows what was found.
3. **Refuses CI, servers and a missing key**, because it spends real money.
4. **It runs as a vitest file** (`*.experiment.ts`, its own config) so it shares the app's TypeScript and aliases without a new tool; it is not among the normal tests.
5. **Cost uses cached prices** (in `lib/reader/experiment.ts`, dated); the report says to check them.

## Tests
Unit: the scoring (matching rules, wrong and missing fields, items, cost, the report), and a call to the provider reports its token use. The script itself was run against the browser tests' stand-in service (no real key here); it has not run against the real service.

## Missed from the prototype
(none)
