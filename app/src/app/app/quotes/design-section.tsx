"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { DesignPicker } from "@/components/design-picker";
import { DesignThumbnail } from "@/components/design-thumbnail";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DESIGNS, resolveTheme, type DesignKey, type DesignOptions, type Theme } from "@/lib/quotes/designs";
import type { QuoteSnapshot } from "@/lib/quotes/snapshot";
import { LivePdfPreview } from "./live-preview";
import { saveQuoteDesign } from "./design-actions";
import { scheduleDesignSave } from "./design-saves";

/** The design a sent version went out with, as it was (read-only). */
export function DesignSection({ theme }: { theme: Theme }) {
  const current = DESIGNS.find((d) => d.key === theme.key) ?? DESIGNS[0];
  return (
    <section className="space-y-3" aria-labelledby="design-heading">
      <h2 id="design-heading" className="text-base font-semibold">
        Design
      </h2>
      <Card>
        <CardContent className="flex items-center gap-4">
          <div className="w-16 shrink-0">
            <DesignThumbnail theme={theme} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-medium" data-testid="current-design">
              {current.name}
            </p>
            <p className="text-sm text-muted-foreground">{current.description}</p>
          </div>
          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            Used for this version
          </span>
        </CardContent>
      </Card>
    </section>
  );
}

/**
 * A draft's preview and its design choice together, so a tap redraws the preview on the spot (the
 * document is drawn in the browser from the choice held here) and the choice is saved quietly in the
 * background. Nothing about the choice waits for the server.
 */
export function DraftPreview({
  snapshot,
  quoteId,
  label,
  initialDesign,
  initialOptions,
  brandColor,
  initialFollowing,
  usual,
}: {
  snapshot: QuoteSnapshot;
  quoteId: string;
  label: string;
  initialDesign: DesignKey;
  initialOptions: DesignOptions;
  brandColor: string | null;
  initialFollowing: boolean;
  /** The business's usual look: what "Use my usual look" goes back to. */
  usual: { design: DesignKey; options: DesignOptions };
}) {
  const [design, setDesign] = useState(initialDesign);
  const [options, setOptions] = useState(initialOptions);
  const [following, setFollowing] = useState(initialFollowing);
  const [message, setMessage] = useState<string | null>(null);
  const [state, setState] = useState<"saved" | "saving">("saved");
  const latest = useRef(0);
  // What the server last accepted, so a failed save puts the picker back to what is really stored.
  const saved = useRef({ design: initialDesign, options: initialOptions, following: initialFollowing });

  function save(nextDesign: DesignKey | null, nextOptions: DesignOptions) {
    setMessage(null);
    setState("saving");
    const ticket = ++latest.current;
    scheduleDesignSave(quoteId, async () => {
      try {
        const result = await saveQuoteDesign(quoteId, nextDesign, nextOptions);
        // A newer tap carries the whole state, so only the latest tap may put the screen back.
        if (result.status === "error") return ticket === latest.current ? revert(result.message) : undefined;
        if (ticket === latest.current) setMessage(null);
        saved.current = {
          design: nextDesign ?? usual.design,
          options: nextDesign === null ? usual.options : nextOptions,
          following: nextDesign === null,
        };
      } catch {
        if (ticket === latest.current) revert("Couldn't reach the server, so the change wasn't saved. Check your connection and try again.");
      } finally {
        if (ticket === latest.current) setState("saved");
      }
    });
  }

  function revert(why: string) {
    setDesign(saved.current.design);
    setOptions(saved.current.options);
    setFollowing(saved.current.following);
    setMessage(why);
  }

  const theme = resolveTheme(design, options, brandColor);
  const shown: QuoteSnapshot = { ...snapshot, design: theme.key, theme };

  return (
    <>
      <LivePdfPreview snapshot={shown} draft label={label} />
      <section className="space-y-3" aria-labelledby="design-heading">
        <h2 id="design-heading" className="text-base font-semibold">
          Design
        </h2>
        <p className="text-base text-muted-foreground">
          Pick a look and the preview above changes.{" "}
          {following
            ? "It follows your usual look. Choosing here changes this quote only."
            : "Your usual look is set under Quotes and invoices."}{" "}
          <Link href="/app/documents#look" className="underline">
            Set your logo, brand colour and usual look
          </Link>
        </p>
        {message && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        <p className="sr-only" role="status" data-testid="current-design">
          {DESIGNS.find((d) => d.key === design)?.name}
        </p>
        <DesignPicker
          design={design}
          options={options}
          brandColor={brandColor}
          idPrefix="quote-design"
          onChange={(nextDesign, nextOptions) => {
            setDesign(nextDesign);
            setOptions(nextOptions);
            setFollowing(false);
            save(nextDesign, nextOptions);
          }}
        />
        <p className="text-sm text-muted-foreground" role="status" data-testid="design-save-status">
          {state === "saving" ? "Saving…" : ""}
        </p>
        {!following && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setFollowing(true);
              setDesign(usual.design);
              setOptions(usual.options);
              save(null, {});
            }}
          >
            Use my usual look
          </Button>
        )}
      </section>
    </>
  );
}
