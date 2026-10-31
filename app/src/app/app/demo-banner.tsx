"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useAppRouter } from "@/components/use-app-router";
import { DEMO_CHOICES, timeLeftWords, type DemoKind } from "@/lib/demo";
import { buildDemo, leaveDemo, resetDemo } from "../demo/actions";

/**
 * The strip across the top of a demo (docs/plans/demo-accounts.md): it says this is a demo, how long is left, and offers
 * a fresh start or a real account. It is the only difference a visitor sees from a real business, besides the sample
 * content.
 */
export function DemoBanner({ kind, expiresAt }: { kind: DemoKind; expiresAt: string }) {
  const router = useAppRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setMessage(null);
    startTransition(async () => {
      try {
        const made = await resetDemo();
        if (made.status === "error") return setMessage(made.message);
        const built = await buildDemo();
        if (built.status === "error") return setMessage(built.message);
        router.push("/app");
        router.refresh();
      } catch {
        setMessage("Couldn't reach the server. Try again.");
      }
    });
  }

  return (
    <div className="border-b border-border bg-muted px-4 py-2 text-sm" data-testid="demo-banner" role="region" aria-label="Demo">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p>
          <span className="font-medium">Demo: {DEMO_CHOICES[kind].title}.</span> Try anything; it is cleared in {timeLeftWords(expiresAt)}.
          {message && <span className="ml-2 text-destructive">{message}</span>}
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="min-h-11" disabled={pending} onClick={reset}>
            {pending ? "Starting over…" : "Start the demo over"}
          </Button>
          <form action={leaveDemo}>
            <Button type="submit" size="sm" className="min-h-11" disabled={pending}>
              Start your own
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
