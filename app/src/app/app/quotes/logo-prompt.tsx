"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AddButton } from "@/components/add-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LogoForm } from "../business/logo-form";
import { LOGO_PROMPT_COOKIE } from "./logo-prompt-cookie";

/**
 * On the quote preview, while the business has no logo: a friendly card that offers to add one right here (the
 * Business profile's own "Your logo" section, in a sheet). Saving closes the sheet and the quote redraws with the
 * logo on it. "Not now" hides the card on this device (a cookie, so the server leaves it out and the page does not
 * jump); it only decides whether to ask again.
 */
export function LogoPrompt({ businessName }: { businessName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  return (
    <>
      <Alert data-testid="logo-prompt">
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
                document.cookie = `${LOGO_PROMPT_COOKIE}=1; path=/app; max-age=31536000; samesite=lax`;
                setHidden(true);
              }}
            >
              Not now
            </Button>
          </span>
        </AlertDescription>
      </Alert>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="h-dvh gap-0 overflow-y-auto"
          finalFocus={() => document.getElementById("add-logo") ?? true}
        >
          <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover pr-14">
            <SheetTitle className="text-lg">Add your logo</SheetTitle>
            <SheetDescription className="text-base">You can change it any time on your Business profile.</SheetDescription>
          </SheetHeader>
          <div className="px-4 py-4">
            <LogoForm
              initial=""
              businessName={businessName}
              onSaved={() => {
                setOpen(false);
                // The quote on screen is drawn from the saved business: draw it again with the logo.
                router.refresh();
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
