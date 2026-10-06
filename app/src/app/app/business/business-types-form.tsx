"use client";

import { useState, useTransition } from "react";
import { BusinessTypePicker } from "@/components/business-type-picker";
import { Section } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { BusinessType } from "@/lib/business-types";
import { saveBusinessTypes } from "./type-actions";

/**
 * Business profile > What you make: the ticks that put the examples that fit your business first.
 * Nothing is hidden by it, and nothing else uses it.
 */
export function BusinessTypesForm({ initial }: { initial: BusinessType[] }) {
  const [chosen, setChosen] = useState<BusinessType[]>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const result = await saveBusinessTypes(chosen);
        if (result.status === "saved") setSaved(true);
        else setMessage(result.message);
      } catch {
        setMessage("Couldn't reach the server, so nothing was saved. Check your connection and try again. Nothing you ticked is lost.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate id="what-you-make">
      <Section title="What you make">
        <p id="types-legend" className="text-base text-muted-foreground">
          Tick any that fit. We use this to show examples that fit your business first, and nothing else.
        </p>
        {message && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        <BusinessTypePicker
          value={chosen}
          onChange={(next) => {
            setSaved(false);
            setChosen(next);
          }}
          idPrefix="profile-type"
          labelledBy="types-legend"
        />
      </Section>
      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save what you make"}
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
