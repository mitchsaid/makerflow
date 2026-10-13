"use client";

import { useState, useTransition } from "react";
import { AddButton } from "@/components/add-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { dismissLogoPrompt } from "../business/logo-actions";
import { LogoForm } from "../business/logo-form";

/** Where focus goes when the card or the sheet goes away: the page's own heading (see the preview page). */
const PAGE_TITLE = "preview-title";
const focusTitle = () => setTimeout(() => document.getElementById(PAGE_TITLE)?.focus(), 0);

/**
 * On the quote preview, for people who can set the logo: while the business has none (and they have not said "Not
 * now"), a friendly card offers to add one right here. It opens the Business profile's own logo form in a sheet.
 * Saving closes the sheet and the quote redraws with the logo on it (the save refreshes the page). "Not now" is
 * remembered for this person, as the business-type prompt is.
 *
 * This component stays on the page after the logo is saved, so the sheet can finish closing and hand focus back.
 */
export function LogoPrompt({ businessName, askForLogo }: { businessName: string; askForLogo: boolean }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <>
      {askForLogo && !hidden && (
        <Alert role="region" aria-label="Add your logo" data-testid="logo-prompt">
          <AlertTitle>Add your logo</AlertTitle>
          <AlertDescription className="space-y-3">
            <span className="block">It is printed at the top of your quotes, so they look like yours.</span>
            <span className="flex flex-wrap gap-2">
              <AddButton id="add-logo" variant="default" onClick={() => setOpen(true)}>
                Add your logo
              </AddButton>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setHidden(true);
                  focusTitle();
                  // Quietly remembered; if that fails the card simply comes back next time.
                  startTransition(async () => {
                    await dismissLogoPrompt().catch(() => undefined);
                  });
                }}
              >
                Not now
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      )}
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && !saving && setOpen(false)}>
        <SheetContent
          side="right"
          className="h-dvh gap-0 overflow-y-auto"
          finalFocus={() => document.getElementById(askForLogo ? "add-logo" : PAGE_TITLE) ?? document.getElementById(PAGE_TITLE) ?? true}
        >
          <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover pr-14">
            <SheetTitle className="text-lg">Add your logo</SheetTitle>
            <SheetDescription className="text-base">
              Saved to your Business profile, where you can change it any time.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pt-4">
            <LogoForm
              key={open ? "open" : "closed"}
              initial=""
              businessName={businessName}
              embedded={{
                onPendingChange: setSaving,
                onCancel: () => setOpen(false),
                // The page redraws from the save itself (it revalidates), with the logo on the quote and no card.
                onDone: () => setOpen(false),
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
