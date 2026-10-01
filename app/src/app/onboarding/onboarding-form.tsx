"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createBusiness, type OnboardingState } from "./actions";

const initial: OnboardingState = {};

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(createBusiness, initial);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Field data-invalid={!!state.error}>
        <FieldLabel htmlFor="name">Business name</FieldLabel>
        <Input
          id="name"
          name="name"
          type="text"
          autoComplete="organization"
          autoFocus
          required
          maxLength={120}
          placeholder="e.g. Sweet Nothings Confectionery"
          aria-invalid={!!state.error}
          aria-describedby={state.error ? "name-error" : undefined}
        />
        {state.error && <FieldError id="name-error">{state.error}</FieldError>}
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Setting up…" : "Continue"}
      </Button>
    </form>
  );
}
