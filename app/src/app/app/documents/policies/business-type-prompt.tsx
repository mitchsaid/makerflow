"use client";

import { useState, useTransition } from "react";
import { BusinessTypePicker } from "@/components/business-type-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BusinessType } from "@/lib/business-types";
import { dismissBusinessTypePrompt, saveBusinessTypes } from "@/app/app/business/type-actions";

/**
 * A friendly, dismissable card for businesses that skipped "what do you make?": tick what fits and
 * the examples below put theirs first. "Not now" is remembered.
 */
export function BusinessTypePrompt() {
  const [chosen, setChosen] = useState<BusinessType[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<{ status: "saved" } | { status: "error"; message: string }>) => {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.status === "error") setMessage(result.message);
      } catch {
        setMessage("Couldn't reach the server. Check your connection and try again.");
      }
    });
  };

  return (
    <Card data-testid="business-type-prompt">
      <CardHeader>
        <CardTitle id="prompt-types-heading" className="text-lg">
          Make the examples fit your business
        </CardTitle>
        <CardDescription className="text-base">
          Tick what you make or sell. We use this to put the examples that fit first, and nothing else.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {message && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        <BusinessTypePicker value={chosen} onChange={setChosen} idPrefix="prompt-type" labelledBy="prompt-types-heading" />
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            size="lg"
            disabled={pending}
            onClick={() =>
              chosen.length === 0
                ? setMessage("Tick what you make or sell, or choose Not now.")
                : run(() => saveBusinessTypes(chosen))
            }
          >
            {pending ? "Saving…" : "Show examples for me"}
          </Button>
          <Button type="button" size="lg" variant="outline" disabled={pending} onClick={() => run(dismissBusinessTypePrompt)}>
            Not now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
