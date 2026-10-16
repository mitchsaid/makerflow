"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDocumentNumber } from "@/lib/quotes/numbering";
import { QuoteNumberingForm } from "../documents/quote-numbering-form";

/** How the business numbers its quotes right now (what the next new quote will be called). */
export type QuoteNumbering = { prefix: string; nextNumber: number; minDigits: number; lastIssued: number | null };

/**
 * On a new quote: the number it is about to get, so the maker is not left wondering, with a way to change how quotes
 * are numbered without leaving the quote (the same prefix and next-number form as under Quotes and invoices, in a
 * sheet). The number itself is never typed onto one quote: numbers stay gapless and automatic. Only owners and admins
 * can change the numbering; everyone sees the number.
 */
export function QuoteNumber({
  numbering,
  onChange,
  canChange,
}: {
  numbering: QuoteNumbering;
  onChange: (numbering: QuoteNumbering) => void;
  canChange: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const change = useRef<HTMLButtonElement>(null);
  const number = formatDocumentNumber(numbering.prefix, numbering.nextNumber, numbering.minDigits);

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">Quote number</p>
        <p className="text-lg font-semibold" data-testid="quote-number">
          {number}
        </p>
        <p className="text-sm text-muted-foreground">Given when you first save it.</p>
      </div>
      {canChange && (
        <Button
          ref={change}
          type="button"
          variant="soft"
          aria-label={`Change how quotes are numbered (now ${number})`}
          onClick={() => setOpen(true)}
        >
          Change
        </Button>
      )}
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && !saving && setOpen(false)}>
        <SheetContent side="right" className="h-dvh gap-0 overflow-y-auto" finalFocus={() => change.current ?? true}>
          <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover pr-14">
            <SheetTitle className="text-lg">Quote numbers</SheetTitle>
            <SheetDescription className="text-base">
              Changes the numbering for all your quotes.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 py-4">
            {open && (
              <QuoteNumberingForm
                initialPrefix={numbering.prefix}
                initialNext={numbering.nextNumber}
                minDigits={numbering.minDigits}
                lastIssued={numbering.lastIssued}
                embedded={{
                  onPendingChange: setSaving,
                  onCancel: () => setOpen(false),
                  onDone: ({ prefix, nextNumber }) => {
                    onChange({ ...numbering, prefix, nextNumber });
                    setOpen(false);
                  },
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
