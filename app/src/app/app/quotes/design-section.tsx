"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DesignPicker } from "@/components/design-picker";
import { DesignThumbnail } from "@/components/design-thumbnail";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DESIGNS, type DesignKey, type DesignOptions, type Theme } from "@/lib/quotes/designs";
import { saveQuoteDesign } from "./design-actions";

/**
 * How the quote is dressed. On a draft's preview: pick one of the five designs and make it your own,
 * and the preview above redraws as you go. On a sent quote: the design that version was sent with,
 * as it was.
 */
export function DesignSection({
  theme,
  quoteId,
  options = {},
  brandColor = null,
  following = false,
  usual,
  sent = false,
}: {
  /** The finished look this quote has now (a sent version's own, frozen). */
  theme: Theme;
  /** Present when the design can be changed (a draft). */
  quoteId?: string;
  /** What this quote changed from the design's own look (a draft). */
  options?: DesignOptions;
  /** The business's brand colour (a draft). */
  brandColor?: string | null;
  /** The quote has not chosen its own design: it follows the business's default. */
  following?: boolean;
  /** The business's usual look (a draft): what "Use my usual look" goes back to. */
  usual?: { design: DesignKey; options: DesignOptions };
  sent?: boolean;
}) {
  const current = DESIGNS.find((d) => d.key === theme.key) ?? DESIGNS[0];

  if (sent || !quoteId) {
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

  return (
    <DraftDesign
      quoteId={quoteId}
      initialDesign={theme.key}
      initialOptions={options}
      brandColor={brandColor}
      initialFollowing={following}
      usual={usual ?? { design: "classic", options: {} }}
    />
  );
}

function DraftDesign({
  quoteId,
  initialDesign,
  initialOptions,
  brandColor,
  initialFollowing,
  usual,
}: {
  quoteId: string;
  initialDesign: DesignKey;
  initialOptions: DesignOptions;
  brandColor: string | null;
  initialFollowing: boolean;
  usual: { design: DesignKey; options: DesignOptions };
}) {
  const router = useRouter();
  const [design, setDesign] = useState(initialDesign);
  const [options, setOptions] = useState(initialOptions);
  const [following, setFollowing] = useState(initialFollowing);
  const [message, setMessage] = useState<string | null>(null);
  const [updating, startUpdating] = useTransition();
  // Several quick taps are saved in order, and the preview is redrawn once, from the last one.
  const latest = useRef(0);

  function save(nextDesign: DesignKey | null, nextOptions: DesignOptions) {
    const ticket = ++latest.current;
    setMessage(null);
    startUpdating(async () => {
      try {
        const result = await saveQuoteDesign(quoteId, nextDesign, nextOptions);
        if (result.status === "error") setMessage(result.message);
        else if (ticket === latest.current) router.refresh();
      } catch {
        setMessage("Couldn't reach the server, so the change wasn't saved. Check your connection and try again.");
      }
    });
  }

  return (
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
      <div className="flex items-center gap-3">
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
        <p className="text-sm text-muted-foreground" role="status">
          {updating ? "Updating the preview…" : ""}
        </p>
      </div>
    </section>
  );
}
