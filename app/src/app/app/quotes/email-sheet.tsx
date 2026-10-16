"use client";

import { ComingSoonSection } from "@/components/coming-soon";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * What "Email" will do, shown where it will live (docs/product-brief.md, principle 9). Sending from MakerFlow needs a
 * sending domain that does not exist yet, so for now this says so, and what to do meanwhile. It has no inputs.
 */
export function EmailQuoteSheet({
  open,
  onOpenChange,
  returnFocusId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes when the sheet closes. */
  returnFocusId: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="h-dvh gap-0 overflow-y-auto"
        finalFocus={() => document.getElementById(returnFocusId) ?? true}
      >
        <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover pr-14">
          <SheetTitle className="text-lg">Email this quote</SheetTitle>
          <SheetDescription className="text-base">Emailing from MakerFlow is not ready yet.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 py-4">
          <ComingSoonSection
            title="Email it to your customer"
            description="Send it from MakerFlow and see when it was sent."
          />
          <ComingSoonSection
            title="Send a link they can accept online"
            description="Customers accept online or ask for changes."
          />
          <p className="text-base">
            Until then: download the PDF, send it from your own email or WhatsApp, then choose &ldquo;Mark as sent&rdquo;.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
