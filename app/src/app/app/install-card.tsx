"use client";

import { useSyncExternalStore } from "react";
import { promptInstall, useCanPrompt, usePageFacts } from "@/components/install-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { installGuide } from "@/lib/install";

const KEY = "makerflow.install-card.dismissed";
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
// "Not now" is remembered on this phone only (an install is per device), so it is a per-viewer convenience, not an account setting.
const read = () => {
  try {
    return localStorage.getItem(KEY) === "yes";
  } catch {
    return false;
  }
};
function dismiss() {
  try {
    localStorage.setItem(KEY, "yes");
  } catch {
    // No storage: it is hidden until the page is reloaded.
  }
  dismissedThisVisit = true;
  listeners.forEach((l) => l());
}
let dismissedThisVisit = false;

/**
 * Shown on Home to someone on a phone whose browser can add MakerFlow to the home screen, with the steps for their phone
 * (docs/plans/installable-app.md, follow-up). One tap where the browser offers it. "Not now" hides it for good on this
 * phone; the "Install MakerFlow" row on More stays. Never shown on a computer or in the installed app.
 */
export function InstallCard() {
  const canPrompt = useCanPrompt();
  const facts = usePageFacts();
  // The server and first render say "dismissed", so nothing flashes in and out.
  const dismissed = useSyncExternalStore(subscribe, () => dismissedThisVisit || read(), () => true);
  const guide = installGuide({ ...facts, canPrompt });
  if (dismissed || !guide) return null;

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
            {guide.kind === "steps" ? "Done" : "Not now"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
