"use client";

import { useEffect, useSyncExternalStore } from "react";
import { promptInstall, useCanPrompt, usePageFacts } from "@/components/install-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { installGuide } from "@/lib/install";

const KEY = "makerflow.install-prompt.seen";

/**
 * A one-time prompt (docs/plans/installable-app.md, decision 6). "unknown" until the page has said it may be shown;
 * then "show" the first time on this phone, and "hidden" for good from then on: it is marked as seen the moment it
 * is first shown, so a reload or a later visit never brings it back, whether or not "Not now" was pressed. While
 * the app stays open it remains until dismissed, so moving between tabs does not make it vanish before it is read.
 */
let status: "unknown" | "show" | "hidden" = "unknown";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Decides once per page load. Storage is a per-phone convenience: where it is blocked, the prompt shows once per load. */
function decide() {
  if (status !== "unknown") return;
  let seen = false;
  try {
    seen = localStorage.getItem(KEY) === "yes";
    if (!seen) localStorage.setItem(KEY, "yes");
  } catch {
    // No storage: show it this once.
  }
  status = seen ? "hidden" : "show";
  emit();
}
function dismiss() {
  status = "hidden";
  emit();
}

/**
 * Shown once, on Home, to someone who has just signed up on a phone that can add MakerFlow to the home screen, with the
 * steps for their phone: one tap where the browser offers it. Never on a computer, in the installed app, in a demo or
 * for an older business, and never again after the first time. The "Install MakerFlow" row on More stays for anyone
 * who wants it later.
 */
export function InstallCard({ newBusiness }: { /** Made in the last few days, and not a demo. */ newBusiness: boolean }) {
  const canPrompt = useCanPrompt();
  const facts = usePageFacts();
  const guide = installGuide({ ...facts, canPrompt });
  const eligible = newBusiness && guide !== null;
  useEffect(() => {
    if (eligible) decide();
  }, [eligible]);
  const shown = useSyncExternalStore(subscribe, () => status === "show", () => false);
  if (!shown || !guide) return null;

  return (
    <Card data-testid="install-card">
      <CardHeader>
        <CardTitle className="text-lg">{guide.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-base text-muted-foreground">{guide.line}</p>
        {guide.kind === "steps" && (
          <ol className="list-decimal space-y-1 pl-5 text-base" aria-label="How to add it">
            {guide.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          {guide.kind === "prompt" && (
            <Button type="button" size="lg" onClick={() => void promptInstall().then((outcome) => outcome === "accepted" && dismiss())}>
              Install MakerFlow
            </Button>
          )}
          <Button type="button" size="lg" variant="outline" onClick={dismiss}>
            {guide.kind === "steps" ? "Got it" : "Not now"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
