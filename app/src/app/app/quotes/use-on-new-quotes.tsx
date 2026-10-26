"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export type UsualSaveResult = { status: "saved" } | { status: "error"; message?: string };

/**
 * "Use this … on new quotes" (docs/plans/use-on-new-quotes.md): a quiet link under a section of the quote form that
 * makes what is on this quote what every new quote starts with. It is a first-time thing a maker rarely changes, so it
 * is only there while the quote has something worth keeping that is not the usual yet; once saved (at once, quotes that
 * exist are never changed) it goes, leaving a note that says so and where to change it again (Quote settings, where all
 * of these live). Only owners and admins see it. "Use my usual" puts the usual back on a quote that differs from it.
 */
export function UseOnNewQuotes({
  label,
  what,
  plural = false,
  show,
  matches,
  canEdit,
  canUse,
  valueKey,
  onSave,
  onUse,
}: {
  /** "Use this discount on new quotes": the link's words, naming what it is, as a page has several. */
  label: string;
  /** What it is, for the notes and the Use my usual button: "discount", "deposit". */
  what: string;
  /** "these ways to pay" rather than "this …". */
  plural?: boolean;
  /** There is something on the quote to keep (a discount with an amount, words of the maker's own). */
  show: boolean;
  /** What is on the quote is the usual already: nothing to offer. */
  matches: boolean;
  /** Owners and admins: they can change what new quotes start with. */
  canEdit: boolean;
  /** There is a usual, and the quote differs from it: offer to put it back. */
  canUse: boolean;
  /** Changes whenever what is on the quote changes, so a note goes once it no longer describes it. */
  valueKey: string;
  /** Makes what is on the quote the usual. */
  onSave: () => Promise<UsualSaveResult>;
  onUse: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; key: string } | null>(null);
  const usedUsual = useRef(false);

  // After "Use my usual" the quote changes on the next render: the note is then tied to the new value.
  useEffect(() => {
    if (usedUsual.current) {
      usedUsual.current = false;
      setNote({ text: `Using your usual ${what}.`, key: valueKey });
    }
  }, [valueKey, what]);

  const offer = canEdit && show && !matches;
  const showNote = note !== null && note.key === valueKey;
  if (!offer && !canUse && !showNote && !message) return null;

  function save() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await onSave();
        if (result.status === "saved") {
          setNote({
            text: `New quotes now start with ${plural ? "these" : "this"} ${what}. You can change it in Quote settings.`,
            key: valueKey,
          });
        } else {
          setMessage(result.message ?? "Something went wrong saving that. Please try again.");
        }
      } catch {
        setMessage("Couldn't reach the server, so nothing was saved. Try again.");
      }
    });
  }

  return (
    <div className="space-y-1">
      {message && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-x-4">
        {offer && (
          <Button
            type="button"
            variant="link"
            disabled={pending}
            className="h-auto min-h-11 justify-start px-0 underline text-muted-foreground text-sm"
            onClick={save}
          >
            {pending ? "Saving…" : label}
          </Button>
        )}
        {canUse && (
          <Button
            type="button"
            variant="soft"
            disabled={pending}
            onClick={() => {
              usedUsual.current = true;
              onUse();
            }}
          >
            Use my usual<span className="sr-only"> {what}</span>
          </Button>
        )}
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {showNote ? note.text : ""}
      </p>
    </div>
  );
}
