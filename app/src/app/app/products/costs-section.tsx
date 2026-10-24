"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Trash2Icon } from "lucide-react";
import { AddButton } from "@/components/add-button";
import { Section, SelectField, TextField } from "@/components/form-fields";
import { PrivateTag } from "@/components/private-tag";
import { QuantityField } from "@/components/quantity-field";
import { Button } from "@/components/ui/button";
import { formatMoney, formatPercent, type NumberStyle } from "@/lib/money";
import { priceForMarginCents, targetStanding } from "@/lib/costing/target";
import type { Material } from "@/lib/materials";
import { UNIT_CHOICES, UNITS, type UnitCode } from "@/lib/materials/units";
import { blankCostRow, COST_LINES_MAX, type CostErrors, type CostFormRow, type CostKind, type CostRowErrors } from "@/lib/products/costs";
import type { CostSummary } from "@/lib/products/cost-summary";
import { AddMaterial, type AddMaterialConfig } from "./add-material";
import { ConditionsEditor, type ChoiceOption } from "./conditions-editor";

let keyCounter = 0;
const newCostKey = () => `cost-new-${(keyCounter += 1)}`;

/** The materials a cost line can use: the ones in use, and any that are not archived. */
export type MaterialOption = Pick<Material, "id" | "name" | "unit" | "archived" | "boughtQuantityMilli" | "priceCents" | "vatTreatment">;

const KIND_TITLES: Record<CostKind, string> = { material: "Material", time: "Your time", other: "Other cost" };

/**
 * The cost lines themselves (a material, your time, another cost) and the three buttons that add one. Used for a
 * product's lines (with "Only for some items" conditions) and for an extra's (`choices` null: no conditions).
 * `subject` names whose lines they are for screen readers when there are several lists on the page.
 */
