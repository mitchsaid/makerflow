"use client";

import "./font-previews";
import { useState } from "react";
import { CheckIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CATEGORY_LABELS, FONT_LIST, fontEntry, type FontCategory } from "@/lib/quotes/font-list";

const ORDER: FontCategory[] = ["sans", "serif", "display", "script"];

/**
 * Choose a font: a button showing the current one in its own font, and a sheet listing every font
 * (grouped: clean, serif, bold headings, handwritten), each name and a line of sample text drawn in that
 * font. The sheet is for choosing and closes on a pick.
 */
export function FontPicker({
  id,
  label,
  value,
  onChange,
  sample,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (fontId: string) => void;
  /** The line shown in each font. */
  sample: string;
}) {
  const [open, setOpen] = useState(false);
  const current = fontEntry(value);

  return (
    <div className="space-y-2">
      <p id={`${id}-label`} className="text-sm font-medium">
        {label}
      </p>
      <Button
        id={id}
        type="button"
        variant="outline"
        aria-labelledby={`${id}-label ${id}`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="h-auto w-full justify-between gap-3 py-3 text-left font-normal"
      >
        <span className="min-w-0">
          <span className="block truncate text-xl" style={{ fontFamily: `"${current.label}"` }}>
            {current.label}
          </span>
          <span className="block text-sm text-muted-foreground">{CATEGORY_LABELS[current.category]}</span>
        </span>
        <ChevronRightIcon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto p-4">
          <SheetHeader>
            <SheetTitle>{label}: choose a font</SheetTitle>
            <SheetDescription>Each one is shown as it will print.</SheetDescription>
          </SheetHeader>
          {ORDER.map((category) => (
            <section key={category} className="space-y-1" aria-labelledby={`${id}-${category}`}>
              <h3 id={`${id}-${category}`} className="px-1 pt-2 text-sm font-medium text-muted-foreground">
                {CATEGORY_LABELS[category]}
              </h3>
              <ul className="space-y-1">
                {FONT_LIST.filter((f) => f.category === category).map((f) => {
                  const pressed = f.id === value;
                  return (
                    <li key={f.id}>
                      <Button
                        type="button"
                        variant="outline"
                        aria-pressed={pressed}
                        data-testid={`font-${f.id}`}
                        onClick={() => {
                          onChange(f.id);
                          setOpen(false);
                        }}
                        className="h-auto w-full justify-between gap-3 py-3 text-left font-normal aria-pressed:border-primary aria-pressed:bg-primary/5 aria-pressed:ring-2 aria-pressed:ring-primary"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xl" style={{ fontFamily: `"${f.label}"` }}>
                            {f.label}
                          </span>
                          <span className="block truncate text-sm text-muted-foreground" style={{ fontFamily: `"${f.label}"` }}>
                            {sample}
                          </span>
                        </span>
                        {pressed && <CheckIcon aria-hidden="true" className="size-5 shrink-0 text-primary" />}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </SheetContent>
      </Sheet>
    </div>
  );
}
