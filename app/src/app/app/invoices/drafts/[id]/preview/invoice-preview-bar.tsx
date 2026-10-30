"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { waitForDesignSave } from "../../../../quotes/design-saves";
import { issueStoredInvoiceDraft } from "../../../draft-actions";

const OFFLINE = "Couldn't reach the server. Open the invoice draft to see if it went through before trying again.";

/**
 * Stays in view above the tab bar: back to editing, a copy to download (a draft, with no number), or mark it as sent.
 * Marking it as sent asks once ("It gets the next invoice number and can't be changed after this"), then opens the invoice, where
 * its numbered PDF is shared or downloaded. If something stops it, it says what, here.
 */
export function InvoicePreviewBar({ draftId, customerName, totalText }: { draftId: string; customerName: string; totalText: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function issue() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await issueStoredInvoiceDraft(draftId);
        if (result.status === "problems") {
          // The page lists what is missing, with the way to fix it.
          setOpen(false);
          router.refresh();
        } else if (result.status === "invalid") {
          setMessage("This invoice needs a change before it can be sent. Go back and edit it.");
        } else {
          setMessage(result.message);
        }
      } catch (error) {
        // Issuing ends by opening the invoice: that is a redirect, not a failure.
        const digest = (error as { digest?: unknown } | null)?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw error;
        setMessage(OFFLINE);
      }
    });
  }

  return (
    <div data-testid="action-bar" className="sticky bottom-14 z-10 -mx-4 -mb-8 transform-gpu border-t border-border bg-card px-4 py-3 md:bottom-0">
      <div className="mx-auto grid max-w-2xl grid-cols-2 gap-2 sm:flex sm:items-center">
        <Link href={`/app/invoices/drafts/${draftId}`} className={buttonVariants({ variant: "outline", size: "lg" }) + " px-3"}>
          Edit
        </Link>
        {/* A copy to check or show: it is a draft, with no number. The numbered PDF is on the invoice once it is sent. */}
        <a
          href={`/app/invoices/drafts/${draftId}/pdf?download=1`}
          onClick={async (event) => {
            event.preventDefault();
            // Read it now: the event is cleared once this handler's first step is over.
            const href = event.currentTarget.href;
            // Never download a look that is a tap behind: the server reads what is saved.
            await waitForDesignSave();
            window.location.assign(href);
          }}
          className={buttonVariants({ variant: "outline", size: "lg" }) + " px-3"}
        >
          Download
        </a>
        <Button id="issue-invoice" type="button" size="lg" className="col-span-2 px-3 sm:col-span-1 sm:flex-1" onClick={async () => {
            // The numbered invoice is drawn in what is saved: never one that is a tap behind.
            await waitForDesignSave();
            setOpen(true);
          }}>
          Mark as sent
        </Button>
      </div>
      <Sheet open={open} onOpenChange={(isOpen) => !pending && setOpen(isOpen)}>
        <SheetContent side="right" className="h-dvh gap-0 overflow-y-auto" finalFocus={() => document.getElementById("issue-invoice") ?? true}>
          <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover pr-14">
            <SheetTitle className="text-lg">Mark this invoice as sent?</SheetTitle>
            <SheetDescription className="text-base">
              {customerName} · {totalText}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 py-4">
            {message && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}
            <p className="text-base">It gets the next invoice number and can&apos;t be changed after this. Then you can share or download the numbered PDF to send. If something is wrong, a credit note corrects it.</p>
            <Button type="button" size="lg" className="w-full" disabled={pending} onClick={issue}>
              {pending ? "Saving…" : "Mark as sent"}
            </Button>
            <Button type="button" variant="outline" size="lg" className="w-full" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
