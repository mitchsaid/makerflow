"use client";

import { useActionState } from "react";
import { createBusiness, type OnboardingState } from "./actions";

const initial: OnboardingState = {};

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(createBusiness, initial);

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <label htmlFor="name" className="block text-sm font-medium">
        Business name
      </label>
      <input
        id="name"
        name="name"
        type="text"
        autoComplete="organization"
        autoFocus
        required
        maxLength={120}
        placeholder="e.g. Sweet Nothings Confectionery"
        className="field"
        aria-describedby={state.error ? "name-error" : undefined}
      />
      {state.error && (
        <p id="name-error" role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Setting up…" : "Continue"}
      </button>
    </form>
  );
}
