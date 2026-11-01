"use client";

import { useActionState, useState } from "react";
import { Turnstile, turnstileSiteKey } from "@/components/turnstile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requestMagicLink, type SignInState } from "./actions";

const initial: SignInState = { status: "idle" };

export function SignInForm() {
  const [state, formAction, pending] = useActionState(requestMagicLink, initial);
  // The "are you a person?" check, when the site has it switched on: its one-use token goes with the email.
  const checking = turnstileSiteKey() !== null;
  const [token, setToken] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);

  if (state.status === "sent") {
    return (
      <Card role="status" className="p-4 text-center">
        <h2 className="text-lg font-semibold">Check your email</h2>
        <p className="text-muted-foreground">
          We sent a sign-in link to <strong>{state.email}</strong>. Open it on any device. It works once and expires soon.
        </p>
      </Card>
    );
  }

  const hasError = state.status === "error";

  return (
    <form
      action={formAction}
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        // The button stays pressable: if the check has not finished, say so rather than going quiet.
        if (checking && !token) {
          event.preventDefault();
          setWaiting(true);
        }
      }}
    >
      <Field data-invalid={hasError}>
        <FieldLabel htmlFor="email">Email address</FieldLabel>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          aria-invalid={hasError}
          aria-describedby={hasError ? "email-error" : undefined}
        />
        {hasError && <FieldError id="email-error">{state.message}</FieldError>}
      </Field>
      {checking && (
        <>
          <input type="hidden" name="captchaToken" value={token ?? ""} />
          <Turnstile
            onToken={(t) => {
              setToken(t);
              if (t) setWaiting(false);
            }}
          />
          {waiting && !token && (
            <p role="status" className="text-center text-sm text-muted-foreground">
              One moment: we&apos;re checking you&apos;re a person. Press the button again when the tick appears.
            </p>
          )}
        </>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
