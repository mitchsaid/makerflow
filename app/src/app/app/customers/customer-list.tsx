"use client";

import Link from "@/components/app-link";
import { useState } from "react";
import { EmptyState, NoMatches } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { matchesSearch, type CustomerSummary } from "@/lib/customers";
import { AddLink } from "@/components/add-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The customers list: search as you type, archived customers hidden until asked for. The
 * whole list is loaded once (a maker's customers are hundreds, not millions), so searching
 * needs no round trip.
 */
export function CustomerList({
  customers,
  addedName,
  importedCount,
}: {
  customers: CustomerSummary[];
  /** Name of a customer that was just added, for a confirmation line. */
  addedName?: string;
  /** How many were just brought in from a list, for a confirmation line. */
  importedCount?: number;
}) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"current" | "archived">("current");

  const archivedCount = customers.filter((c) => c.archived).length;
  const visible = customers.filter(
    (c) => (view === "archived" ? c.archived : !c.archived) && matchesSearch(c, query),
  );

  if (customers.length === 0) {
    return (
      <EmptyState title="No customers yet" line="Add the people you make things for. Only a name is needed.">
        <AddLink href="/app/customers/new" variant="default">
          Add your first customer
        </AddLink>
        <Link href="/app/customers/import" className={cn(buttonVariants({ variant: "outline" }), "w-full")} data-testid="import-link">
          Import a list of customers
        </Link>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      {importedCount !== undefined && (
        <p role="status" className="text-sm font-medium" data-testid="customers-imported">
          {importedCount === 1 ? "Added 1 customer." : `Added ${importedCount} customers.`}
        </p>
      )}
      {addedName && (
        <p role="status" className="text-sm font-medium" data-testid="customer-added">
          Added {addedName}.
        </p>
      )}

      <Field>
        <FieldLabel htmlFor="customer-search">Search customers</FieldLabel>
        <Input
          id="customer-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, phone, email or town"
          autoComplete="off"
        />
      </Field>

      {archivedCount > 0 && (
        <FilterBar
          label="Show customers"
          options={[
            { key: "current", label: "Current", count: customers.length - archivedCount },
            { key: "archived", label: "Archived", count: archivedCount },
          ]}
          value={view}
          onChange={setView}
        />
      )}

      <p className="text-sm text-muted-foreground" aria-live="polite" data-testid="customer-count">
        {visible.length === 1 ? "1 customer" : `${visible.length} customers`}
      </p>

      {visible.length === 0 ? (
        <NoMatches
          message={query.trim() !== "" ? `No customers match “${query.trim()}”.` : view === "archived" ? "No archived customers." : "All your customers are archived."}
          clearLabel={query.trim() === "" && view === "current" ? "Show archived" : undefined}
          onClear={() => setView("archived")}
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((c) => (
            <li key={c.id}>
              <Link
                href={`/app/customers/${c.id}`}
                className="block rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex items-center gap-2">
                  <span className="truncate text-base font-medium">{c.name}</span>
                  {c.kind === "business" && (
                    <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                      Business
                    </span>
                  )}
                  {c.archived && (
                    <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                      Archived
                    </span>
                  )}
                </span>
                {secondaryLine(c) && (
                  <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                    {secondaryLine(c)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function secondaryLine(c: CustomerSummary): string {
  return [c.contactPerson, c.phone, c.email, c.city].filter(Boolean).join(" · ");
}
