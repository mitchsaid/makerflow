"use client";

import type { ReactNode } from "react";
import { MiniHeader, MiniItems, MiniTotals } from "@/components/theme-thumbnail";
import { Button } from "@/components/ui/button";
import { CHOICES, resolveTheme, type ChoiceName, type ThemeSpec } from "@/lib/quotes/themes";

/**
 * One part of a theme as a row of picture cards: each card shows what the choice does, drawn from the
 * theme being edited (so the cards change with the colours), with a short name under it. Cards are
 * toggle buttons in a labelled group; the chosen one is marked and announced as pressed.
 */

/** Which little drawing shows a choice. */
const VISUAL: Record<ChoiceName, "header" | "items" | "totals" | "font" | "corners" | "logo" | "align" | "shape"> = {
  headingFont: "font",
  bodyFont: "font",
  header: "header",
  headerLogo: "logo",
  headerAlign: "align",
  layout: "items",
  tableHead: "items",
  rows: "items",
  density: "items",
  photo: "items",
  photoShape: "shape",
  totals: "totals",
  corners: "corners",
};

function Drawing({ name, value, spec }: { name: ChoiceName; value: string; spec: ThemeSpec }) {
  const theme = resolveTheme({ ...spec, [name]: value } as ThemeSpec, "");
  const kind = VISUAL[name];
  const frame = (children: ReactNode) => (
    <div
      aria-hidden="true"
      className="flex h-[68px] w-full flex-col justify-center gap-1.5 overflow-hidden rounded-md p-2 ring-1 ring-foreground/15"
      style={{ background: theme.paper }}
    >
      {children}
    </div>
  );
  switch (kind) {
    case "header":
      return frame(<MiniHeader theme={theme} />);
    case "logo":
    case "align":
      return frame(<MiniHeader theme={{ ...theme, header: "plain" }} />);
    case "items":
      return frame(<MiniItems theme={theme} count={name === "layout" || name === "photo" ? 2 : 3} />);
    case "shape":
      return frame(<MiniItems theme={{ ...theme, layout: "list", photo: theme.photo === "none" ? "small" : theme.photo }} count={2} />);
    case "totals":
      return frame(<MiniTotals theme={theme} />);
    case "corners":
      return frame(
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
          <div style={{ width: "60%", height: 12, background: theme.accent, borderRadius: Math.min(theme.radius, 10) }} />
          <div style={{ width: "80%", height: 12, background: theme.tint, border: `1px solid ${theme.accentInk}`, borderRadius: Math.min(theme.radius, 10) }} />
        </div>,
      );
    case "font":
      return frame(
        <p
          className={value === "serif" ? "font-serif" : "font-sans"}
          style={{ color: theme.ink, fontSize: 26, lineHeight: 1, fontWeight: 700, textAlign: "center" }}
        >
          Aa
        </p>,
      );
  }
}

export function ChoiceCards({
  name,
  spec,
  onChange,
  label,
}: {
  name: ChoiceName;
  spec: ThemeSpec;
  onChange: (name: ChoiceName, value: string) => void;
  /** Overrides the part's usual name. */
  label?: string;
}) {
  const group = CHOICES[name];
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label ?? group.label}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {group.options.map(([value, text]) => {
          const pressed = (spec as Record<string, unknown>)[name] === value;
          return (
            <Button
              key={value}
              type="button"
              variant="outline"
              aria-pressed={pressed}
              onClick={() => onChange(name, value)}
              data-testid={`choice-${name}-${value}`}
              className="h-auto flex-col items-stretch gap-1.5 whitespace-normal rounded-xl p-1.5 text-center font-normal aria-pressed:border-primary aria-pressed:bg-primary/5 aria-pressed:ring-2 aria-pressed:ring-primary"
            >
              <Drawing name={name} value={value} spec={spec} />
              <span className="px-1 pb-0.5 text-sm">{text}</span>
            </Button>
          );
        })}
      </div>
    </fieldset>
  );
}
