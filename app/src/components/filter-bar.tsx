"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export type FilterOption<K extends string> = { key: K; label: string; count?: number };

/**
 * The one way to narrow a list: a single row of chips (it scrolls sideways on a phone rather than wrapping onto
 * several lines), each with how many are in it. Used by Quotes, Jobs, Invoices, and by Customers, Products and
 * Materials for archived ones. It only chooses; the list filters what it already has, so the change is immediate.
 * It always opens at the first chip, and an edge with more chips beyond it fades, so it is plain that it scrolls.
 */
export function FilterBar<K extends string>({
  label,
  options,
  value,
  onChange,
  wrap = false,
}: {
  /** Names the group for screen readers: "Show jobs". */
  label: string;
  options: readonly FilterOption<K>[];
  value: K;
  onChange: (key: K) => void;
  /**
   * Every chip in view, wrapping onto more lines instead of scrolling: for a short, fixed set the maker picks one of (a job's
   * status), where hiding one off the edge would hide a choice.
   */
  wrap?: boolean;
}) {
  const row = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ before: false, after: false });

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    // Start at the first chip, whatever the browser restored.
    el.scrollLeft = 0;
    const measure = () =>
      setMore({ before: el.scrollLeft > 1, after: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);

  if (wrap) {
    return (
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Button key={o.key} type="button" variant={value === o.key ? "default" : "outline"} aria-pressed={value === o.key} onClick={() => onChange(o.key)}>
            {o.label}
            {o.count !== undefined ? ` (${o.count})` : ""}
          </Button>
        ))}
      </div>
    );
  }

  const fade = `linear-gradient(to right, ${more.before ? "transparent, black 2.5rem" : "black, black"}, ${more.after ? "black calc(100% - 2.5rem), transparent" : "black, black"})`;

  return (
    <div
      ref={row}
      role="group"
      aria-label={label}
      data-more={more.after ? "after" : undefined}
      style={more.before || more.after ? { maskImage: fade, WebkitMaskImage: fade } : undefined}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {options.map((o) => (
        <Button key={o.key} type="button" variant={value === o.key ? "default" : "outline"} aria-pressed={value === o.key} onClick={() => onChange(o.key)}>
          {o.label}
          {o.count !== undefined ? ` (${o.count})` : ""}
        </Button>
      ))}
    </div>
  );
}
