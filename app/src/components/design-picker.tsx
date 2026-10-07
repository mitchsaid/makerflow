"use client";

import { useId, useState } from "react";
import { DesignThumbnail } from "@/components/design-thumbnail";
import { Button } from "@/components/ui/button";
import {
  COMPONENT_CHOICES,
  DESIGNS,
  PRESETS,
  normaliseColour,
  resolveTheme,
  type ComponentName,
  type DesignKey,
  type DesignOptions,
} from "@/lib/quotes/designs";

/** Colours to start from: a handful that print well. Any colour can be picked too. */
const SWATCHES: readonly (readonly [string, string])[] = [
  ["#1a1a1a", "Black"],
  ["#1e3a8a", "Navy"],
  ["#0369a1", "Blue"],
  ["#0f766e", "Teal"],
  ["#15803d", "Green"],
  ["#b45309", "Amber"],
  ["#c2410c", "Terracotta"],
  ["#be185d", "Rose"],
  ["#7e22ce", "Purple"],
  ["#475569", "Slate"],
];

const PRESSED = "aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90";

/**
 * Choose a design and make it your own. Five designs, each a complete look; under "Make it yours" every
 * part (the colour, the headings, the top of the page, the item headings and rows, the total, the
 * corners and the paper) can be changed on its own, and put back. The miniatures are drawn from the same
 * theme the PDF uses. The caller keeps the choice (and saves it): `onChange` gets the new design and the
 * changes from its own look.
 */
export function DesignPicker({
  design,
  options,
  brandColor,
  onChange,
  disabled = false,
  idPrefix = "design",
}: {
  design: DesignKey;
  options: DesignOptions;
  /** The business's brand colour, offered as a colour and used unless a colour is chosen here. */
  brandColor: string | null;
  onChange: (design: DesignKey, options: DesignOptions) => void;
  disabled?: boolean;
  idPrefix?: string;
}) {
  const [open, setOpen] = useState(Object.keys(options).length > 0);
  const panelId = useId();
  const preset = PRESETS[design];
  const accent = normaliseColour(options.accent) ?? normaliseColour(brandColor) ?? preset.accent;

  function pickDesign(next: DesignKey) {
    // The colour is the maker's (their brand); the rest of the changes belong to the design they were made on.
    onChange(next, options.accent ? { accent: options.accent } : {});
  }

  function setComponent(name: ComponentName, value: string) {
    const own = (preset as Record<string, string>)[name];
    const next: Record<string, string> = { ...options };
    if (value === own) delete next[name];
    else next[name] = value;
    onChange(design, next as DesignOptions);
  }

  function setAccent(colour: string | null) {
    const next = { ...options };
    if (colour === null) delete next.accent;
    else next.accent = colour;
    onChange(design, next);
  }

  const changedParts = Object.keys(options).filter((k) => k !== "accent").length;

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Design" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {DESIGNS.map((d) => {
          const selected = d.key === design;
          const theme = resolveTheme(d.key, selected ? options : options.accent ? { accent: options.accent } : {}, brandColor);
          return (
            <button
              key={d.key}
              type="button"
              id={`${idPrefix}-${d.key}`}
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => pickDesign(d.key)}
              className="flex flex-col gap-2 rounded-xl p-2 text-left ring-1 ring-foreground/15 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 aria-pressed:bg-primary/5 aria-pressed:ring-2 aria-pressed:ring-primary"
            >
              <DesignThumbnail theme={theme} />
              <span className="block px-1 pb-1">
                <span className="block text-base font-medium">{d.name}</span>
                <span className="block text-sm text-muted-foreground">{d.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        <Button
          type="button"
          variant="outline"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide the details" : "Make it yours"}
        </Button>

        {open && (
          <div id={panelId} className="space-y-5 rounded-xl bg-muted/40 p-4 ring-1 ring-foreground/10">
            <fieldset className="space-y-2" disabled={disabled}>
              <legend className="text-sm font-medium">Your colour</legend>
              <div className="flex flex-wrap items-center gap-2">
                {normaliseColour(brandColor) && (
                  <button
                    type="button"
                    aria-pressed={!options.accent}
                    aria-label={`Your brand colour, ${normaliseColour(brandColor)}`}
                    onClick={() => setAccent(null)}
                    className="flex h-11 items-center gap-2 rounded-full px-3 text-sm ring-1 ring-foreground/20 aria-pressed:ring-2 aria-pressed:ring-primary"
                  >
                    <span className="size-5 rounded-full ring-1 ring-foreground/20" style={{ background: normaliseColour(brandColor)! }} />
                    Brand colour
                  </button>
                )}
                {SWATCHES.map(([hex, name]) => (
                  <button
                    key={hex}
                    type="button"
                    aria-pressed={options.accent === hex}
                    aria-label={name}
                    title={name}
                    onClick={() => setAccent(hex)}
                    className="size-11 rounded-full ring-1 ring-foreground/20 aria-pressed:ring-[3px] aria-pressed:ring-primary"
                    style={{ background: hex }}
                  />
                ))}
                <label className="flex h-11 cursor-pointer items-center gap-2 rounded-full px-3 text-sm ring-1 ring-foreground/20">
                  <input
                    type="color"
                    aria-label="Pick any colour"
                    value={accent}
                    onChange={(e) => setAccent(normaliseColour(e.target.value))}
                    className="size-6 cursor-pointer border-0 bg-transparent p-0"
                  />
                  Any colour
                </label>
              </div>
              {options.accent && (
                <Button type="button" variant="ghost" onClick={() => setAccent(null)}>
                  {normaliseColour(brandColor) ? "Use my brand colour" : `Use ${DESIGNS.find((d) => d.key === design)?.name}'s own colour`}
                </Button>
              )}
            </fieldset>

            {(Object.keys(COMPONENT_CHOICES) as ComponentName[]).map((name) => {
              const group = COMPONENT_CHOICES[name];
              const current = (options[name] ?? (preset as Record<string, string>)[name]) as string;
              return (
                <fieldset key={name} className="space-y-2" disabled={disabled}>
                  <legend className="text-sm font-medium">{group.label}</legend>
                  <div className="flex flex-wrap gap-2">
                    {group.options.map(([value, label]) => (
                      <Button
                        key={value}
                        type="button"
                        variant="outline"
                        aria-pressed={current === value}
                        className={PRESSED}
                        onClick={() => setComponent(name, value)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </fieldset>
              );
            })}

            {changedParts > 0 && (
              <Button
                type="button"
                variant="ghost"
                disabled={disabled}
                onClick={() => onChange(design, options.accent ? { accent: options.accent } : {})}
              >
                Put everything back to {DESIGNS.find((d) => d.key === design)?.name}&apos;s own look
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
