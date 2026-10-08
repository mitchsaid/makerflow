"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ThemeThumbnail } from "@/components/theme-thumbnail";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { STARTERS, chooseTheme, resolveTheme, sameRef, type SavedTheme, type Theme, type ThemeRef } from "@/lib/quotes/themes";
import type { QuoteSnapshot } from "@/lib/quotes/snapshot";
import { LivePdfPreview } from "./live-preview";
import { saveQuoteTheme } from "./design-actions";
import { scheduleDesignSave } from "./design-saves";

/** The theme a sent version went out with, as it was (read-only). */
export function DesignSection({ theme }: { theme: Theme }) {
  return (
    <section className="space-y-3" aria-labelledby="design-heading">
      <h2 id="design-heading" className="text-base font-semibold">
        Theme
      </h2>
      <Card>
        <CardContent className="flex items-center gap-4">
          <div className="w-16 shrink-0">
            <ThemeThumbnail theme={theme} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-medium" data-testid="current-design">
              {theme.name || "Classic"}
            </p>
            <p className="text-sm text-muted-foreground">The look this version was sent with.</p>
          </div>
          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            Used for this version
          </span>
        </CardContent>
      </Card>
    </section>
  );
}

type Entry = { key: string; ref: ThemeRef; name: string; theme: Theme };

/**
 * A draft's preview and its theme together, so a tap redraws the preview on the spot (the document is
 * drawn in the browser from the choice held here) and the choice is saved quietly in the background.
 * Nothing about the choice waits for the server.
 */
export function DraftPreview({
  snapshot,
  quoteId,
  label,
  saved,
  initialOwn,
  canEdit,
}: {
  snapshot: QuoteSnapshot;
  quoteId: string;
  label: string;
  /** The business's own themes. */
  saved: readonly SavedTheme[];
  /** This quote's theme (one is chosen for it when it is made; an old quote may have none). */
  initialOwn: ThemeRef;
  /** Owners and admins can edit and remix themes. */
  canEdit: boolean;
}) {
  const [own, setOwn] = useState(initialOwn);
  const [message, setMessage] = useState<string | null>(null);
  const [state, setState] = useState<"saved" | "saving">("saved");
  const latest = useRef(0);
  // What the server last accepted, so a failed save puts the choice back to what is really stored.
  const stored = useRef(initialOwn);

  const chosen = chooseTheme(own, saved);
  const theme = resolveTheme(chosen.spec, chosen.name);
  const shown: QuoteSnapshot = { ...snapshot, theme };

  const entries: Entry[] = [
    ...saved.map((t) => ({ key: t.id, ref: { id: t.id, starter: null } as ThemeRef, name: t.name, theme: resolveTheme(t.spec, t.name) })),
    ...STARTERS.map((s) => ({ key: s.key, ref: { id: null, starter: s.key } as ThemeRef, name: s.name, theme: resolveTheme(s.spec, s.name) })),
  ];

  function revert(why: string) {
    setOwn(stored.current);
    setMessage(why);
  }

  function pick(next: ThemeRef) {
    setOwn(next);
    setMessage(null);
    setState("saving");
    const ticket = ++latest.current;
    scheduleDesignSave(quoteId, async () => {
      try {
        const result = await saveQuoteTheme(quoteId, next.id, next.starter);
        // A newer tap carries the whole state, so only the latest tap may put the screen back.
        if (result.status === "error") return ticket === latest.current ? revert(result.message) : undefined;
        if (ticket === latest.current) setMessage(null);
        stored.current = next;
      } catch {
        if (ticket === latest.current) revert("Couldn't reach the server, so the change wasn't saved. Check your connection and try again.");
      } finally {
        if (ticket === latest.current) setState("saved");
      }
    });
  }

  // The chosen card is brought into view when the strip opens, so it is never off to the side.
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const pressed = strip.current?.querySelector('[aria-pressed="true"]');
    if (pressed instanceof HTMLElement && strip.current) {
      // Where the chosen card is within the strip (not within the page), minus the strip's own padding.
      const left = pressed.getBoundingClientRect().left - strip.current.getBoundingClientRect().left + strip.current.scrollLeft;
      strip.current.scrollLeft = Math.max(0, left - 16);
    }
  }, []);

  const ownTheme = chosen.ref.id !== null;
  const from = ownTheme ? `theme:${chosen.ref.id}` : `starter:${chosen.ref.starter}`;

  return (
    <>
      <LivePdfPreview snapshot={shown} draft label={label} />
      <section className="space-y-3" aria-labelledby="design-heading">
        <h2 id="design-heading" className="text-base font-semibold">
          Theme
        </h2>
        <p className="text-base text-muted-foreground">
          Pick a theme for this quote. The next quote you start begins with the one you pick last.
        </p>
        {message && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        <p className="sr-only" role="status" data-testid="current-design">
          {chosen.name}
        </p>
        {/* Room round the cards so the chosen one's outline is never cut off by the scrolling strip. */}
        <div ref={strip} role="group" aria-label="Theme" className="-mx-4 flex scroll-px-4 snap-x gap-3 overflow-x-auto px-4 py-2">
          {entries.map((e) => {
            const pressed = sameRef(chosen.ref, e.ref);
            return (
              <Button
                key={e.key}
                type="button"
                variant="outline"
                aria-pressed={pressed}
                onClick={() => pick(e.ref)}
                data-testid="theme-option"
                className="h-auto w-28 shrink-0 snap-start flex-col items-stretch gap-1.5 whitespace-normal rounded-xl p-1.5 text-center font-normal aria-pressed:border-primary aria-pressed:bg-primary/5 aria-pressed:ring-2 aria-pressed:ring-primary"
              >
                <ThemeThumbnail theme={e.theme} />
                <span className="px-1 pb-0.5 text-sm">{e.name}</span>
              </Button>
            );
          })}
          {canEdit && (
            <Link
              href={`/app/documents/themes/new?quote=${quoteId}`}
              className="flex w-28 shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-xl p-1.5 text-center text-sm ring-1 ring-foreground/15 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span aria-hidden="true" className="text-2xl leading-none">
                +
              </span>
              Create new theme
            </Link>
          )}
        </div>
        <p className="text-sm text-muted-foreground" role="status" data-testid="design-save-status">
          {state === "saving" ? "Saving…" : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          {canEdit && ownTheme && (
            <Link href={`/app/documents/themes/${chosen.ref.id}?quote=${quoteId}`} className={buttonVariants({ variant: "outline" })}>
              Edit this theme
            </Link>
          )}
          {canEdit && (
            <Link href={`/app/documents/themes/new?from=${from}&quote=${quoteId}`} className={buttonVariants({ variant: "outline" })}>
              Remix this theme
            </Link>
          )}
        </div>
      </section>
    </>
  );
}
