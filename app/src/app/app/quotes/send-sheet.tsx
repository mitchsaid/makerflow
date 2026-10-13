"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { TextField } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { SendProblem, SendProblemCode } from "@/lib/quotes/send-checks";
import {
  checkQuoteForSending,
  saveBusinessContact,
  sendQuote,
  type ContactDetails,
  type SendSheetState,
} from "./issue-actions";

const OFFLINE =
  "Couldn't reach the server. Check your connection, then open the quote to see whether it went through before trying again.";

/** Where each problem is fixed: the id of the field on the edit screen. */
const FIX_FIELD: Record<Exclude<SendProblemCode, "contact">, { id: string; label: string }> = {
  customer: { id: "customer", label: "Choose a customer" },
  items: { id: "add-item", label: "Add an item" },
  validity: { id: "validUntil", label: "Change the date" },
  deposit: { id: "depositValue", label: "Change the deposit" },
  "balance-date": { id: "balanceDueDate", label: "Change the date" },
};

/**
 * Pressing "Mark as sent" on the preview opens this. It looks at the saved quote and either lists exactly what is
 * missing (the business's phone or email can be added right here, and it carries on) or asks to mark the quote as
 * sent. Then the quote is sent: it is frozen and keeps its number.
 */
export function SendQuoteSheet({
  quoteId,
  open,
  onOpenChange,
  returnFocusId,
  onFix,
}: {
  quoteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes when the sheet closes without sending. */
  returnFocusId: string;
  /** Called with the id of the field that needs fixing; it is on the edit screen, not here. */
  onFix: (fieldId: string) => void;
}) {
  // While the quote is being sent the sheet stays open: closing it would hide what happened.
  const [busy, setBusy] = useState(false);

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !busy && onOpenChange(isOpen)}>
      <SheetContent
        side="right"
        className="h-dvh gap-0 overflow-y-auto"
        finalFocus={() => {
          const el = document.getElementById(returnFocusId);
          return el ?? true;
        }}
      >
        {/* Mounted only while the sheet is open, so every opening starts with a fresh check. */}
        <SendFlow
          quoteId={quoteId}
          onBusyChange={setBusy}
          onGoTo={onFix}
        />
      </SheetContent>
    </Sheet>
  );
}

