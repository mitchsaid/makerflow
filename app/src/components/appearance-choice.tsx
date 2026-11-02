"use client";

import { useSyncExternalStore } from "react";
import { ChoiceCards } from "@/components/choice-cards";
import { readTheme, subscribeTheme, writeTheme } from "@/lib/theme/client";
import { THEME_CHOICES, type Theme } from "@/lib/theme";

/**
 * Light, dark, or the same as the device (docs/plans/visual-design.md). It applies at once and is remembered on this
 * device. The server and the first render say "same as this device", then the stored choice shows.
 */
export function AppearanceChoice() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, (): Theme => "system");
  return (
    <ChoiceCards
      legend={<span className="sr-only">Appearance</span>}
      value={theme}
      onChange={writeTheme}
      idFor={(v) => `appearance-${v}`}
      choices={THEME_CHOICES}
    />
  );
}
