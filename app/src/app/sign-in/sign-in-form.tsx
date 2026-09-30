"use client";

import { useActionState } from "react";
import { requestMagicLink, type SignInState } from "./actions";

const initial: SignInState = { status: "idle" };

export function SignInForm() {
  const [state, formAction, pending] = useActionState(requestMagicLink, initial);

  if (state.status === "sent") {
    return (
      <div role="status" className="card space-y-2 text-center">
        <h2 className="text-lg font-semibold">Check your email</h2>
        <p className="text-muted">
          We sent a sign-in link to <strong>{state.email}</strong>. Tap it on this
          device or any other. It works once and expires soon.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <label htmlFor="email" className="block text-sm font-medium">
        Email address
      </label>
      <input
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        placeholder="you@example.com"
        className="field"
        aria-describedby={state.status === "error" ? "email-error" : undefined}
      />
      {state.status === "error" && (
        <p id="email-error" role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
