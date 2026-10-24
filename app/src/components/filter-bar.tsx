"use client";

import { Button } from "@/components/ui/button";

export type FilterOption<K extends string> = { key: K; label: string; count?: number };

/**
 * The one way to narrow a list: a single row of chips (it scrolls sideways on a phone rather than wrapping onto
 * several lines), each with how many are in it. Used by Quotes, Jobs, Invoices, and by Customers, Products and
 * Materials for archived ones. It only chooses; the list filters what it already has, so the change is immediate.
 */
export function FilterBar<K extends string>({
  label,
  options,
  value,
  onChange,
}: {
  /** Names the group for screen readers: "Show jobs". */
  label: string;
  options: readonly FilterOption<K>[];
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <div role="group" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map((o) => (
        <Button key={o.key} type="button" variant={value === o.key ? "default" : "outline"} aria-pressed={value === o.key} onClick={() => onChange(o.key)}>
          {o.label}
          {o.count !== undefined ? ` (${o.count})` : ""}
        </Button>
      ))}
    </div>
  );
}
