"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { AddButton } from "@/components/add-button";
import { TextField } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { addItemStep, removeItemStep, resetItemSteps, type JobActionResult } from "./actions";

const OFFLINE = "Couldn't reach the server, so nothing was changed. Try again.";

/**
 * Changing the steps of ONE item on a job (docs/plans/quantity-prices-and-steps.md): add a step, take one off, or put
 * the item back to its product's steps. The product is never changed. A step that has been counted, and a reset, ask
 * first, because the counts on the steps go. Closed, it is a single button under the item.
 */
export function StepsEditor({
  jobId,
  itemId,
  name,
  madeMilli,
  steps,
  stepsEdited,
}: {
  jobId: string;
  itemId: string;
  name: string;
  /** How many of the item are made now: a new step starts at none and can lower it. */
  madeMilli: number;
  steps: { id: string; name: string; doneMilli: number }[];
  stepsEdited: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const [asking, setAsking] = useState<{ kind: "remove"; id: string; name: string } | { kind: "reset" } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const question = useRef<HTMLDivElement>(null);
  const openButton = useRef<HTMLButtonElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);

  // A question opens beside the step it is about: bring it into view and take focus on its first button.
  useEffect(() => {
    if (!asking) return;
    question.current?.scrollIntoView({ block: "center" });
    // The safe answer first: a keyboard press on arrival cannot throw anything away.
    question.current?.querySelectorAll("button")[1]?.focus({ preventScroll: true });
  }, [asking]);

  async function run(action: () => Promise<JobActionResult>, then?: () => void) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await action();
      if (result.status === "error") {
        setMessage(result.message);
        return false;
      }
      then?.();
      router.refresh();
      return true;
    } catch {
      setMessage(OFFLINE);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (newName.trim() === "") {
      setNameError("Give the step a name, like “Attach name tags”.");
      return;
    }
    if (newName.trim().length > 120) {
      setNameError("Keep the name to 120 characters or fewer.");
      return;
    }
    await run(() => addItemStep(jobId, itemId, newName), () => {
      setNewName("");
      setNameError(undefined);
      setAdding(false);
      setTimeout(() => addButton.current?.focus(), 0);
    });
  }

  if (!open) {
    return (
      steps.length > 0 ? (
        <Button ref={openButton} type="button" variant="link" className="h-auto min-h-11 justify-start px-0 underline text-muted-foreground text-sm" onClick={() => setOpen(true)}>
          Change steps
          <span className="sr-only"> for {name}</span>
        </Button>
      ) : (
        // Adding something has the plus, like every add action (docs/adr/0008-add-actions.md).
        <AddButton ref={openButton} variant="link" className="h-auto min-h-11 justify-start px-0 underline text-muted-foreground text-sm" onClick={() => setOpen(true)}>
          Add steps
          <span className="sr-only"> for {name}</span>
        </AddButton>
      )
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-3" role="group" aria-label={`Change the steps of ${name}`} data-testid="steps-editor">
      <p className="text-sm text-muted-foreground">Only for this item. The product keeps its steps.</p>
      {steps.length > 0 && (
        <ul className="space-y-1">
          {steps.map((step) => (
            <li key={step.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 text-base">{step.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive"
                aria-label={`Remove ${step.name} from ${name}`}
                disabled={busy}
                onClick={() => (step.doneMilli > 0 ? setAsking({ kind: "remove", id: step.id, name: step.name }) : void run(() => removeItemStep(jobId, step.id)))}
              >
                <Trash2Icon aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {steps.length === 0 && <p className="text-base">No steps: the item is counted as a whole.</p>}

      {asking?.kind === "remove" && (
        <div ref={question} className="space-y-3 rounded-xl border border-destructive/50 p-3" role="alertdialog" aria-label={`Remove ${asking.name}?`}>
          <p className="text-base">Take {asking.name} off {name}? What has been counted for it goes too.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="destructive" disabled={busy} onClick={() => run(() => removeItemStep(jobId, asking.id), () => setAsking(null))}>
              Yes, remove it
            </Button>
            <Button type="button" variant="outline" onClick={() => setAsking(null)}>
              Keep it
            </Button>
          </div>
        </div>
      )}

      {adding ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <TextField
            id={`add-step-${itemId}`}
            label="New step"
            hint={madeMilli > 0 && steps.length > 0 ? "It starts at none, so the item's count goes down until it is counted." : undefined}
            autoComplete="off"
            maxLength={120}
            value={newName}
            error={nameError}
            onChange={(v) => {
              setNewName(v);
              setNameError(undefined);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              Save step
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAdding(false);
                setNewName("");
                setNameError(undefined);
                setTimeout(() => addButton.current?.focus(), 0);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        steps.length < 30 && (
          <AddButton
            ref={addButton}
            onClick={() => {
              setAdding(true);
              setTimeout(() => document.getElementById(`add-step-${itemId}`)?.focus(), 0);
            }}
          >
            Add a step
            <span className="sr-only"> to {name}</span>
          </AddButton>
        )
      )}

      {stepsEdited && asking?.kind !== "reset" && (
        <Button type="button" variant="outline" disabled={busy} onClick={() => setAsking({ kind: "reset" })}>
          Reset to the product&apos;s steps
          <span className="sr-only"> for {name}</span>
        </Button>
      )}
      {asking?.kind === "reset" && (
        <div ref={question} className="space-y-3 rounded-xl border border-destructive/50 p-3" role="alertdialog" aria-label="Reset the steps?">
          <p className="text-base">Put {name} back to the product&apos;s steps? What has been counted on its steps goes back to none.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="destructive" disabled={busy} onClick={() => run(() => resetItemSteps(jobId, itemId), () => setAsking(null))}>
              Yes, reset it
            </Button>
            <Button type="button" variant="outline" onClick={() => setAsking(null)}>
              Keep my changes
            </Button>
          </div>
        </div>
      )}

      {message && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setOpen(false);
          setAdding(false);
          setAsking(null);
          setMessage(null);
          setTimeout(() => openButton.current?.focus(), 0);
        }}
      >
        Done
        <span className="sr-only"> changing steps</span>
      </Button>
    </div>
  );
}
