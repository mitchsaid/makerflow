"use client";

import Link from "next/link";
import { useState } from "react";
import { AddLink } from "@/components/add-button";
import { EmptyState, NoMatches } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { costPerUnitCents, materialMatchesSearch, type Material } from "@/lib/materials";
import { UNITS } from "@/lib/materials/units";
import { formatMoney, formatQuantity, type NumberStyle } from "@/lib/money";

/** What one unit of a material costs, in words: "R15,00 per kg", or "less than R0,01 per mg" for a tiny one. */
export function perUnitText(material: Material, vatRateBp: number | null, currencyCode: string, style: NumberStyle): string {
  const cents = costPerUnitCents(material, vatRateBp);
  const unit = UNITS[material.unit].short;
  if (cents === null) return "";
  if (cents === 0 && material.priceCents > 0) return `less than ${formatMoney(1, currencyCode, style)} per ${unit}`;
  return `${formatMoney(cents, currencyCode, style)} per ${unit}`;
}

/** The materials list: search as you type, archived materials hidden until asked for. */
export function MaterialList({
  materials: all,
  addedName,
  currencyCode,
  numberStyle,
  vatRateBp,
  taxName,
}: {
  materials: Material[];
  addedName?: string;
  currencyCode: string;
  numberStyle: NumberStyle;
  /** The standard VAT rate when the business is VAT-registered (costs are shown without VAT), else null. */
  vatRateBp: number | null;
  taxName: string;
}) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"current" | "archived">("current");
  const archivedCount = all.filter((m) => m.archived).length;
  const visible = all.filter((m) => (view === "archived" ? m.archived : !m.archived) && materialMatchesSearch(m, query));

  if (all.length === 0) {
    return (
      <EmptyState title="No materials yet" line="Save what you buy and what you paid, to work out what each product costs.">
        <AddLink href="/app/materials/new" variant="default">
          Add your first material
        </AddLink>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      {addedName && (
        <p role="status" className="text-sm font-medium" data-testid="material-added">
          Added {addedName}.
        </p>
      )}
      <Field>
        <FieldLabel htmlFor="material-search">Search materials</FieldLabel>
        <Input
          id="material-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name or supplier"
          autoComplete="off"
        />
      </Field>
      {archivedCount > 0 && (
        <FilterBar
          label="Show materials"
          options={[
            { key: "current", label: "Current", count: all.length - archivedCount },
            { key: "archived", label: "Archived", count: archivedCount },
          ]}
          value={view}
          onChange={setView}
        />
      )}
      {visible.length === 0 ? (
        <NoMatches
          message={query.trim() !== "" ? `No materials match “${query.trim()}”.` : view === "archived" ? "No archived materials." : "All your materials are archived."}
          clearLabel={query.trim() === "" && view === "current" ? "Show archived" : undefined}
          onClear={() => setView("archived")}
        />
      ) : (
        <ul className="space-y-2" aria-label="Materials">
          {visible.map((m) => (
            <li key={m.id}>
              <Link
                href={`/app/materials/${m.id}`}
                className="block rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-base font-medium">{m.name}</span>
                  {m.archived && <span className="text-sm text-muted-foreground">Archived</span>}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {formatQuantity(m.boughtQuantityMilli, numberStyle)} {UNITS[m.unit].short} for {formatMoney(m.priceCents, currencyCode, numberStyle)}
                  {m.supplier ? ` · ${m.supplier}` : ""}
                </span>
                <span className="block text-sm">
                  {perUnitText(m, vatRateBp, currencyCode, numberStyle)}
                  {vatRateBp !== null && ` (without ${taxName})`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
