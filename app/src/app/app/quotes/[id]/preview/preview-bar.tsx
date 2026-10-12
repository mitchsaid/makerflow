"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { waitForDesignSave } from "../../design-saves";
import { SendQuoteSheet } from "../../send-sheet";

/**
 * Stays in view above the tab bar: back to editing, download, and share. A download does not lock the quote (the
 * maker may only be checking it, or sending it by hand), so right after one the bar asks, once and dismissably,
 * whether it has been sent: "Mark as sent" opens the same sheet as Share, with that choice first.
 */
export function PreviewBar({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  // Whether the sheet is open and which choice it puts first are kept apart, so it does not change while it fades out.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<"share" | "marked">("share");
  const [downloaded, setDownloaded] = useState(false);
  return (
    <div data-testid="action-bar" className="sticky bottom-14 z-10 -mx-4 -mb-8 border-t border-border bg-card px-4 py-3 md:bottom-0">
      {downloaded && (
        <Alert className="mx-auto mb-3 max-w-2xl" data-testid="after-download">
          <AlertDescription className="space-y-2">
            <span className="block">
              Have you sent it to your customer? Mark the quote as sent: it is locked so it cannot change by accident,
              and you can record their answer.
            </span>
            <span className="flex flex-wrap gap-2">
              <Button
                id="after-download-mark"
                type="button"
                onClick={async () => {
                  await waitForDesignSave();
                  setMode("marked");
                  setSheetOpen(true);
                }}
              >
                Mark as sent
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDownloaded(false);
                  // The prompt held focus: give it back to the way on.
                  setTimeout(() => document.getElementById("send-quote")?.focus(), 0);
                }}
              >
                Not yet
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      )}
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
            setDownloaded(true);
          }}
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          Download
        </a>
        <Button id="send-quote" type="button" size="lg" className="flex-1" onClick={async () => {
            // Never send a look that is a tap behind: the server reads what is saved.
            await waitForDesignSave();
            setMode("share");
            setSheetOpen(true);
          }}>
          Share
        </Button>
      </div>
      <SendQuoteSheet
        quoteId={quoteId}
        open={sheetOpen}
        emphasis={mode}
        onOpenChange={setSheetOpen}
        // Back to the button that opened it (the prompt's, if it is still there).
        returnFocusId={mode === "marked" && downloaded ? "after-download-mark" : "send-quote"}
        // What needs fixing is on the edit screen: go there and land on it.
        onFix={(fieldId) => router.push(`/app/quotes/${quoteId}?focus=${encodeURIComponent(fieldId)}`)}
      />
    </div>
  );
}
