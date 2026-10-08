"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { waitForDesignSave } from "../../design-saves";
import { SendQuoteSheet } from "../../send-sheet";

/** Stays in view above the tab bar: back to editing, download, and send. */
export function PreviewBar({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [sendOpen, setSendOpen] = useState(false);
  return (
    <div data-testid="action-bar" className="sticky bottom-14 z-10 -mx-4 -mb-8 border-t border-border bg-card px-4 py-3 md:bottom-0">
      <div className="mx-auto flex max-w-2xl items-center gap-2">
        <Link href={`/app/quotes/${quoteId}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
          Edit
        </Link>
        <a
          href={`/app/quotes/${quoteId}/pdf?download=1`}
          onClick={async (event) => {
            event.preventDefault();
            // Read it now: the event is cleared once this handler's first step is over.
            const href = event.currentTarget.href;
            await waitForDesignSave();
            window.location.assign(href);
          }}
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          Download
        </a>
        <Button id="send-quote" type="button" size="lg" className="flex-1" onClick={async () => {
            // Never send a look that is a tap behind: the server reads what is saved.
            await waitForDesignSave();
            setSendOpen(true);
          }}>
          Send
        </Button>
      </div>
      <SendQuoteSheet
        quoteId={quoteId}
        open={sendOpen}
        onOpenChange={setSendOpen}
        returnFocusId="send-quote"
        // What needs fixing is on the edit screen: go there and land on it.
        onFix={(fieldId) => router.push(`/app/quotes/${quoteId}?focus=${encodeURIComponent(fieldId)}`)}
      />
    </div>
  );
}
