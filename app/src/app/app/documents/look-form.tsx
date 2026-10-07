"use client";

import { useState, useTransition } from "react";
import { DesignPicker } from "@/components/design-picker";
import { Section } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DEFAULT_DESIGN, type DesignKey, type DesignOptions } from "@/lib/quotes/designs";
import { saveLook, type LookState } from "./look-actions";

/**
 * Quotes and invoices > Your look. The brand colour and the design new quotes start with, made your
 * own. A quote can still choose another design for itself; sent quotes keep the look they were sent in.
 */
export function LookForm({
  initialColour,
  initialDesign,
  initialOptions,
}: {
  initialColour: string | null;
  initialDesign: DesignKey | null;
  initialOptions: DesignOptions;
}) {
  const [design, setDesign] = useState<DesignKey>(initialDesign ?? DEFAULT_DESIGN);
  // The colour chosen here is the brand colour; it is not kept twice as a design change.
  const [options, setOptions] = useState<DesignOptions>(initialOptions);
  const [colour, setColour] = useState(initialColour);
  const [state, setState] = useState<LookState>({ status: "idle" });
  const [editedSinceSave, setEditedSinceSave] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditedSinceSave(false);
    startTransition(async () => {
      try {
        setState(await saveLook(colour ?? "", design, options));
      } catch {
        setEditedSinceSave(true);
        setState({ status: "error", message: "Couldn't reach the server, so nothing was saved. Check your connection and try again." });
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate id="look">
      <Section title="Your look">
        <p className="text-base text-muted-foreground">
          Choose the design your quotes start with and make it yours. Every quote can still pick another design for
          itself, and quotes you have already sent keep the look they were sent in.
        </p>
        {state.status === "error" && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}
        <DesignPicker
          design={design}
          options={colour ? { ...options, accent: colour } : options}
          brandColor={null}
          idPrefix="look-design"
          onChange={(nextDesign, nextOptions) => {
            setEditedSinceSave(true);
            setDesign(nextDesign);
            // A colour picked here becomes the brand colour for every design; the rest are this design's.
            const { accent, ...rest } = nextOptions;
            setColour(accent ?? null);
            setOptions(rest);
          }}
        />
      </Section>
      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save my look"}
        </Button>
        {state.status === "saved" && !editedSinceSave && (
          <p role="status" className="text-base">
            Saved.
          </p>
        )}
      </div>
    </form>
  );
}
