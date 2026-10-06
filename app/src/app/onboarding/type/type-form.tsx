"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BusinessTypePicker } from "@/components/business-type-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { BusinessType } from "@/lib/business-types";
import { saveBusinessTypes } from "@/app/app/business/type-actions";

/** Continue saves the ticks; Skip saves an empty list (asked, no answer). Both go to Home. */
export function TypeForm() {
  const router = useRouter();
  const [chosen, setChosen] = useState<BusinessType[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(types: BusinessType[]) {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await saveBusinessTypes(types);
        if (result.status === "saved") router.push("/app");
        else setMessage(result.message);
      } catch {
        setMessage("Couldn't reach the server, so nothing was saved. Check your connection and try again.");
      }
    });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        save(chosen);
      }}
    >
      {message && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <BusinessTypePicker value={chosen} onChange={setChosen} idPrefix="onboarding-type" labelledBy="types-heading" />
      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Continue"}
        </Button>
        <Button type="button" size="lg" variant="outline" disabled={pending} onClick={() => save([])}>
          Skip for now
        </Button>
      </div>
    </form>
  );
}
