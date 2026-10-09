"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FontPicker } from "@/components/font-picker";
import { ImageField } from "@/components/image-field";
import { ChoiceCards } from "@/components/theme-choices";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BOOLEAN_PARTS, THEME_NAME_MAX, normaliseColour, resolveTheme, sameSpec, type ChoiceName, type ThemeSpec } from "@/lib/quotes/themes";
import type { QuoteSnapshot } from "@/lib/quotes/snapshot";
import { LivePdfPreview } from "../../quotes/live-preview";
import { saveQuoteTheme } from "../../quotes/design-actions";
import { createTheme, saveTheme } from "../theme-actions";

const ACCENTS: readonly (readonly [string, string])[] = [
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

/** Colours for paper and for the end of a gradient: soft ones read best behind text, and charcoal is there for a dark page. */
const PAPERS: readonly (readonly [string, string])[] = [
  ["#ffffff", "White"],
  ["#fbf7f0", "Cream"],
  ["#fdf5f8", "Blush"],
  ["#fde9d9", "Peach"],
  ["#e6f2ea", "Mint"],
  ["#f3f6fb", "Mist"],
  ["#e8eef6", "Sky"],
  ["#e9e3f5", "Lilac"],
  ["#f1efe9", "Stone"],
  ["#1f2937", "Charcoal"],
];

const TABS = ["Colour", "Type", "Background", "Top", "Items", "Totals", "Finish"] as const;
type Tab = (typeof TABS)[number];

const SWITCHES: readonly { name: (typeof BOOLEAN_PARTS)[number]; label: string }[] = [
  { name: "showQty", label: "Show quantity" },
  { name: "showUnitPrice", label: "Show price each" },
  { name: "numbered", label: "Number the items" },
  { name: "descriptions", label: "Show descriptions" },
];

/** Page one of an A4 page is 1 : 1.4142; the pinned preview is sized so that it fits in its height. */
const PREVIEW_HEIGHT = "var(--preview-height)";

/**
 * The theme studio: change a theme part by part with the quote drawn above, live. On a phone the preview
 * and the part tabs stay pinned and only the choices scroll; on a wide screen the choices sit beside the
 * preview. Every change is made on the screen first (the document is drawn in the browser, so it shows
 * at once) and saved only when Save is pressed.
 */
export function ThemeStudio({
  snapshot,
  initial,
  basedOn,
  quoteId,
}: {
  /** A sample quote (or a real one) to draw the theme on. */
  snapshot: QuoteSnapshot;
  initial: { id: string | null; name: string; spec: ThemeSpec };
  /** Said when this is a copy of another theme, not yet saved. */
  basedOn?: string;
  /** Set when the maker came from a quote: Save can also use the theme on it. */
  quoteId?: string;
}) {
  const router = useRouter();
  const [id, setId] = useState(initial.id);
  const [name, setName] = useState(initial.name);
  const [spec, setSpec] = useState(initial.spec);
  const [saved, setSaved] = useState({ name: initial.name, spec: initial.spec, id: initial.id });
  const [tab, setTab] = useState<Tab>("Colour");
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [fullOpen, setFullOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);
  const [uploading, setUploading] = useState(false);

  const theme = useMemo(() => resolveTheme(spec, name.trim() || "Untitled"), [spec, name]);
  const shown: QuoteSnapshot = useMemo(() => ({ ...snapshot, theme }), [snapshot, theme]);
  const dirty = id === null || name !== saved.name || !sameSpec(spec, saved.spec);

  // Leaving by closing the tab or the app asks first when there is something unsaved.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function change(part: ChoiceName, value: string) {
    setJustSaved(false);
    setSpec((s) => ({ ...s, [part]: value }));
  }

  function setColour(part: "accent" | "paper" | "gradientTo", value: string) {
    const colour = normaliseColour(value);
    if (!colour) return;
    setJustSaved(false);
    setSpec((s) => ({ ...s, [part]: colour }));
  }

  function save(thenUse: boolean) {
    setError(null);
    if (!name.trim()) {
      setNameError("Give the theme a name.");
      document.getElementById("theme-name")?.focus();
      return;
    }
    setNameError(null);
    if (uploading) {
      setError("Wait for the picture to finish uploading, then save.");
      return;
    }
    startTransition(async () => {
      try {
        const result = id === null ? await createTheme(name, spec) : await saveTheme(id, name, spec);
        if (result.status === "error") return setError(result.message);
        // The theme is saved from here on, whatever happens next: a second press must change it, not make another.
        setSaved({ name, spec, id: result.id });
        setJustSaved(true);
        if (id === null) {
          setId(result.id);
          // The address of a theme that exists now (a reload opens it, not a new copy), without reloading the studio.
          window.history.replaceState(null, "", `/app/documents/themes/${result.id}${quoteId ? `?quote=${quoteId}` : ""}`);
        }
        if (thenUse && quoteId) {
          const used = await saveQuoteTheme(quoteId, result.id, null);
          if (used.status === "error") return setError(`The theme is saved, but it couldn't be put on the quote: ${used.message}`);
          router.push(`/app/quotes/${quoteId}/preview`);
        }
      } catch {
        setError("Couldn't reach the server, so nothing was saved. Check your connection and try again.");
      }
    });
  }

  const leave = (event: React.MouseEvent) => {
    if (dirty && !window.confirm("You have changes that aren't saved. Leave without saving?")) event.preventDefault();
  };
  const backHref = quoteId ? `/app/quotes/${quoteId}/preview` : "/app/documents/themes";

  const colourRow = (part: "accent" | "paper" | "gradientTo", label: string, options: readonly (readonly [string, string])[]) => (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap items-center gap-2">
        {options.map(([hex, text]) => (
          <Button
            key={hex}
            type="button"
            variant="outline"
            size="icon"
            aria-pressed={spec[part] === hex}
            aria-label={text}
            title={text}
            onClick={() => setColour(part, hex)}
            className="rounded-full border-foreground/20 aria-pressed:border-primary aria-pressed:ring-[3px] aria-pressed:ring-primary"
            style={{ background: hex }}
          />
        ))}
        {/* The browser's own colour picker: there is no shadcn input for it (a deliberate exception to "no hand-written inputs"). */}
        <label className="flex h-11 cursor-pointer items-center gap-2 rounded-full px-3 text-sm ring-1 ring-foreground/20">
          <input
            type="color"
            aria-label={`${label}: pick any colour`}
            value={spec[part]}
            onChange={(e) => setColour(part, e.target.value)}
            className="size-6 cursor-pointer border-0 bg-transparent p-0"
          />
          Any colour
        </label>
      </div>
    </fieldset>
  );

  const cards = (...parts: ChoiceName[]) => parts.map((p) => <ChoiceCards key={p} name={p} spec={spec} onChange={change} />);

  return (
    <div className="mx-auto w-full max-w-2xl flex-1">
      {/* Pinned: the way back, the preview and the part tabs. Only the choices below scroll. */}
      <div className="sticky top-0 z-20 border-b border-border bg-background px-4 pt-2">
        <div className="flex items-center justify-between">
          <Link href={backHref} onClick={leave} className="flex min-h-11 items-center text-sm text-muted-foreground underline">
            Back
          </Link>
          <Button type="button" variant="secondary" onClick={() => setFullOpen(true)}>
            Full preview
          </Button>
        </div>
        <div className="mx-auto flex justify-center [--preview-height:min(30dvh,280px)] md:[--preview-height:min(48dvh,460px)]" style={{ height: PREVIEW_HEIGHT }}>
          <div className="overflow-hidden" style={{ height: PREVIEW_HEIGHT, width: `calc(${PREVIEW_HEIGHT} / 1.4142)` }} data-testid="studio-preview">
            <LivePdfPreview snapshot={shown} draft={false} label="Preview" firstPageOnly />
          </div>
        </div>
        <div
          role="tablist"
          aria-label="Parts of the theme"
          className="-mx-4 flex gap-1 overflow-x-auto px-4 py-2"
          onKeyDown={(event) => {
            // Arrow keys move between the tabs (and Home and End jump), as a tab list should.
            const at = TABS.indexOf(tab);
            const next = event.key === "ArrowRight" ? at + 1 : event.key === "ArrowLeft" ? at - 1 : event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : null;
            if (next === null) return;
            event.preventDefault();
            const target = TABS[(next + TABS.length) % TABS.length];
            setTab(target);
            document.getElementById(`tab-${target}`)?.focus();
          }}
        >
          {TABS.map((t) => (
            <Button
              key={t}
              type="button"
              role="tab"
              id={`tab-${t}`}
              aria-selected={tab === t}
              aria-controls="studio-panel"
              tabIndex={tab === t ? 0 : -1}
              variant={tab === t ? "default" : "ghost"}
              onClick={() => setTab(t)}
              className="shrink-0"
            >
              {t}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-5 px-4 py-4">
        <Field>
          <FieldLabel htmlFor="theme-name">Theme name</FieldLabel>
          <Input
            id="theme-name"
            value={name}
            maxLength={THEME_NAME_MAX}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "theme-name-error" : undefined}
            onChange={(e) => {
              setJustSaved(false);
              setNameError(null);
              setName(e.target.value);
            }}
            className="h-11 text-base"
          />
          {nameError && <FieldError id="theme-name-error">{nameError}</FieldError>}
        </Field>
        {basedOn && <p className="text-sm text-muted-foreground">A copy of {basedOn}. It isn&apos;t saved until you press Save.</p>}
        {error && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <section id="studio-panel" data-testid="studio-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="space-y-5">
          {tab === "Colour" && colourRow("accent", "Your colour", ACCENTS)}
          {tab === "Type" && (
            <>
              <FontPicker
                id="heading-font"
                label="Headings"
                value={spec.headingFont}
                sample="Quotation for Sarah and Thabo"
                onChange={(font) => {
                  setJustSaved(false);
                  setSpec((x) => ({ ...x, headingFont: font }));
                }}
              />
              <FontPicker
                id="body-font"
                label="Text"
                value={spec.bodyFont}
                sample="Vanilla sponge, raspberry jam, R 1 250,00"
                onChange={(font) => {
                  setJustSaved(false);
                  setSpec((x) => ({ ...x, bodyFont: font }));
                }}
              />
            </>
          )}
          {tab === "Background" && (
            <>
              {cards("background")}
              {spec.background === "paper" && colourRow("paper", "Paper colour", PAPERS)}
              {spec.background === "gradient" && (
                <>
                  {colourRow("paper", "Starts with", PAPERS)}
                  {colourRow("gradientTo", "Ends with", PAPERS)}
                  {cards("gradientDirection")}
                  <p className="text-sm text-muted-foreground">Soft colours read best behind text.</p>
                </>
              )}
              {spec.background === "image" && (
                <>
                  <ImageField
                    id="backgroundImage"
                    label="Background picture"
                    kind="background"
                    shape="free"
                    value={spec.backgroundImageId ?? ""}
                    alt="The background picture"
                    hint="A soft, light picture works best. It is faded behind your text so the quote stays easy to read."
                    onChange={(imageId) => {
                      setJustSaved(false);
                      setSpec((x) => ({ ...x, backgroundImageId: imageId === "" ? null : imageId }));
                    }}
                    onPendingChange={setUploading}
                  />
                  {cards("imageStrength")}
                  {colourRow("paper", "Colour under the picture", PAPERS)}
                </>
              )}
            </>
          )}
          {tab === "Top" && cards("header", "headerLogo", "headerAlign")}
          {tab === "Items" && (
            <>
              {cards("layout")}
              {spec.layout === "table" && cards("tableHead")}
              {cards("rows", "density", "photo")}
              {spec.photo !== "none" && cards("photoShape")}
              {cards("extraPrices")}
              <fieldset className="space-y-1">
                <legend className="text-sm font-medium">Show on each item</legend>
                {SWITCHES.map((s) => (
                  <Field key={s.name} orientation="horizontal" className="items-start py-2">
                    <Checkbox
                      id={`switch-${s.name}`}
                      checked={spec[s.name]}
                      onCheckedChange={(checked) => {
                        setJustSaved(false);
                        setSpec((x) => ({ ...x, [s.name]: checked === true }));
                      }}
                    />
                    <FieldLabel htmlFor={`switch-${s.name}`} className="text-base">
                      {s.label}
                    </FieldLabel>
                  </Field>
                ))}
              </fieldset>
            </>
          )}
          {tab === "Totals" && cards("totals")}
          {tab === "Finish" && cards("corners")}
        </section>
      </div>

      <div data-testid="action-bar" className="sticky bottom-14 z-10 border-t border-border bg-card px-4 py-3 md:bottom-0">
        <div className="flex flex-wrap items-center gap-2">
          {quoteId ? (
            <>
              <Button type="button" size="lg" className="flex-1" disabled={pending} onClick={() => save(true)}>
                {pending ? "Saving…" : "Save and use on this quote"}
              </Button>
              <Button type="button" size="lg" variant="outline" disabled={pending} onClick={() => save(false)}>
                Save
              </Button>
            </>
          ) : (
            <Button type="button" size="lg" className="flex-1" disabled={pending} onClick={() => save(false)}>
              {pending ? "Saving…" : "Save theme"}
            </Button>
          )}
          <p role="status" className="text-sm text-muted-foreground" data-testid="theme-save-status">
            {justSaved && !dirty ? "Saved." : dirty && id !== null ? "Not saved yet." : ""}
          </p>
        </div>
      </div>

      <Sheet open={fullOpen} onOpenChange={setFullOpen}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto p-4">
          <SheetHeader>
            <SheetTitle>Full preview</SheetTitle>
            <SheetDescription>Every page of the sample quote in this theme.</SheetDescription>
          </SheetHeader>
          {fullOpen && <LivePdfPreview snapshot={shown} draft={false} label="Full preview" />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