function SendFlow({
  quoteId,
  onBusyChange,
  onGoTo,
}: {
  quoteId: string;
  onBusyChange: (busy: boolean) => void;
  onGoTo: (fieldId: string) => void;
}) {
  const router = useRouter();
  const [view, setView] = useState<SendSheetState | null>(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [checking, startChecking] = useTransition();

  function check() {
    startChecking(async () => {
      try {
        setView(await checkQuoteForSending(quoteId));
      } catch {
        setView({ status: "error", message: OFFLINE });
      }
    });
  }

  useEffect(() => {
    check();
    // Once, when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function working(on: boolean) {
    setSending(on);
    onBusyChange(on);
  }

  async function send() {
    setMessage(null);
    working(true);
    try {
      const result = await sendQuote(quoteId);
      if (result.status === "problems") {
        setView({ status: "problems", problems: result.problems, contact: result.contact });
        working(false);
        return;
      }
      if (result.status === "error") {
        setMessage(result.message);
        working(false);
        return;
      }
      router.push(`/app/quotes/${quoteId}?sent=marked`);
    } catch {
      setMessage(OFFLINE);
      working(false);
    }
  }

  return (
    <>
      <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover pr-14">
        <SheetTitle className="text-lg">
          {view?.status === "problems" ? "Before you can mark this quote as sent" : "Mark this quote as sent"}
        </SheetTitle>
        <SheetDescription className="text-base">
          {view?.status === "ready"
            ? `${view.number} for ${view.customerName} · ${view.totalText}`
            : view?.status === "problems"
              ? "A few things are missing."
              : "Checking your quote…"}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-4 px-4 py-4" aria-busy={view === null || checking}>
        {view === null && <p className="text-muted-foreground">Checking your quote…</p>}

        {view?.status === "error" && (
          <>
            <Alert variant="destructive">
              <AlertDescription>{view.message}</AlertDescription>
            </Alert>
            <Button type="button" variant="outline" onClick={check}>
              Try again
            </Button>
          </>
        )}

        {view?.status === "problems" && (
          <Problems problems={view.problems} contact={view.contact} onGoTo={onGoTo} onSaved={check} />
        )}

        {view?.status === "ready" && (
          <>
            {message && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}
            <p className="text-base">
              Mark it as sent once your customer has it. That locks this version, so what your customer gets
              can&apos;t change by accident. If something needs to change afterwards, you can revise it: it keeps the
              number {view.number}.
            </p>
            <Button type="button" size="lg" className="w-full" disabled={sending} onClick={send}>
              {sending ? "Saving…" : "Mark as sent"}
            </Button>
          </>
        )}
      </div>
    </>
  );
}

function Problems({
  problems,
  contact,
  onGoTo,
  onSaved,
}: {
  problems: SendProblem[];
  contact: ContactDetails;
  onGoTo: (fieldId: string) => void;
  onSaved: () => void;
}) {
  const [phone, setPhone] = useState(contact.phone);
  const [email, setEmail] = useState(contact.email);
  const [errors, setErrors] = useState<{ phone?: string; email?: string }>({});
  const [message, setMessage] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [pending, startTransition] = useTransition();

  function saveContact(event: React.FormEvent<HTMLFormElement>) {
    // The sheet is a portal over the quote form: this submit must not reach it.
    event.preventDefault();
    event.stopPropagation();
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await saveBusinessContact({ phone, email });
        setTries((n) => n + 1);
        if (result.status === "saved") {
          setErrors({});
          onSaved();
        } else {
          setErrors(result.errors ?? {});
          setMessage(result.message ?? null);
        }
      } catch {
        setMessage("Couldn't reach the server, so nothing was saved. Check your connection and try again.");
      }
    });
  }

  const contactProblem = problems.find((p) => p.code === "contact");
  const others = problems.filter((p) => p.code !== "contact");
  const summary: FormProblem[] = [
    ...(errors.phone ? [{ fieldId: "send-phone", label: "Phone", message: errors.phone }] : []),
    ...(errors.email ? [{ fieldId: "send-email", label: "Email", message: errors.email }] : []),
  ];

  return (
    <>
      {others.length > 0 && (
        <ul className="space-y-3" aria-label="What is missing">
          {others.map((p) => {
            const fix = FIX_FIELD[p.code as keyof typeof FIX_FIELD];
            return (
              <li key={p.code} className="space-y-2 rounded-xl bg-muted/40 p-3 ring-1 ring-foreground/10">
                <p className="text-base">{p.message}</p>
                <Button type="button" variant="outline" onClick={() => onGoTo(fix.id)}>
                  {fix.label}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {contactProblem && (
        <form onSubmit={saveContact} className="space-y-3 rounded-xl bg-muted/40 p-3 ring-1 ring-foreground/10" noValidate>
          <p className="text-base">{contactProblem.message}</p>
          {contact.canEdit ? (
            <>
              <FormSummary problems={summary} trigger={tries} />
              {message && (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              )}
              <TextField
                id="send-phone"
                name="phone"
                label="Phone (optional if you add an email)"
                type="tel"
                autoComplete="tel"
                value={phone}
                error={errors.phone}
                onChange={setPhone}
              />
              <TextField
                id="send-email"
                name="email"
                label="Email (optional if you add a phone number)"
                type="email"
                autoComplete="email"
                value={email}
                error={errors.email}
                onChange={setEmail}
              />
              <p className="text-sm text-muted-foreground">
                Saved to your Business profile, so you only add it once.
              </p>
              <Button type="submit" size="lg" className="w-full" disabled={pending}>
                {pending ? "Saving…" : "Save and continue"}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Only owners and admins can change the business details. Ask one of them to add a phone
              number or email in the Business profile.
            </p>
          )}
        </form>
      )}
    </>
  );
}
