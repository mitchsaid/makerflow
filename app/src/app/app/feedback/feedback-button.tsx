"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { MessageSquareIcon } from "lucide-react";
import { FormErrorScope } from "@/components/form-errors";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { SelectField, TextAreaField } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FEEDBACK_KINDS, FEEDBACK_KIND_LABELS, FEEDBACK_MAX, isFeedbackKind, type FeedbackKind } from "@/lib/feedback";
import { sendFeedback, type FeedbackState } from "./actions";

/**
 * "Send feedback" (docs/plans/feedback-button.md): a row on the More tab and an entry in the desktop sidebar, each
 * opening the same short sheet. The page the person was on and what they were using go with it, so a problem can be
 * found. Nothing is read back to them: it is kept for the people who run MakerFlow.
 */
export function FeedbackButton({ variant }: { variant: "row" | "sidebar" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {variant === "row" ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(true)}
          className="h-auto min-h-11 w-full flex-col items-start justify-start gap-0.5 whitespace-normal rounded-xl bg-card px-4 py-3 text-left ring-1 ring-foreground/10 hover:bg-muted"
        >
          <span className="block text-base font-medium">Send feedback</span>
          <span className="block text-sm font-normal text-muted-foreground">Something not working, or an idea? Tell us.</span>
        </Button>
      ) : (
        <Button type="button" variant="outline" className="min-h-11 w-full justify-start gap-3 text-sm font-medium text-muted-foreground" onClick={() => setOpen(true)}>
          <MessageSquareIcon aria-hidden="true" className="size-5" />
          Send feedback
        </Button>
      )}
      <FeedbackSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function FeedbackSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const [kind, setKind] = useState<FeedbackKind>("other");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState(true);
  const [state, setState] = useState<FeedbackState | null>(null);
  const [tries, setTries] = useState(0);
  const [pending, startTransition] = useTransition();

  const sent = state?.status === "sent";
  const errors = state?.status === "error" ? (state.errors ?? {}) : {};
  const problems: FormProblem[] = errors.message ? [{ fieldId: "feedback-message", label: "Your message", message: errors.message }] : [];

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      try {
        setState(
          await sendFeedback({
            kind,
            message,
            contact,
            page: pathname,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            userAgent: navigator.userAgent,
          }),
        );
      } catch {
        setState({ status: "error", message: "Couldn't reach the server, so that wasn't sent. Try again." });
      }
      setTries((n) => n + 1);
    });
  }

  // Closing after it was sent starts the next one empty; closing before keeps what was typed.
  function close() {
    if (pending) return;
    if (sent) {
      setMessage("");
      setKind("other");
      setState(null);
    }
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && close()}>
      <SheetContent side="right" className="h-dvh gap-0 overflow-y-auto">
        <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover pr-14">
          <SheetTitle className="text-lg">Send feedback</SheetTitle>
          <SheetDescription className="text-base">Tell us what&rsquo;s not working or what would help.</SheetDescription>
        </SheetHeader>
        {sent ? (
          <div className="space-y-4 px-4 py-4" data-testid="feedback-sent">
            <p className="text-base font-medium">Thank you. We read every message.</p>
            {contact && <p className="text-base text-muted-foreground">We may email you if we have a question.</p>}
            <Button type="button" size="lg" className="w-full" onClick={close}>
              Done
            </Button>
          </div>
        ) : (
          <FormErrorScope epoch={tries}>
            <form onSubmit={submit} className="space-y-4 px-4 py-4" noValidate>
              <FormSummary problems={problems} trigger={tries} />
              {state?.status === "error" && state.message && (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>{state.message}</AlertDescription>
                </Alert>
              )}
              <SelectField
                id="feedback-kind"
                name="kind"
                label="It's about"
                value={kind}
                onChange={(next) => setKind(isFeedbackKind(next) ? next : "other")}
                options={FEEDBACK_KINDS}
                optionLabels={FEEDBACK_KIND_LABELS}
              />
              <TextAreaField
                id="feedback-message"
                name="message"
                label="Your message"
                hint="What happened, or what would help? Say which screen if you can."
                rows={6}
                maxLength={FEEDBACK_MAX}
                value={message}
                error={errors.message}
                onChange={setMessage}
              />
              <Field orientation="horizontal" className="items-start py-1">
                <Checkbox id="feedback-contact" checked={contact} onCheckedChange={(checked) => setContact(checked === true)} />
                <FieldLabel htmlFor="feedback-contact" className="text-base">
                  You can email me about this
                </FieldLabel>
              </Field>
              <Button type="submit" size="lg" className="w-full" disabled={pending}>
                {pending ? "Sending…" : "Send feedback"}
              </Button>
            </form>
          </FormErrorScope>
        )}
      </SheetContent>
    </Sheet>
  );
}
