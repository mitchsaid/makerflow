"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { PrivateTag } from "@/components/private-tag";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { dismissMarginPrompt } from "./prompt-actions";

/**
 * On a draft quote where no item has a cost yet: a friendly card asks "Want to know your profit margin on this quote?"
 * and says where the costs go (a product's Inputs tab, or a one-off item). "Not now" closes it for this visit; "Don't ask
 * me again" is remembered for this person, as on every prompt card. Once it is closed, one quiet line still says where
 * to add them (docs/plans/costing-and-margin.md). Only the maker sees any of it; it is never part of the quote.
 */
export function MarginPrompt({ asking }: { asking: boolean }) {
  const [hidden, setHidden] = useState(false);
  const [, startTransition] = useTransition();

  if (asking && !hidden) {
    return (
      <Alert role="region" aria-label="Your profit margin" data-testid="margin-prompt">
        <AlertTitle>
          Want to know your profit margin on this quote? <PrivateTag />
        </AlertTitle>
        <AlertDescription className="space-y-3">
          <span className="block">Add what a product costs to make, or what a one-off item costs you, and your margin shows here.</span>
          <span className="flex flex-wrap gap-2">
            <Link href="/app/products" className={buttonVariants({ variant: "default" })}>
              Go to your products
            </Link>
            {/* The same two ways out as every prompt card: for now, or for good. */}
            <Button type="button" variant="outline" onClick={() => setHidden(true)}>
              Not now
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setHidden(true);
                // Quietly remembered; if that fails the card simply comes back next time.
                startTransition(async () => {
                  await dismissMarginPrompt().catch(() => undefined);
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

  return (
    <p className="text-sm text-muted-foreground" data-testid="margin-panel">
      <PrivateTag /> To see your margin here, add what a product costs to make (its Inputs tab), or what a one-off item costs you.{" "}
      <Link href="/app/products" className="underline underline-offset-4">
        Go to your products
      </Link>
    </p>
  );
}
