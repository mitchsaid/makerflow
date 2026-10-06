"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { matchesSearch, type CustomerSummary } from "@/lib/customers";

/**
 * The customers list: search as you type, archived customers hidden until asked for. The
 * whole list is loaded once (a maker's customers are hundreds, not millions), so searching
 * needs no round trip.
 */
export function CustomerList({
  customers,
  addedName,
}: {
  customers: CustomerSummary[];
  /** Name of a customer that was just added, for a confirmation line. */
  addedName?: string;
}) {
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const archivedCount = customers.filter((c) => c.archived).length;
  const visible = customers.filter(
    (c) => (showArchived || !c.archived) && matchesSearch(c, query),
  );

  if (customers.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-4">
          <p className="text-base font-medium">No customers yet</p>
          <p className="text-muted-foreground">
            Add the people you make things for. Only a name is needed, and you can add the
            rest later.
          </p>
          <Link href="/app/customers/new" className={buttonVariants()}>
            Add your first customer
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
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
        <Field orientation="horizontal" className="items-start py-2.5">
          <Checkbox
            id="show-archived"
            checked={showArchived}
            onCheckedChange={(checked) => setShowArchived(checked)}
          />
          <FieldLabel htmlFor="show-archived" className="text-base">
            Show archived ({archivedCount})
          </FieldLabel>
        </Field>
      )}

      <p className="text-sm text-muted-foreground" aria-live="polite" data-testid="customer-count">
        {visible.length === 1 ? "1 customer" : `${visible.length} customers`}
      </p>

      {visible.length === 0 ? (
        <p className="text-muted-foreground">No customers match &ldquo;{query}&rdquo;.</p>
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
