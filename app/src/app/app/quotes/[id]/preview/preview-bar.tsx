"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { waitForDesignSave } from "../../design-saves";
import { EmailQuoteSheet } from "../../email-sheet";
import { SendQuoteSheet } from "../../send-sheet";

/**
 * Stays in view above the tab bar: back to editing, and the three ways on. Download saves the PDF and changes
 * nothing (the maker may only be checking it, or sending it by hand). Email is not built yet and says so. Mark as
 * sent locks the quote as sent, for a quote that has gone to the customer.
 */
export function PreviewBar({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [markOpen, setMarkOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  return (
    <div data-testid="action-bar" className="sticky bottom-14 z-10 -mx-4 -mb-8 border-t border-border bg-card px-4 py-3 md:bottom-0">
      <div className="mx-auto grid max-w-2xl grid-cols-2 gap-2 sm:flex sm:items-center">
        <Link href={`/app/quotes/${quoteId}`} className={buttonVariants({ variant: "outline", size: "lg" }) + " px-3"}>
          Edit
        </Link>
        <a
          href={`/app/quotes/${quoteId}/pdf?download=1`}
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
        <Button id="email-quote" type="button" variant="outline" size="lg" className="px-3" onClick={() => setEmailOpen(true)}>
          Email
        </Button>
        <Button
          id="mark-sent"
          type="button"
          size="lg"
          className="px-3 sm:flex-1"
          onClick={async () => {
            await waitForDesignSave();
            setMarkOpen(true);
          }}
        >
          Mark as sent
        </Button>
      </div>
      <SendQuoteSheet
        quoteId={quoteId}
        open={markOpen}
        onOpenChange={setMarkOpen}
        returnFocusId="mark-sent"
        // What needs fixing is on the edit screen: go there and land on it.
        onFix={(fieldId) => router.push(`/app/quotes/${quoteId}?focus=${encodeURIComponent(fieldId)}`)}
      />
      <EmailQuoteSheet open={emailOpen} onOpenChange={setEmailOpen} returnFocusId="email-quote" />
    </div>
  );
}
