"use client";

import { useState, useTransition } from "react";
import { Section, TextField } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { saveTargetMargin } from "./target-actions";

/**
 * Business profile > The margin you aim for: one optional percentage, used to say where a product or a quote stands and
 * to suggest a price (docs/plans/costing-slice-c.md). Saved on its own, like the hourly rate.
 */
export function TargetMarginForm({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(undefined);
    setSaved(false);
    startTransition(async () => {
      try {
        const result = await saveTargetMargin(value);
        if (result.status === "saved") setSaved(true);
        // A problem with the percentage is shown at the field; anything else above it.
        else if (/margin|percent|number|enter/i.test(result.message)) setError(result.message);
        else setMessage(result.message);
      } catch {
        setMessage("Couldn't reach the server, so nothing was saved. Try again. Nothing you typed is lost.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate id="target-margin">
      <Section title="The margin you aim for">
        {message && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        <TextField
          id="targetMargin"
          label="Margin you aim for (%)"
          hint="What is left of the price, without VAT, after costs. Used to suggest prices."
          inputMode="decimal"
          autoComplete="off"
          value={value}
          error={error}
          onChange={(v) => {
            setSaved(false);
            setValue(v);
          }}
        />
      </Section>
      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save margin"}
        </Button>
        {saved && (
          <p role="status" className="text-base">
            Saved.
          </p>
        )}
      </div>
    </form>
  );
}
