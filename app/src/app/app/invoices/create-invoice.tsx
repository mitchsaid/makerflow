"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AddButton } from "@/components/add-button";
import { FormErrorScope } from "@/components/form-errors";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { TextAreaField, TextField } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { INVOICE_NOTE_MAX, parseInvoiceForm, type InvoiceFormErrors, type InvoiceFormValues, type InvoiceProblem } from "@/lib/invoices";
import { ComingSoonSection } from "@/components/coming-soon";
import { issueInvoice } from "./actions";

const OFFLINE = "Couldn't reach the server. Open the quote to see if it went through before trying again.";

/** On an accepted quote: turns it into a numbered invoice that can't be changed. Opens the invoice when it is made. */
export function CreateInvoice({
  quoteId,
  documentTitle,
  customerName,
  totalText,
  defaults,
  problems,
  customerId,
  defaultOpen = false,
}: {
  quoteId: string;
  /** Open when the page does: the card on a finished job sends the maker here with the sheet ready. */
  defaultOpen?: boolean;
  /** "Tax invoice" or "Invoice", in the country's words. */
  documentTitle: string;
  customerName: string;
  totalText: string;
  defaults: InvoiceFormValues;
  /** What the invoice still needs before it can be issued, worked out on the server. */
  problems: InvoiceProblem[];
  customerId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-2">
      <AddButton size="lg" variant="default" id="create-invoice" onClick={() => setOpen(true)}>
        Create invoice
      </AddButton>
      <p className="text-sm text-muted-foreground">Turn this accepted quote into a numbered {documentTitle.toLowerCase()}.</p>
      <Sheet
        open={open}
        onOpenChange={(isOpen) => {
          if (busy) return;
          setOpen(isOpen);
          // Take the request to open it out of the address, so a reload does not open it again.
          if (!isOpen && defaultOpen) router.replace(`/app/quotes/${quoteId}`, { scroll: false });
        }}
      >
        <SheetContent
          side="right"
          className="h-dvh gap-0 overflow-y-auto"
          finalFocus={() => document.getElementById("create-invoice") ?? true}
        >
          {/* Mounted only while open, so every opening starts from the defaults. */}
          {open && (
            <InvoiceForm
              quoteId={quoteId}
              documentTitle={documentTitle}
              customerName={customerName}
              totalText={totalText}
              defaults={defaults}
              problems={problems}
              customerId={customerId}
              onBusyChange={setBusy}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function InvoiceForm({
  quoteId,
  documentTitle,
  customerName,
  totalText,
  defaults,
  problems: initialProblems,
  customerId,
  onBusyChange,
}: {
  quoteId: string;
  documentTitle: string;
  customerName: string;
  totalText: string;
  defaults: InvoiceFormValues;
  problems: InvoiceProblem[];
  customerId: string | null;
  onBusyChange: (busy: boolean) => void;
}) {
  const [values, setValues] = useState<InvoiceFormValues>(defaults);
  const [errors, setErrors] = useState<InvoiceFormErrors>({});
  const [problems, setProblems] = useState<InvoiceProblem[]>(initialProblems);
  const [message, setMessage] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    setMessage(null);
    setTries((n) => n + 1);
    // Fix what is missing first: nothing is asked of the server until the invoice could be issued.
    const checked = parseInvoiceForm(values);
    setErrors(checked.ok ? {} : checked.errors);
    if (problems.length > 0 || !checked.ok) return;
    onBusyChange(true);
    startTransition(async () => {
      try {
        const result = await issueInvoice(quoteId, values);
        onBusyChange(false);
        if (result.status === "invalid") setErrors(result.errors);
        else if (result.status === "problems") setProblems(result.problems);
        else setMessage(result.message);
      } catch (error) {
        // Issuing ends by opening the invoice: that is a redirect, not a failure.
        const digest = (error as { digest?: unknown } | null)?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw error;
        onBusyChange(false);
        setMessage(OFFLINE);
      }
    });
  }

  const summary: FormProblem[] = [
    // The list below shows what is missing from the start; the summary joins in once the button has been pressed.
    ...(tries === 0 ? [] : problems).map((p) => ({ fieldId: `invoice-problem-${p.code}`, label: "Before you can issue it", message: p.message })),
    ...(errors.issueDate ? [{ fieldId: "invoice-issue-date", label: "Invoice date", message: errors.issueDate }] : []),
    ...(errors.dueDate ? [{ fieldId: "invoice-due-date", label: "Due day", message: errors.dueDate }] : []),
    ...(errors.note ? [{ fieldId: "invoice-note", label: "Note", message: errors.note }] : []),
  ];

  return (
    <>
      <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover pr-14">
        <SheetTitle className="text-lg">Create {documentTitle.toLowerCase()}</SheetTitle>
        <SheetDescription className="text-base">
          For {customerName} · {totalText}
        </SheetDescription>
      </SheetHeader>
      <FormErrorScope epoch={tries}>
        <form onSubmit={submit} noValidate className="space-y-4 px-4 py-4">
          <FormSummary problems={summary} trigger={tries} />
          {message && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          {problems.length > 0 && (
            <ul className="space-y-3" aria-label="What is missing">
              {problems.map((p) => (
                <li key={p.code} className="space-y-2 rounded-xl bg-muted/40 p-3 ring-1 ring-foreground/10">
                  <p className="text-base">{p.message}</p>
                  {p.code === "vat-changed" ? (
                    <Link id={`invoice-problem-${p.code}`} href={`/app/quotes/${quoteId}`} className="inline-flex min-h-11 items-center font-medium underline">
                      Back to the quote
                    </Link>
                  ) : (
                    <Link
                      id={`invoice-problem-${p.code}`}
                      href={p.code === "business" ? "/app/business" : customerId ? `/app/customers/${customerId}` : "/app/customers"}
                      className="inline-flex min-h-11 items-center font-medium underline"
                    >
                      {p.code === "business" ? "Open your business profile" : "Open the customer"}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
          <TextField
            id="invoice-issue-date"
            type="date"
            label="Invoice date"
            value={values.issueDate}
            error={errors.issueDate}
            onChange={(issueDate) => setValues((v) => ({ ...v, issueDate }))}
          />
          <TextField
            id="invoice-due-date"
            type="date"
            label="Due day"
            hint="The day you want to be paid by."
            value={values.dueDate}
            error={errors.dueDate}
            onChange={(dueDate) => setValues((v) => ({ ...v, dueDate }))}
          />
          <TextAreaField
            id="invoice-note"
            label="Note (optional)"
            hint="Shown on the invoice, like thanks or a reminder."
            rows={3}
            maxLength={INVOICE_NOTE_MAX + 100}
            value={values.note}
            error={errors.note}
            onChange={(note) => setValues((v) => ({ ...v, note }))}
          />
          <ComingSoonSection title="Adjust before issuing" description="Change items or prices on the invoice." />
          <p className="text-sm text-muted-foreground">
            It gets the next invoice number and can&apos;t be changed after that. A mistake is fixed with a credit note.
          </p>
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "Issuing…" : `Issue ${documentTitle.toLowerCase()}`}
          </Button>
        </form>
      </FormErrorScope>
    </>
  );
}

/** On a quote that has been invoiced: where the invoice is. */
export function InvoiceMade({ id, number }: { id: string; number: string }) {
  return (
    <Card>
      <CardContent className="space-y-1">
        <h3 className="text-base font-medium">Invoice {number}</h3>
        <p className="text-sm text-muted-foreground">
          Issued from this quote, so its answer is locked.{" "}
          <Link href={`/app/invoices/${id}`} className="inline-flex min-h-11 items-center font-medium underline">
            Open the invoice
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
