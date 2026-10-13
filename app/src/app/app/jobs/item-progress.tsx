"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MinusIcon, PlusIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { TextField } from "@/components/form-fields";
import { parseMade, stepMade } from "@/lib/jobs";
import { quantityToInput, type NumberStyle } from "@/lib/money";
import { quantityText } from "@/lib/quotes/units";
import { setItemMade } from "./actions";

const OFFLINE = "Couldn't reach the server, so that count was not saved. Check your connection and try again.";

/**
 * How much of one item is made: plus and minus for one unit at a time, a number to type, and "All made". The count
 * on screen changes at once; the saves go to the server one after another, so quick taps cannot cross. If a save is
 * refused the count goes back to what the server has and says why.
 */
export function ItemProgress({
  jobId,
  itemId,
  name,
  quantityMilli,
  madeMilli,
  unit,
  numberStyle,
}: {
  jobId: string;
  itemId: string;
  name: string;
  quantityMilli: number;
  madeMilli: number;
  unit: string | null;
  numberStyle: NumberStyle;
}) {
  const router = useRouter();
  const [made, setMade] = useState(madeMilli);
  const [text, setText] = useState(quantityToInput(madeMilli, numberStyle));
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  // What the server has: the last count that was saved, to go back to if a save is refused.
  const saved = useRef(madeMilli);
  const queue = useRef<Promise<void>>(Promise.resolve());
  // Saves queued before a refused one were built on it, so they are dropped when it fails.
  const generation = useRef(0);
  const waiting = useRef(0);

  // A fresh count from the server (after a refresh) replaces what is shown, but never while saves are on their way:
  // a refresh started by another item can hand back a half-way count.
  const [seen, setSeen] = useState(madeMilli);
  if (madeMilli !== seen && !saving) {
    setSeen(madeMilli);
    setMade(madeMilli);
    setText(quantityToInput(madeMilli, numberStyle));
  }
  useEffect(() => {
    saved.current = madeMilli;
  }, [madeMilli]);

  const done = made >= quantityMilli;

  function save(next: number) {
    if (next === made && !error) return;
    setMade(next);
    setText(quantityToInput(next, numberStyle));
    setError(undefined);
    waiting.current += 1;
    setSaving(true);
    const mine = generation.current;
    const fail = (message: string) => {
      generation.current += 1;
      setError(message);
      setMade(saved.current);
      setText(quantityToInput(saved.current, numberStyle));
    };
    queue.current = queue.current.then(async () => {
      try {
        if (mine !== generation.current) return;
        const result = await setItemMade(jobId, itemId, next);
        if (result.status === "done") saved.current = next;
        else fail(result.message);
      } catch {
        fail(OFFLINE);
      } finally {
        waiting.current -= 1;
        if (waiting.current === 0) setSaving(false);
        // Once the last save has finished the page shows what the server has (the job may have started).
        if (waiting.current === 0) router.refresh();
      }
    });
  }

  function commitText() {
    if (text.trim() === quantityToInput(made, numberStyle)) return;
    const parsed = parseMade(text, quantityMilli, numberStyle);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    save(parsed.value);
  }

  const idBase = `made-${itemId}`;
  return (
    <div className="space-y-2 border-t border-border pt-3" data-testid="item-progress">
      <p className="text-sm font-medium" role="status">
        {done ? "All made" : `Made ${quantityText(made, null, numberStyle)} of ${quantityText(quantityMilli, unit, numberStyle)}`}
        {saving && <span className="font-normal text-muted-foreground"> · Saving…</span>}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`One less made of ${name}`}
          disabled={made <= 0}
          onClick={() => save(stepMade(made, quantityMilli, -1))}
        >
          <MinusIcon aria-hidden="true" />
        </Button>
        <form
          className="w-24"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            commitText();
          }}
        >
          <TextField
            id={idBase}
            label={`How many of ${name} are made`}
            labelHidden
            inputMode="decimal"
            autoComplete="off"
            value={text}
            onChange={(value) => {
              setText(value);
              setError(undefined);
            }}
            onBlur={commitText}
          />
        </form>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`One more made of ${name}`}
          disabled={made >= quantityMilli}
          onClick={() => save(stepMade(made, quantityMilli, 1))}
        >
          <PlusIcon aria-hidden="true" />
        </Button>
        <Field orientation="horizontal" className="min-h-11 w-auto items-center py-1.5">
          <Checkbox
            id={`${idBase}-all`}
            checked={done}
            onCheckedChange={(checked) => save(checked === true ? quantityMilli : 0)}
          />
          <FieldLabel htmlFor={`${idBase}-all`} className="text-base">
            All made<span className="sr-only"> for {name}</span>
          </FieldLabel>
        </Field>
      </div>
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
