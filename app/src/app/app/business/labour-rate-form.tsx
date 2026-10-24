"use client";

import { useState, useTransition } from "react";
import { Section, TextField } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { saveLabourRate } from "./labour-actions";

/**
 * Business profile > What your time is worth: one hourly rate, used to cost "Your time" lines on products
 * (docs/plans/costing-and-margin.md). Optional.
 */
export function LabourRateForm({ initial, currencySymbol }: { initial: string; currencySymbol: string }) {
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
        const result = await saveLabourRate(value);
        if (result.status === "saved") setSaved(true);
        // A problem with the amount is shown at the field; anything else above it.
        else if (/amount|number|enter/i.test(result.message)) setError(result.message);
        else setMessage(result.message);
      } catch {
        setMessage("Couldn't reach the server, so nothing was saved. Try again. Nothing you typed is lost.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate id="your-time">
      <Section title="What your time is worth">
        {message && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        <TextField
          id="labourRate"
          label="Price of an hour of your time"
          hint="Used to cost your time on products."
          inputMode="decimal"
          autoComplete="off"
          startText={currencySymbol}
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
          {pending ? "Saving…" : "Save hourly rate"}
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
