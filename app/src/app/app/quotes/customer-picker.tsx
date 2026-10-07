"use client";

import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Customer, CustomerOption, SavedAddress } from "@/lib/customers";
import {
  createCustomerInQuote,
  loadCustomerForEdit,
  updateCustomer,
  type CustomerSummaryOption,
} from "../customers/actions";
import { CustomerForm } from "../customers/customer-form";
import { EMPTY_CUSTOMER, valuesFromCustomer } from "../customers/customer-values";

type Choice =
  | { kind: "customer"; customer: CustomerOption }
  | { kind: "add"; name: string };

/** The customer form, shown over the quote: adding someone new, or changing the chosen customer. */
type SheetState = { kind: "add"; name: string } | { kind: "edit"; customer: Customer } | null;

const MAX_SHOWN = 6;

function tidy(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

/** Move keyboard focus once the next render has put the element on the page. */
function focusSoon(elementId: string) {
  setTimeout(() => document.getElementById(elementId)?.focus(), 0);
}

/**
 * Choose who the quote is for. Type to search; if nobody matches, “Add 'Name' as a new
 * customer” opens the full customer form over the quote (name filled in) and, once saved,
 * the new customer is chosen. The chosen customer can be edited the same way. The quote
 * underneath keeps everything typed. Keyboard: arrows move, Enter chooses, Escape closes.
 */
export function CustomerPicker({
  id,
  customers,
  onCustomersChange,
  countryCode,
  value,
  onChange,
  error,
}: {
  id: string;
  customers: CustomerOption[];
  /** The list is kept by the quote (it needs the chosen customer's addresses), so changes go up. */
  onCustomersChange: (update: (list: CustomerOption[]) => CustomerOption[]) => void;
  /** The business's country, for the customer form's province list and so on. */
  countryCode: string;
  /** The chosen customer's id, or "". */
  value: string;
  /** The addresses come too: the list the quote keeps may not have this customer in it yet. */
  onChange: (customerId: string, addresses: SavedAddress[]) => void;
  error?: string;
}) {
  const listId = useId();
  const setCustomers = onCustomersChange;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // The highlighted option: -1 until the person types or uses the arrow keys, so that Enter on
  // a just-opened list does not pick someone by accident.
  const [active, setActive] = useState(-1);
  // The sheet's content stays while it animates closed, so `sheet` is kept and `sheetOpen` says
  // whether it is showing (otherwise the title flips to "Add a customer" as an edit sheet closes).
  const [sheet, setSheet] = useState<SheetState>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // A save is on its way: closing now would lose the result (the customer would exist but not
  // be chosen).
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Left the search box with a name typed but nobody chosen: say so, or the quote is saved
  // without a customer while the box still shows a name.
  const [leftUnchosen, setLeftUnchosen] = useState(false);
  const [opening, startOpening] = useTransition();

  const selected = customers.find((c) => c.id === value);
  const q = tidy(query).toLowerCase();

  const matches = customers
    .filter((c) => !c.archived)
    .filter((c) => q === "" || `${c.name} ${c.detail}`.toLowerCase().includes(q))
    .slice(0, MAX_SHOWN);
  // An archived customer with this name does not count: they are not offered, so adding is fine.
  const exactMatch = customers.some((c) => !c.archived && tidy(c.name).toLowerCase() === q);
  const choices: Choice[] = [
    ...matches.map((customer): Choice => ({ kind: "customer", customer })),
    ...(q !== "" && !exactMatch ? [{ kind: "add", name: tidy(query) } as Choice] : []),
  ];

  const optionId = (i: number) => `${listId}-option-${i}`;

  function select(customerId: string, addresses: SavedAddress[]) {
    onChange(customerId, addresses);
    setLeftUnchosen(false);
    setQuery("");
    setOpen(false);
    setSheetOpen(false);
    focusSoon(`${id}-edit`);
  }

  /** Choose someone the form found as a likely duplicate (they may not be in our list yet). */
  function useExisting(option: CustomerSummaryOption) {
    setCustomers((list) =>
      list.some((c) => c.id === option.id)
        ? list
        : [...list, { id: option.id, name: option.name, detail: option.detail, archived: false, addresses: option.addresses }],
    );
    select(option.id, customers.find((c) => c.id === option.id)?.addresses ?? option.addresses);
  }

  function choose(choice: Choice) {
    setLoadError(null);
    if (choice.kind === "customer") {
      select(choice.customer.id, choice.customer.addresses);
      return;
    }
    openAdd(choice.name);
  }

  function openAdd(name: string) {
    setOpen(false);
    setLeftUnchosen(false);
    setSheet({ kind: "add", name });
    setSheetOpen(true);
  }

  function openEdit(customerId: string) {
    setLoadError(null);
    startOpening(async () => {
      try {
        const result = await loadCustomerForEdit(customerId);
        if (result.status === "error") {
          setLoadError(result.message);
          return;
        }
        setSheet({ kind: "edit", customer: result.customer });
        setSheetOpen(true);
      } catch (error) {
        // No signal, say: show a message rather than losing the quote to an error page.
        console.error("could not open the customer:", error);
        setLoadError("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  function onSheetDone(option: CustomerSummaryOption) {
    const kind = sheet?.kind;
    setCustomers((list) => {
      const existing = list.find((c) => c.id === option.id);
      return existing
        ? list.map((c) => (c.id === option.id ? { ...c, name: option.name, detail: option.detail, addresses: option.addresses } : c))
        : [...list, { id: option.id, name: option.name, detail: option.detail, archived: false, addresses: option.addresses }];
    });
    if (kind === "add") {
      select(option.id, option.addresses);
    } else {
      setSheetOpen(false);
      focusSoon(`${id}-edit`);
    }
  }

  function closeSheet() {
    if (saving) return;
    setSheetOpen(false);
    focusSoon(sheet?.kind === "edit" ? `${id}-edit` : id);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(choices.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      // Enter here chooses a customer; it must never save the whole quote.
      event.preventDefault();
      if (open && active >= 0 && choices[active]) choose(choices[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const sheetView = (
    <Sheet open={sheetOpen} onOpenChange={(isOpen) => !isOpen && closeSheet()}>
      <SheetContent
        side="right"
        className="h-dvh gap-0 overflow-y-auto"
        // After choosing someone, focus their card; otherwise back to the search box.
        finalFocus={() => document.getElementById(`${id}-edit`) ?? document.getElementById(id) ?? true}
      >
        <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover pr-14">
          <SheetTitle className="text-lg">
            {sheet?.kind === "edit" ? "Customer details" : "Add a customer"}
          </SheetTitle>
          <SheetDescription className="text-base">
            {sheet?.kind === "edit"
              ? "Changes are saved to the customer, not just this quote."
              : "Only a name is needed. Your quote is kept as it is."}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pt-4">
          {sheet?.kind === "add" && (
            <CustomerForm
              key="add"
              mode="add"
              action={createCustomerInQuote}
              initial={{ ...EMPTY_CUSTOMER, name: sheet.name }}
              countryCode={countryCode}
              embedded={{
                onDone: onSheetDone,
                onCancel: closeSheet,
                onUseExisting: useExisting,
                onPendingChange: setSaving,
              }}
              idPrefix="customer-sheet-"
            />
          )}
          {sheet?.kind === "edit" && (
            <CustomerForm
              key={sheet.customer.id}
              mode="edit"
              action={updateCustomer.bind(null, sheet.customer.id)}
              initial={valuesFromCustomer(sheet.customer)}
              countryCode={countryCode}
              embedded={{
                onDone: onSheetDone,
                onCancel: closeSheet,
                onUseExisting: useExisting,
                onPendingChange: setSaving,
              }}
              idPrefix="customer-sheet-"
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );

  if (selected) {
    return (
      <div className="space-y-2">
        <div className="space-y-3 rounded-lg border border-input bg-card px-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-base font-medium" data-testid="selected-customer">
              {selected.name}
            </p>
            {selected.detail && (
              <p className="truncate text-sm text-muted-foreground" data-testid="selected-customer-detail">
                {selected.detail}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              id={`${id}-edit`}
              type="button"
              variant="outline"
              disabled={opening}
              onClick={() => openEdit(selected.id)}
            >
              {opening ? "Opening…" : "Edit details"}
              <span className="sr-only"> for {selected.name}</span>
            </Button>
            <Button
              id={`${id}-change`}
              type="button"
              variant="outline"
              onClick={() => {
                onChange("", []);
                focusSoon(id);
              }}
            >
              Change<span className="sr-only"> customer</span>
            </Button>
          </div>
        </div>
        {loadError && <FieldError>{loadError}</FieldError>}
        {sheetView}
      </div>
    );
  }

  return (
    <Field data-invalid={!!error}>
      {/* The section is already titled "Customer": the label is for screen readers. */}
      <FieldLabel htmlFor={id} className="sr-only">
        Customer name
      </FieldLabel>
      <div className="relative">
        <Input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 && choices[active] ? optionId(active) : undefined}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          autoComplete="off"
          placeholder="Search, or type a new name"
          value={query}
          onChange={(e) => {
            setLeftUnchosen(false);
            setQuery(e.target.value);
            setActive(e.target.value.trim() === "" ? -1 : 0);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            // Coming back to a search that already has text keeps its highlighted match.
            if (query.trim() === "") setActive(-1);
          }}
          onBlur={() => {
            setOpen(false);
            setLeftUnchosen(tidy(query) !== "");
          }}
          onKeyDown={onKeyDown}
        />
        <ul
          id={listId}
          role="listbox"
          aria-label="Customers"
          hidden={!open || choices.length === 0}
          className="mt-1 rounded-lg border border-input bg-card py-1 shadow-sm"
        >
          {choices.map((choice, i) => (
            <li
              key={choice.kind === "customer" ? choice.customer.id : "add"}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              // Keep the input focused so the list does not close before the tap registers.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(choice)}
              className={`flex min-h-11 cursor-pointer flex-col justify-center px-3 py-1.5 text-base ${
                i === active ? "bg-muted" : ""
              }`}
            >
              {choice.kind === "customer" ? (
                <>
                  <span className="truncate font-medium">{choice.customer.name}</span>
                  {choice.customer.detail && (
                    <span className="truncate text-sm text-muted-foreground">
                      {choice.customer.detail}
                    </span>
                  )}
                </>
              ) : (
                <span className="font-medium text-primary">Add “{choice.name}” as a new customer</span>
              )}
            </li>
          ))}
        </ul>
      </div>
      {leftUnchosen && !open && (
        <p role="status" className="text-sm" data-testid="customer-not-chosen">
          “{tidy(query)}” isn&apos;t chosen yet. Pick them from the list, or add them as a new
          customer.
        </p>
      )}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
      {/* In view whenever the list is not, so adding someone never depends on finding an option. */}
      {!(open && choices.length > 0) && (
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => openAdd(tidy(query))}>
          {tidy(query) !== "" ? `Add “${tidy(query)}” as a new customer` : "Add new customer"}
        </Button>
      )}
      {sheetView}
    </Field>
  );
}
