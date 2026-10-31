"use client";

import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAppRouter } from "@/components/use-app-router";
import { DEMO_CHOICES, DEMO_KINDS, type DemoKind } from "@/lib/demo";
import { buildDemo, startDemo } from "./demo/actions";

/**
 * "Try the demo" on the landing page (docs/plans/demo-accounts.md): pick the kind of maker closest to yours and land in
 * a private demo business of that kind, filled with sample customers, products and costs. Nothing to sign up for.
 */
export function DemoPicker({ ended }: { ended: boolean }) {
  const router = useAppRouter();
  const [chosen, setChosen] = useState<DemoKind | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function start(kind: DemoKind) {
    setChosen(kind);
    setMessage(null);
    startTransition(async () => {
      try {
        const started = await startDemo(kind);
        if (started.status === "error") return setMessage(started.message);
        const built = await buildDemo();
        if (built.status === "error") return setMessage(built.message);
        router.push("/app");
      } catch {
        setMessage("Couldn't reach the server. Try again.");
      }
    });
  }

  return (
    <section className="space-y-4" aria-labelledby="demo-heading">
      <div className="space-y-1">
        <h2 id="demo-heading" className="text-xl font-semibold">
          Try it first
        </h2>
        <p className="text-muted-foreground">Pick the maker closest to you. No sign-up: you get a demo business of your own.</p>
      </div>
      {ended && (
        <Alert role="status">
          <AlertDescription>Your demo has ended. Start another, or sign up to keep your own.</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <ul className="grid gap-3 sm:grid-cols-2" aria-busy={pending}>
        {DEMO_KINDS.map((kind) => (
          <li key={kind}>
            <Button type="button" variant="outline" className="h-auto min-h-16 w-full flex-col items-start gap-0.5 whitespace-normal px-4 py-3 text-left" disabled={pending} onClick={() => start(kind)} data-testid={`demo-${kind}`}>
              <span className="text-base font-medium">{pending && chosen === kind ? `Setting up the ${DEMO_CHOICES[kind].title.toLowerCase()}…` : DEMO_CHOICES[kind].title}</span>
              <span className="text-sm font-normal text-muted-foreground">{DEMO_CHOICES[kind].line}</span>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
