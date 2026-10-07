"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { SelectField, TextAreaField, TextField } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  ANSWER_WAYS,
  NOTE_MAX,
  type OutcomeErrors,
  type OutcomeFormValues,
  type OutcomeKind,
} from "@/lib/quotes/outcome";
import { quoteAgain } from "./actions";
import { recordOutcome, reopenQuote } from "./outcome-actions";

const OFFLINE = "Couldn't reach the server. Check your connection and try again.";

const TITLES: Record<OutcomeKind, string> = {
  accepted: "They accepted",
  declined: "They declined",
  withdrawn: "Withdraw this quote",
};

const WAY_OPTIONS = ANSWER_WAYS.map((w) => w.value);
const WAY_LABELS = Object.fromEntries(ANSWER_WAYS.map((w) => [w.value, w.label]));

/** On a sent quote: what the customer said, or taking the quote back. Each opens a short sheet. */
export function OutcomeButtons({ quoteId, number, today }: { quoteId: string; number: string; today: string }) {
  const [open, setOpen] = useState<OutcomeKind | null>(null);
  const [lastOpened, setLastOpened] = useState<OutcomeKind>("accepted");

  function show(kind: OutcomeKind) {
    setLastOpened(kind);
    setOpen(kind);
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <h3 className="text-base font-medium">Has your customer answered?</h3>
        <p className="text-sm text-muted-foreground">
          Write it down so you can see where every quote stands. Nothing is sent to your customer.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" size="lg" variant="outline" id="outcome-accepted" onClick={() => show("accepted")}>
            They accepted
          </Button>
          <Button type="button" size="lg" variant="outline" id="outcome-declined" onClick={() => show("declined")}>
            They declined
          </Button>
          <Button type="button" size="lg" variant="outline" id="outcome-withdrawn" onClick={() => show("withdrawn")}>
            Withdraw this quote
          </Button>
        </div>
      </CardContent>
      <Sheet open={open !== null} onOpenChange={(isOpen) => !isOpen && setOpen(null)}>
        <SheetContent
          side="right"
          className="h-dvh gap-0 overflow-y-auto"
          finalFocus={() => document.getElementById(`outcome-${lastOpened}`) ?? true}
        >
          {/* Mounted only while open, so every opening starts with an empty form. */}
          {open && <OutcomeForm kind={open} quoteId={quoteId} number={number} today={today} onDone={() => setOpen(null)} />}
        </SheetContent>
      </Sheet>
    </Card>
  );
}

function OutcomeForm({
  kind,
  quoteId,
  number,
  today,
  onDone,
}: {
  kind: OutcomeKind;
  quoteId: string;
  number: string;
  today: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<OutcomeFormValues>({ on: today, how: "", note: "" });
  const [errors, setErrors] = useState<OutcomeErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [pending, startTransition] = useTransition();
  const answer = kind !== "withdrawn";

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await recordOutcome(quoteId, kind, values);
        setTries((n) => n + 1);
        if (result.status === "done") {
          router.refresh();
          onDone();
          return;
        }
        setErrors(result.errors ?? {});
        setMessage(result.message ?? null);
      } catch {
        setMessage(OFFLINE);
      }
    });
  }

  const summary: FormProblem[] = [
    ...(errors.on ? [{ fieldId: "outcome-on", label: "Day", message: errors.on }] : []),
    ...(errors.how ? [{ fieldId: "outcome-how", label: "How they told you", message: errors.how }] : []),
    ...(errors.note ? [{ fieldId: "outcome-note", label: "Note", message: errors.note }] : []),
  ];

  return (
    <>
      <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover pr-14">
        <SheetTitle className="text-lg">{TITLES[kind]}</SheetTitle>
        <SheetDescription className="text-base">Quote {number}</SheetDescription>
      </SheetHeader>
      <form onSubmit={submit} noValidate className="space-y-4 px-4 py-4">
        <FormSummary problems={summary} trigger={tries} />
        {message && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        {answer ? (
          <>
            <TextField
              id="outcome-on"
              type="date"
              label="Day they told you"
              value={values.on}
              error={errors.on}
              max={today}
              onChange={(on) => setValues((v) => ({ ...v, on }))}
            />
            <SelectField
              id="outcome-how"
              label="How they told you"
              placeholder="Choose one"
              options={WAY_OPTIONS}
              optionLabels={WAY_LABELS}
              value={values.how}
              error={errors.how}
              onChange={(how) => setValues((v) => ({ ...v, how }))}
            />
          </>
        ) : (
          <p className="text-base">
            This marks the quote as no longer on offer. It stays on record, and it can&apos;t be undone. If you
            change your mind, use Quote again to start a fresh one.
          </p>
        )}
        <TextAreaField
          id="outcome-note"
          label={answer ? "Note (optional)" : "Why? (optional)"}
          hint={answer ? "Anything worth remembering, like what they said or asked for." : undefined}
          rows={3}
          maxLength={NOTE_MAX + 100}
          value={values.note}
          error={errors.note}
          onChange={(note) => setValues((v) => ({ ...v, note }))}
        />
        <Button type="submit" size="lg" className="w-full" variant={answer ? "default" : "destructive"} disabled={pending}>
          {pending ? "Saving…" : answer ? "Save answer" : "Withdraw quote"}
        </Button>
      </form>
    </>
  );
}

/** On an accepted or declined quote: put it back to sent so a different answer can be recorded. */
export function ChangeAnswerButton({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await reopenQuote(quoteId);
        if (result.status === "done") router.refresh();
        else setMessage(result.message ?? OFFLINE);
      } catch {
        setMessage(OFFLINE);
      }
    });
  }

  return (
    <div className="space-y-2">
      {message && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <Button type="button" size="lg" variant="outline" disabled={pending} onClick={change}>
        {pending ? "Changing…" : "Change the answer"}
      </Button>
      <p className="text-sm text-muted-foreground">
        Puts the quote back to Sent so you can record a different answer. The earlier answer stays in the activity.
      </p>
    </div>
  );
}

/** Start a new quote from this one: same customer and items, a new number, today's dates. */
export function QuoteAgainButton({ quoteId }: { quoteId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function again() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await quoteAgain(quoteId);
        setMessage(result.message);
      } catch (error) {
        // Copying ends by opening the new draft: that is a redirect, not a failure.
        const digest = (error as { digest?: unknown } | null)?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw error;
        setMessage(OFFLINE);
      }
    });
  }

  return (
    <div className="space-y-2">
      {message && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <Button type="button" size="lg" variant="outline" disabled={pending} onClick={again}>
        {pending ? "Copying…" : "Quote again"}
      </Button>
      <p className="text-sm text-muted-foreground">
        Starts a new draft for the same customer with the same items, wording and deposit. It gets a new number,
        and this quote stays as it is.
      </p>
    </div>
  );
}