export function CostLineEditor({
  label,
  subject,
  scope = "",
  max = COST_LINES_MAX,
  rows,
  errors,
  choices,
  materials,
  addMaterial,
  hourlyRateSet,
  unit,
  currencySymbol,
  fid,
  onChange,
}: {
  /** The list's name for screen readers. */
  label: string;
  subject?: string;
  /** In front of the add buttons' ids, so two lists on one form do not share them. */
  scope?: string;
  max?: number;
  rows: CostFormRow[];
  errors: { list?: string; rows: Record<string, CostRowErrors> } | undefined;
  /** What a line can depend on, or null when lines have no conditions. */
  choices: ChoiceOption[] | null;
  materials: MaterialOption[];
  /** Lets the maker add a material from a line, without leaving the form. */
  addMaterial?: AddMaterialConfig;
  hourlyRateSet: boolean;
  unit?: string;
  currencySymbol: string;
  fid: (key: string) => string;
  onChange: (rows: CostFormRow[]) => void;
}) {
  // Where focus goes after a line is added or removed (once it is on the screen).
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingFocus.current) return;
    document.getElementById(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  });
  const setRow = (key: string, change: Partial<CostFormRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...change } : r)));
  const idOf = (key: string, field: string) => fid(`cost-${key}-${field}`);
  const usable = (current: string) => materials.filter((m) => !m.archived || m.id === current);
  const unitOf = (id: string): UnitCode | null => materials.find((m) => m.id === id)?.unit ?? null;
  const unitsLike = (code: UnitCode | null): UnitCode[] =>
    code === null ? UNIT_CHOICES.flatMap((g) => g.units) : (UNIT_CHOICES.find((g) => g.units.includes(code))?.units ?? [code]);

  return (
    <>
      {rows.length > 0 && (
        <ol className="space-y-4" aria-label={label}>
          {rows.map((row, i) => {
            const e = errors?.rows[row.key];
            const name = `${KIND_TITLES[row.kind]} ${rows.filter((r, ri) => ri <= i && r.kind === row.kind).length}`;
            const materialUnit = unitOf(row.materialId);
            return (
              <li key={row.key} className="space-y-3 rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-medium">{name}</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    aria-label={`Remove ${name}${subject ? ` (${subject})` : ""}`}
                    onClick={() => {
                      const next = rows.filter((r) => r.key !== row.key);
                      onChange(next);
                      pendingFocus.current = next.length > 0 ? idOf(next[Math.max(0, i - 1)].key, "first") : fid(`${scope}add-cost`);
                    }}
                  >
                    <Trash2Icon aria-hidden="true" />
                  </Button>
                </div>
                {row.kind === "material" && (
                  <>
                    {materials.length === 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">You have no materials yet.</p>
                        {addMaterial ? (
                          <AddMaterial config={addMaterial} id={idOf(row.key, "first")} onChosen={(m) => setRow(row.key, { materialId: m.id, unit: m.unit })} variant="default" />
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            <Link href="/app/materials/new" className="underline underline-offset-4">
                              Add a material
                            </Link>{" "}
                            first, then come back.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <SelectField
                          id={idOf(row.key, "first")}
                          label="Material"
                          placeholder="Choose…"
                          value={row.materialId}
                          options={usable(row.materialId).map((m) => m.id)}
                          optionLabels={Object.fromEntries(materials.map((m) => [m.id, m.archived ? `${m.name} (archived)` : m.name]))}
                          error={e?.materialId}
                          onChange={(materialId) => {
                            // The unit starts as the material's own; one that no longer suits it is cleared.
                            const next = unitOf(materialId);
                            const keep = next !== null && row.unit !== "" && unitsLike(next).includes(row.unit as UnitCode);
                            setRow(row.key, { materialId, unit: keep ? row.unit : (next ?? "") });
                          }}
                        />
                        {addMaterial && (
                          <AddMaterial config={addMaterial} id={idOf(row.key, "add-material")} onChosen={(m) => setRow(row.key, { materialId: m.id, unit: m.unit })} />
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                      <QuantityField id={idOf(row.key, "amount")} label="How much goes in" value={row.amount} error={e?.amount} onChange={(amount) => setRow(row.key, { amount })} />
                      <div className="w-32">
                        <SelectField
                          id={idOf(row.key, "unit")}
                          label="Unit"
                          placeholder="Unit"
                          value={row.unit}
                          options={unitsLike(materialUnit)}
                          optionLabels={Object.fromEntries(Object.entries(UNITS).map(([code, info]) => [code, info.label]))}
                          error={e?.unit}
                          onChange={(u) => setRow(row.key, { unit: u })}
                        />
                      </div>
                    </div>
                  </>
                )}
                {row.kind === "time" && (
                  <>
                    <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                      <QuantityField id={idOf(row.key, "first")} label="How long it takes" value={row.time} error={e?.time} onChange={(time) => setRow(row.key, { time })} />
                      <div className="w-32">
                        <SelectField
                          id={idOf(row.key, "timeUnit")}
                          label="In"
                          value={row.timeUnit}
                          options={["minutes", "hours"]}
                          optionLabels={{ minutes: "Minutes", hours: "Hours" }}
                          onChange={(timeUnit) => setRow(row.key, { timeUnit: timeUnit === "hours" ? "hours" : "minutes" })}
                        />
                      </div>
                    </div>
                    {!hourlyRateSet && (
                      <p className="text-sm text-muted-foreground">
                        Your time is counted at an hourly rate.{" "}
                        <Link href="/app/business" className="underline underline-offset-4">
                          Set what an hour of your time is worth
                        </Link>{" "}
                        in your business profile.
                      </p>
                    )}
                  </>
                )}
                {row.kind === "other" && (
                  <>
                    <TextField id={idOf(row.key, "first")} label="What is it" autoComplete="off" maxLength={120} placeholder="e.g. Box" value={row.name} error={e?.name} onChange={(v) => setRow(row.key, { name: v })} />
                    <TextField
                      id={idOf(row.key, "cost")}
                      label="What it costs"
                      inputMode="decimal"
                      autoComplete="off"
                      startText={currencySymbol}
                      value={row.cost}
                      error={e?.cost}
                      onChange={(v) => setRow(row.key, { cost: v })}
                    />
                  </>
                )}
                {choices && (
                  <ConditionsEditor
                  subject={name}
                  logicLabel="Include this cost when"
                  groupLabel={`When to include ${name}`}
                  idBase={idOf(row.key, "cond")}
                  logic={row.logic}
                  conditions={row.conditions}
                  choices={choices}
                  unit={unit}
                  errors={e}
                    onChange={(change) => setRow(row.key, change)}
                  />
                )}
              </li>
            );
          })}
        </ol>
      )}
      {errors?.list && (
        <p id={fid(`${scope}costs-error`)} tabIndex={-1} className="text-sm text-destructive">
          {errors.list}
        </p>
      )}
      {rows.length < max && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={`Add a cost${subject ? ` (${subject})` : ""}`}>
          {(
            [
              ["material", "Add a material", `${scope}add-cost`],
              ["time", "Add your time", `${scope}add-time`],
              ["other", "Add other cost", `${scope}add-other`],
            ] as const
          ).map(([kind, label, id]) => (
            <AddButton
              key={kind}
              id={fid(id)}
              onClick={() => {
                const row = blankCostRow(newCostKey(), kind);
                onChange([...rows, row]);
                pendingFocus.current = idOf(row.key, "first");
              }}
            >
              {label}
            </AddButton>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * "What it costs to make" (docs/plans/costing-and-margin.md, slice A): what goes into one batch, and how many a batch
 * makes. Each line is a material (an amount of one of your materials), your time (at the hourly rate in the Business
 * profile) or another cost, and can be only for some items (the same conditions as a production step). Costs are
 * without VAT. Underneath, what it costs to make one and the margin, for the product or each variation.
 */
export function CostsSection({
  title,
  rows,
  makes,
  errors,
  choices,
  materials,
  addMaterial,
  hourlyRateSet,
  targetBp,
  summary,
  unit,
  numberStyle,
  currencySymbol,
  currencyCode,
  vatRegistered,
  fid,
  onChange,
  onMakesChange,
}: {
  title: string;
  rows: CostFormRow[];
  makes: string;
  errors: CostErrors | undefined;
  /** The variations, list choices and extras the product has, named: what a line can depend on. */
  choices: ChoiceOption[];
  materials: MaterialOption[];
  /** Lets the maker add a material from a line, without leaving the form. */
  addMaterial?: AddMaterialConfig;
  /** Whether the Business profile says what an hour of the maker's time is worth. */
  hourlyRateSet: boolean;
  /** The margin the business aims for (basis points), or null: nothing is judged against it. */
  targetBp: number | null;
  summary: CostSummary;
  /** What the product is counted in ("dozen"), written after a quantity. */
  unit?: string;
  numberStyle: NumberStyle;
  currencySymbol: string;
  currencyCode: string;
  vatRegistered: boolean;
  fid: (key: string) => string;
  onChange: (rows: CostFormRow[]) => void;
  onMakesChange: (makes: string) => void;
}) {
  return (
    <Section title={title} tag={<PrivateTag />}>
      <p className="-mt-2 text-sm text-muted-foreground">What goes into making one batch.</p>
      <CostLineEditor
        label={title}
        rows={rows}
        errors={errors}
        choices={choices}
        materials={materials}
        addMaterial={addMaterial}
        hourlyRateSet={hourlyRateSet}
        unit={unit}
        currencySymbol={currencySymbol}
        fid={fid}
        onChange={onChange}
      />
      {rows.length > 0 && (
        <QuantityField
          id={fid("makes")}
          label="How many one batch makes"
          hint="The costs above are for one batch. Use 1 if you make one at a time."
          unit={unit}
          value={makes}
          error={errors?.makes}
          onChange={onMakesChange}
        />
      )}
      <CostSummaryView summary={summary} targetBp={targetBp} numberStyle={numberStyle} currencyCode={currencyCode} hasRows={rows.length > 0} vatRegistered={vatRegistered} />
    </Section>
  );
}

function CostSummaryView({
  summary,
  targetBp,
  numberStyle,
  currencyCode,
  hasRows,
  vatRegistered,
}: {
  summary: CostSummary;
  targetBp: number | null;
  numberStyle: NumberStyle;
  currencyCode: string;
  hasRows: boolean;
  vatRegistered: boolean;
}) {
  if (!hasRows) return null;
  const money = (cents: number) => formatMoney(cents, currencyCode, numberStyle);
  const shown = summary.scopes.filter((s) => s.margin !== null && s.margin.costCents !== null);
  if (shown.length === 0) return null;
  return (
    <div className="space-y-1 border-t border-border pt-3 text-sm" data-testid="cost-summary" aria-live="polite">
      {shown.map((s) => {
        const m = s.margin!;
        return (
          <p key={s.name} data-testid="cost-summary-row">
            {s.name && <span className="font-medium">{s.name}: </span>}
            Costs {money(m.costCents ?? 0)}
            {m.incomplete ? " or more" : ""} to make one. Sells for {money(m.revenueCents)}
            {vatRegistered ? " without VAT" : ""}.{" "}
            {m.marginBp === null ? "" : `Margin ${formatPercent(m.marginBp, numberStyle)}.`}
            {targetBp !== null && <TargetNote marginBp={m.marginBp} costCents={m.costCents} incomplete={m.incomplete} targetBp={targetBp} money={money} numberStyle={numberStyle} vatRegistered={vatRegistered} />}
          </p>
        );
      })}
      {summary.leftOutConditions && (
        <p className="text-muted-foreground">Lines that depend on a list choice, an extra or a quantity are not counted here.</p>
      )}
      {vatRegistered && <p className="text-muted-foreground">Costs and margins are worked out without VAT.</p>}
    </div>
  );
}

/**
 * Where a margin stands against the target the business aims for, in words (never colour alone), and, below it, what to
 * charge to reach it (without VAT, the way the summary states the price).
 */
function TargetNote({
  marginBp,
  costCents,
  incomplete,
  targetBp,
  money,
  numberStyle,
  vatRegistered,
}: {
  marginBp: number | null;
  costCents: number | null;
  incomplete: boolean;
  targetBp: number;
  money: (cents: number) => string;
  numberStyle: NumberStyle;
  vatRegistered: boolean;
}) {
  const standing = targetStanding(marginBp, targetBp);
  if (standing === null) return null;
  const target = formatPercent(targetBp, numberStyle);
  if (standing === "meets") {
    return <span className="text-emerald-700 dark:text-emerald-400" data-testid="target-note"> Meets your {target} target.</span>;
  }
  const price = costCents === null ? null : priceForMarginCents(costCents, targetBp);
  return (
    <span className="text-amber-800 dark:text-amber-300" data-testid="target-note">
      {" "}
      Below your {target} target
      {price === null ? "." : `: for ${target}, charge ${incomplete ? "at least " : ""}${money(price)}${vatRegistered ? " without VAT" : ""}.`}
    </span>
  );
}
