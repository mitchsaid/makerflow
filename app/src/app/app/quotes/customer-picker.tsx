"use client";

import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { addCustomerByName } from "../customers/actions";

export type CustomerOption = {
  id: string;
  name: string;
  /** Phone, email or town: whatever helps tell two people apart. */
  detail: string;
  archived: boolean;
};

type Choice =
  | { kind: "customer"; customer: CustomerOption }
  | { kind: "add"; name: string };

const MAX_SHOWN = 8;

function tidy(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

/**
 * Choose who the quote is for. Type to search; if nobody matches, “Add 'Name'” creates the
 * customer on the spot (name only: the details can be added later on their own page).
 * Keyboard: arrows move, Enter chooses, Escape closes.
 */
export function CustomerPicker({
  id,
  customers: initialCustomers,
  value,
  onChange,
  error,
}: {
  id: string;
  customers: CustomerOption[];
  /** The chosen customer's id, or "". */
  value: string;
  onChange: (customerId: string) => void;
  error?: string;
}) {
  const listId = useId();
  const [customers, setCustomers] = useState(initialCustomers);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, startAdding] = useTransition();

  const selected = customers.find((c) => c.id === value);
  const q = tidy(query).toLowerCase();

  const matches = customers
    .filter((c) => !c.archived)
    .filter((c) => q === "" || `${c.name} ${c.detail}`.toLowerCase().includes(q))
    .slice(0, MAX_SHOWN);
  const exactMatch = customers.some((c) => tidy(c.name).toLowerCase() === q);
  const choices: Choice[] = [
    ...matches.map((customer): Choice => ({ kind: "customer", customer })),
    ...(q !== "" && !exactMatch ? [{ kind: "add", name: tidy(query) } as Choice] : []),
  ];

  const optionId = (i: number) => `${listId}-option-${i}`;

  function choose(choice: Choice) {
    setAddError(null);
    if (choice.kind === "customer") {
      setNotice(null);
      onChange(choice.customer.id);
      setQuery("");
      setOpen(false);
      return;
    }
    startAdding(async () => {
      const result = await addCustomerByName(choice.name);
      if (result.status === "error") {
        setAddError(result.message);
        return;
      }
      const created = result.customer;
      setCustomers((list) => [...list, { id: created.id, name: created.name, detail: "", archived: false }]);
      setNotice(`Added ${created.name}. You can add their phone and address later in Customers.`);
      onChange(created.id);
      setQuery("");
      setOpen(false);
    });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(choices.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && open && choices[active]) {
      event.preventDefault();
      choose(choices[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  if (selected) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-input bg-card px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-base font-medium" data-testid="selected-customer">
              {selected.name}
            </p>
            {selected.detail && (
              <p className="truncate text-sm text-muted-foreground">{selected.detail}</p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onChange("");
              setNotice(null);
            }}
          >
            Change<span className="sr-only"> customer</span>
          </Button>
        </div>
        {notice && (
          <p role="status" className="text-sm text-muted-foreground">
            {notice}
          </p>
        )}
      </div>
    );
  }

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>Customer</FieldLabel>
      <div className="relative">
        <Input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && choices[active] ? optionId(active) : undefined}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          autoComplete="off"
          placeholder="Search, or type a new name"
          value={query}
          disabled={adding}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        <ul
          id={listId}
          role="listbox"
          aria-label="Customers"
          hidden={!open || choices.length === 0}
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-lg border border-input bg-card py-1 shadow-md"
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
      {customers.length === 0 && !query && (
        <p className="text-sm text-muted-foreground">
          No customers yet. Type a name to add the first one.
        </p>
      )}
      {addError && <FieldError>{addError}</FieldError>}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  );
}
