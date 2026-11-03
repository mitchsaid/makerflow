"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

/** What is being made, in the order it is made. The steps are shown a couple of seconds apart: the demo is built in one go on the server, so these say what is in it, not exactly how far along it is. */
const STEPS = ["Making your business", "Adding customers and materials", "Pricing your products", "Writing sample quotes", "Setting up your jobs"] as const;
const STEP_MS = 2000;

/**
 * A full-screen "setting up" screen for a demo that is being built (docs/plans/home-and-demo-polish.md): building one takes
 * several seconds, and a button that says "Starting…" gave no sense of what was happening. It says what is going into
 * the demo, step by step, and stays on the last step until the demo is ready. Moving parts stop for people who ask for
 * less motion. The screen reader hears the current step, not the whole list each time.
 */
export function DemoLoader({ title }: { /** "baker": which kind of demo, in lower case. */ title: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), STEP_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6" data-testid="demo-loader" aria-busy="true">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h2 className="font-heading text-2xl font-semibold">Setting up your {title} demo</h2>
          <p className="text-base text-muted-foreground">A business of your own, with sample customers, products and quotes. A few seconds.</p>
        </div>
        <ol className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-border" aria-hidden="true">
          {STEPS.map((label, i) => (
            <li key={label} className={`flex items-center gap-3 text-base ${i > step ? "text-muted-foreground" : ""}`}>
              <span className="flex size-6 shrink-0 items-center justify-center">
                {i < step ? (
                  <Check className="size-5 text-success" />
                ) : i === step ? (
                  <Loader2 className="size-5 text-primary motion-safe:animate-spin" />
                ) : (
                  <span className="size-3 rounded-full ring-2 ring-border" />
                )}
              </span>
              <span className={i === step ? "font-medium" : ""}>{label}</span>
            </li>
          ))}
        </ol>
        <p className="sr-only" role="status" aria-live="polite">
          {STEPS[step]}
        </p>
      </div>
    </div>
  );
}
