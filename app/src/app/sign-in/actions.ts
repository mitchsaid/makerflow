"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateEmail } from "@/lib/validation";

export type SignInState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

/** Sends a sign-in link. Same response whether or not the email is already registered. */
export async function requestMagicLink(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = validateEmail(formData.get("email"));
  if (!email.ok) return { status: "error", message: email.error };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.value,
    options: {
      shouldCreateUser: true,
      // Used by Supabase's default email (a link that returns here with a one-time
      // code). Our own templates link to /auth/confirm instead and ignore this.
      // Supabase only honours it if it is on the project's allowed redirect list.
      emailRedirectTo: `${await siteOrigin()}/auth/callback`,
    },
  });

  if (error) {
    console.error("magic link request failed:", error.message);
    return {
      status: "error",
      message: "We couldn't send the link just now. Please try again in a minute.",
    };
  }
  return { status: "sent", email: email.value };
}

async function siteOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    // Supabase only honours this if it is on the project's allowed redirect list.
    options: { redirectTo: `${await siteOrigin()}/auth/callback` },
  });

  if (error || !data.url) {
    console.error("google sign-in failed:", error?.message);
    redirect("/sign-in?error=oauth");
  }
  redirect(data.url);
}
