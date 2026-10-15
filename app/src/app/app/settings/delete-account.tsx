"use client";

import { useRef, useState, useTransition } from "react";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { confirmationProblem } from "@/lib/account";
import { deleteAccount } from "./actions";
import { FormErrorScope } from "@/components/form-errors";

const OFFLINE = "Couldn't reach the server, so we can't tell whether your account was deleted. Reload the page: if you are still signed in, try again.";

/**
 * Settings > Delete your account. A card that says what it does, and a sheet that asks the person to type their own
 * email address. The button stays enabled: pressing it with the wrong text says what to type, at the field and in a
 * summary, and nothing typed is lost (docs/adr/0005-form-errors.md).
 */
export function DeleteAccount({ email }: { email: string }) {
  const opener = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [message, setMessage] = useState<string | undefined>();
  const [tries, setTries] = useState(0);
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setTyped("");
    setFieldError(undefined);
    setMessage(undefined);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    setMessage(undefined);
    const problem = confirmationProblem(typed, email);
    if (problem) {
      setFieldError(problem);
      setTries((n) => n + 1);
      return;
    }
    setFieldError(undefined);
    startTransition(async () => {
      try {
        const result = await deleteAccount(typed);
        if (result.status === "error") {
          setFieldError(result.field);
          setMessage(result.message);
          setTries((n) => n + 1);
        }
      } catch (error) {
        // A good delete ends by leaving for the home page: that is a redirect, not a failure.
        const digest = (error as { digest?: unknown } | null)?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw error;
        setMessage(OFFLINE);
        setTries((n) => n + 1);
      }
    });
  }

  const problems: FormProblem[] = [
    ...(fieldError ? [{ fieldId: "confirm-email", label: "Your email address", message: fieldError }] : []),
    ...(message ? [{ fieldId: "delete-account-submit", label: "Delete my account", message }] : []),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Delete your account</CardTitle>
        <CardDescription className="text-base">
          Removes your sign-in and every business that only you belong to, with its quotes, jobs, customers, products,
          pictures and settings. It cannot be undone. You can sign up again afterwards and start from the beginning.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button ref={opener} id="delete-account" type="button" variant="destructive" onClick={() => setOpen(true)}>
          Delete my account
        </Button>
      </CardContent>

      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && !pending && close()}>
        <SheetContent
          side="right"
          className="h-dvh gap-0 overflow-y-auto"
          finalFocus={() => document.getElementById("delete-account") ?? true}
        >
          <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover pr-14">
            <SheetTitle className="text-lg">Delete your account?</SheetTitle>
            <SheetDescription className="text-base">This cannot be undone.</SheetDescription>
          </SheetHeader>
          <FormErrorScope epoch={tries}>
          <form onSubmit={submit} noValidate className="space-y-4 px-4 pt-4">
            <div className="space-y-2 text-base">
              <p className="font-medium">What will be deleted</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Your sign-in.</li>
                <li>Every business that only you belong to, with its quotes, jobs, customers, products, pictures and settings.</li>
              </ul>
              <p className="font-medium">What stays</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Businesses that have other people in them. You are only removed from them.</li>
              </ul>
            </div>
            <FormSummary problems={problems} trigger={tries} />
            <p className="text-base">
              To confirm, type your email address: <strong data-testid="confirm-email-shown">{email}</strong>
            </p>
            <TextField
              id="confirm-email"
              label="Your email address"
              type="email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={typed}
              error={fieldError}
              onChange={(value) => {
                setTyped(value);
                setFieldError(undefined);
              }}
            />
            <div className="flex flex-wrap gap-3">
              <Button id="delete-account-submit" type="submit" variant="destructive" size="lg" disabled={pending}>
                {pending ? "Deleting…" : "Delete my account"}
              </Button>
              <Button type="button" variant="outline" size="lg" disabled={pending} onClick={close}>
                Cancel
              </Button>
            </div>
          </form>
          </FormErrorScope>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
