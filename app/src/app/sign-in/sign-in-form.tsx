"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requestMagicLink, type SignInState } from "./actions";

const initial: SignInState = { status: "idle" };

export function SignInForm() {
  const [state, formAction, pending] = useActionState(requestMagicLink, initial);

  if (state.status === "sent") {
    return (
      <Card role="status" className="p-4 text-center">
        <h2 className="text-lg font-semibold">Check your email</h2>
        <p className="text-muted-foreground">
          We sent a sign-in link to <strong>{state.email}</strong>. Tap it on this
          device or any other. It works once and expires soon.
        </p>
      </Card>
    );
  }

  const hasError = state.status === "error";

  return (
    <form action={formAction} className="space-y-4" noValidate>
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
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
