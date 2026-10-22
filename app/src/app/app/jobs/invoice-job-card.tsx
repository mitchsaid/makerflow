"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { dismissInvoiceJobPrompt } from "./actions";

/**
 * On a finished job made from a quote: a friendly card offering to invoice it. "Create invoice" opens the quote with
 * its own Create invoice sheet ready (nothing is copied here). Never forced: "Not now" closes the card for this visit
 * (the plain Invoice section stays on the job), and "Don't ask me again" is remembered for this person in this
 * business, as the logo and job prompts are.
 */
export function InvoiceJobCard({ quoteId, quoteNumber, offer }: { quoteId: string; quoteNumber: string; offer: boolean }) {
  const [hidden, setHidden] = useState(false);
  const [, startTransition] = useTransition();
  const region = useRef<HTMLDivElement>(null);

  // The job has just been moved to Done and the buttons that were focused are gone: bring focus to the card, so a
  // keyboard or screen-reader user lands on the offer.
  useEffect(() => {
    region.current?.focus();
  }, []);

  // Without the card (closed, or asked not to be asked) the job still has its plain Invoice section.
  if (!offer || hidden) return <PlainInvoice quoteId={quoteId} />;

  function close() {
    setHidden(true);
    setTimeout(() => document.getElementById("job-title")?.focus(), 0);
  }

  return (
    <Alert ref={region} tabIndex={-1} role="region" aria-label="Invoice this job" data-testid="invoice-job-nudge" className="outline-none">
      <AlertTitle>Invoice {quoteNumber}?</AlertTitle>
      <AlertDescription className="space-y-3">
        <span className="block">The job is done. Turn the quote into an invoice.</span>
        <span className="flex flex-wrap items-start gap-2">
          <Link href={`/app/quotes/${quoteId}?next=invoice`} className={buttonVariants({ size: "lg" })}>
            Create invoice
          </Link>
          <Button type="button" variant="outline" size="lg" onClick={close}>
            Not now
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              close();
              // Quietly remembered; if that fails the card simply comes back next time.
              startTransition(async () => {
                await dismissInvoiceJobPrompt().catch(() => undefined);
              });
            }}
          >
            Don&apos;t ask me again
          </Button>
        </span>
      </AlertDescription>
    </Alert>
  );
}

function PlainInvoice({ quoteId }: { quoteId: string }) {
  return (
    <section className="space-y-2" aria-labelledby="invoice-heading">
      <h2 id="invoice-heading" className="text-base font-semibold">
        Invoice
      </h2>
      <Link href={`/app/quotes/${quoteId}?next=invoice`} className={buttonVariants({ variant: "outline", size: "lg" })}>
        Create invoice
      </Link>
    </section>
  );
}
