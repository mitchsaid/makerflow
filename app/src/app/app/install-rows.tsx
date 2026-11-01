"use client";

import { useState } from "react";
import { promptInstall, useCanPrompt, usePageFacts } from "@/components/install-store";
import { Button } from "@/components/ui/button";
import { installWay, IOS_STEPS, SHARE_TEXT } from "@/lib/install";

const ROW =
  "h-auto min-h-11 w-full flex-col items-start justify-start gap-0.5 whitespace-normal rounded-xl bg-card px-4 py-3 text-left ring-1 ring-foreground/10 hover:bg-muted";

/**
 * "Install MakerFlow" (docs/plans/installable-app.md): one tap where the browser offers to install the app,
 * the steps where it does not (Safari on an iPhone), and nothing where it is already installed or cannot be.
 */
export function InstallRow() {
  const canPrompt = useCanPrompt();
  const facts = usePageFacts();
  const [showSteps, setShowSteps] = useState(false);
  const way = installWay({ ...facts, canPrompt });
  if (way === "installed" || way === "none") return null;

  return (
    <li className="space-y-2" data-testid="install-row">
      <Button type="button" variant="outline" className={ROW} onClick={() => (way === "prompt" ? void promptInstall() : setShowSteps((v) => !v))} aria-expanded={way === "ios" ? showSteps : undefined}>
        <span className="block text-base font-medium">Install MakerFlow</span>
        <span className="block text-sm font-normal text-muted-foreground">Open MakerFlow like an app, with its own icon.</span>
      </Button>
      {way === "ios" && showSteps && <p className="px-1 text-sm text-muted-foreground" role="status">{IOS_STEPS}</p>}
    </li>
  );
}

/** "Tell another maker": the phone's own share sheet where there is one, a copied link where there is not. */
export function ShareRow() {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.origin;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "MakerFlow", text: SHARE_TEXT, url });
        return;
      } catch (error) {
        // They closed the share sheet: nothing more to do. Anything else falls back to copying.
        if ((error as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${SHARE_TEXT} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
    } catch {
      // No clipboard: nothing to do but leave the row as it is.
    }
  }

  return (
    <li className="space-y-2">
      <Button type="button" variant="outline" className={ROW} onClick={() => void share()} data-testid="share-row">
        <span className="block text-base font-medium">Tell another maker</span>
        <span className="block text-sm font-normal text-muted-foreground">Share MakerFlow with someone who makes things.</span>
      </Button>
      {copied && <p className="px-1 text-sm font-medium" role="status">Link copied. Paste it into a message.</p>}
    </li>
  );
}
