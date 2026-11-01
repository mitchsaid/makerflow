"use client";

import { useSyncExternalStore } from "react";

/**
 * The browser's offer to install the app (`beforeinstallprompt`) arrives once, early in the page's life, so it is kept
 * here from the moment the workspace opens and read by the "Install MakerFlow" row whenever the More tab is
 * visited (docs/plans/installable-app.md).
 */
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let offer: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Called once from the workspace layout's client part: starts listening. */
export function listenForInstallOffer(): () => void {
  const onOffer = (event: Event) => {
    event.preventDefault();
    offer = event as InstallPromptEvent;
    emit();
  };
  const onInstalled = () => {
    offer = null;
    emit();
  };
  window.addEventListener("beforeinstallprompt", onOffer);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", onOffer);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useCanPrompt = (): boolean => useSyncExternalStore(subscribe, () => offer !== null, () => false);

/** Shows the browser's own install question. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!offer) return "unavailable";
  const event = offer;
  offer = null;
  emit();
  await event.prompt();
  return (await event.userChoice).outcome;
}
