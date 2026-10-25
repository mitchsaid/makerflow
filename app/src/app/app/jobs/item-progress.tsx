"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MinusIcon, PlusIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/form-fields";
import { parseMade, stepMade } from "@/lib/jobs";
import { quantityToInput, type NumberStyle } from "@/lib/money";
import { quantityText } from "@/lib/quotes/units";
import { setItemMade, setStepDone } from "./actions";

const OFFLINE = "Couldn't reach the server, so that count wasn't saved. Try again.";

/**
 * How much of one item is made: plus and minus for one unit at a time, a number to type, and an "All made" button. The count
 * on screen changes at once; the saves go to the server one after another, so quick taps cannot cross. If a save is
 * refused the count goes back to what the server has and says why.
 *
 * With a `step`, the same control counts how many have been through one step of the item (the item's own count is then
 * the fewest any step has reached).
 */
export function ItemProgress({
  jobId,
  itemId,
  name,
  quantityMilli,
  madeMilli,
  unit,
  numberStyle,
  step,
}: {
  jobId: string;
  itemId: string;
  name: string;
  quantityMilli: number;
  madeMilli: number;
  unit: string | null;
  numberStyle: NumberStyle;
  /** Counting one of the item's steps instead of the whole item: `madeMilli` is how many have been through it. */
  step?: { id: string; name: string };
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
        const result = step ? await setStepDone(jobId, step.id, next) : await setItemMade(jobId, itemId, next);
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

  const idBase = step ? `done-${step.id}` : `made-${itemId}`;
  // What the control talks about: the whole item ("One less made of Cake"), or one of its steps ("One less Bake for Cake").
  const lessLabel = step ? `One less ${step.name} for ${name}` : `One less made of ${name}`;
  const moreLabel = step ? `One more ${step.name} for ${name}` : `One more made of ${name}`;
  const textLabel = step ? `How many of ${name} have been through ${step.name}` : `How many of ${name} are made`;
  const allWords = step ? "All done" : "All made";
  const count = `${quantityText(made, null, numberStyle)} of ${quantityText(quantityMilli, unit, numberStyle)}`;
  return (
    <div className="space-y-2 border-t border-border pt-3" data-testid={step ? "step-progress" : "item-progress"}>
      <p className="text-sm font-medium" role="status">
        {step ? `${step.name}: ${done ? "all done" : count}` : done ? "All made" : `Made ${count}`}
        {saving && <span className="font-normal text-muted-foreground"> · Saving…</span>}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={lessLabel}
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
            label={textLabel}
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
          aria-label={moreLabel}
          disabled={made >= quantityMilli}
          onClick={() => save(stepMade(made, quantityMilli, 1))}
        >
          <PlusIcon aria-hidden="true" />
        </Button>
        {/* One more way to count, as a button beside the stepper (not a tick box inside a counter). */}
        {!done && (
          <Button type="button" variant="soft" id={`${idBase}-all`} onClick={() => save(quantityMilli)}>
            {allWords}
            <span className="sr-only"> for {step ? `${step.name}, ${name}` : name}</span>
          </Button>
        )}
      </div>
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
