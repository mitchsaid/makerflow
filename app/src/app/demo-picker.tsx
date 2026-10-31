"use client";

import { useState, useTransition } from "react";
import { ActionSheet } from "@/components/action-sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAppRouter } from "@/components/use-app-router";
import { DEMO_CHOICES, DEMO_KINDS, type DemoKind } from "@/lib/demo";
import { buildDemo, startDemo } from "./demo/actions";

/**
 * "Try the demo" on the landing page (docs/plans/demo-accounts.md): one button beside "Get started"; it opens a sheet
 * asking which kind of maker is closest, and then the visitor lands in a private demo business of that kind, filled
 * with sample customers, products, quotes and costs. Nothing to sign up for. The sheet is the app's own `ActionSheet`
 * (a sheet from the bottom on a phone, a dialog in the middle on a bigger screen). `children` is the sign-up button
 * that sits beside the demo button.
 */
export function DemoPicker({ ended, children }: { ended: boolean; children?: React.ReactNode }) {
  const router = useAppRouter();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<DemoKind | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // This browser is signed in to a real account: ask before the demo replaces that sign-in.
  const [signedIn, setSignedIn] = useState(false);
  const [pending, startTransition] = useTransition();

  function start(kind: DemoKind, signOutFirst = false) {
    setChosen(kind);
    setMessage(null);
    setSignedIn(false);
    startTransition(async () => {
      try {
        const started = await startDemo(kind, signOutFirst);
        if (started.status === "signed-in") return setSignedIn(true);
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
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        {children}
        <Button type="button" variant="outline" size="lg" className="min-w-48" disabled={pending} aria-busy={pending} onClick={() => setOpen(true)} data-testid="try-demo">
          {pending && chosen ? `Setting up the ${DEMO_CHOICES[chosen].title.toLowerCase()} demo…` : "Try the demo"}
        </Button>
      </div>
      {ended && (
        <Alert role="status">
          <AlertDescription>Your demo has ended. Start another, or sign up to keep your own.</AlertDescription>
        </Alert>
      )}
      {signedIn && chosen && (
        <Alert role="alert" data-testid="demo-signed-in">
          <AlertDescription className="space-y-3">
            <p>You&apos;re signed in to MakerFlow. A browser holds one sign-in, so the demo would sign you out here. Your business and everything in it stay as they are: sign back in with your email link.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" onClick={() => start(chosen, true)} disabled={pending}>
                Sign out and try the demo
              </Button>
              <Button type="button" variant="outline" onClick={() => setSignedIn(false)}>
                Cancel
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Or open the demo in a private window, and stay signed in here.</p>
          </AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <ActionSheet
        open={open}
        onOpenChange={setOpen}
        title="Try the demo"
        description="Which maker is closest to you? You get a demo business of your own: no sign-up."
        actions={DEMO_KINDS.map((kind) => ({ label: DEMO_CHOICES[kind].title, hint: DEMO_CHOICES[kind].line, onSelect: () => start(kind) }))}
        finalFocus={() => document.querySelector<HTMLElement>('[data-testid="try-demo"]')}
      />
    </div>
  );
}
