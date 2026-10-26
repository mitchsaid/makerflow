"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";

export type UsualSaveResult = { status: "saved" } | { status: "error"; message?: string };

/**
 * "Use this … on new quotes" (docs/plans/use-on-new-quotes.md): one tick at the end of a section of the quote form that
 * says whether what is on this quote is what every new quote starts with, and changes that in one tap. Ticked: what is
 * on the quote becomes the usual. Unticked: new quotes start without it. It is saved at once (quotes that exist are never
 * changed), and it is ticked by itself when the quote already matches the usual. Only owners and admins see the tick;
 * anyone can put the usual back on the quote with "Use my usual".
 */
export function UseOnNewQuotes({
  id,
  label,
  what,
  plural = false,
  show,
  checked,
  canEdit,
  canUse,
  valueKey,
  onToggle,
  onUse,
}: {
  id: string;
  /** "Use this discount on new quotes": names what it is, as a page has several. */
  label: string;
  /** What it is, for the notes and the Use my usual button: "discount", "deposit". */
  what: string;
  /** "these ways to pay" rather than "this …". */
  plural?: boolean;
  /** There is something on the quote to keep (a discount with an amount, words that are the maker's own). */
  show: boolean;
  /** What is on the quote is the usual now. */
  checked: boolean;
  /** Owners and admins: they can change what new quotes start with. */
  canEdit: boolean;
  /** There is a usual, and the quote differs from it: offer to put it back. */
  canUse: boolean;
  /** Changes whenever what is on the quote changes, so a note goes once it no longer describes it. */
  valueKey: string;
  /** Saves (true) or clears (false) the usual from what is on the quote now. */
  onToggle: (on: boolean) => Promise<UsualSaveResult>;
  onUse: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [wanted, setWanted] = useState<boolean | null>(null);
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

  const showTick = canEdit && show;
  const showNote = note !== null && note.key === valueKey;
  if (!showTick && !canUse && !showNote && !message) return null;

  function toggle(on: boolean) {
    setMessage(null);
    setWanted(on);
    startTransition(async () => {
      try {
        const result = await onToggle(on);
        if (result.status === "saved") {
          const it = `${plural ? "these" : "this"} ${what}`;
          setNote({ text: on ? `New quotes now start with ${it}.` : `New quotes no longer start with ${it}.`, key: valueKey });
        } else {
          setMessage(result.message ?? "Something went wrong saving that. Please try again.");
        }
      } catch {
        setMessage("Couldn't reach the server, so nothing was saved. Try again.");
      }
      setWanted(null);
    });
  }

  return (
    <div className="space-y-1">
      {message && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      {showTick && (
        <Field orientation="horizontal" className="items-start py-2.5">
          <Checkbox
            id={id}
            checked={wanted ?? checked}
            disabled={pending}
            onCheckedChange={(next) => toggle(next === true)}
          />
          <FieldLabel htmlFor={id} className="text-base">
            {label}
          </FieldLabel>
        </Field>
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
      <p role="status" className="text-sm text-muted-foreground">
        {showNote ? note.text : ""}
      </p>
    </div>
  );
}
