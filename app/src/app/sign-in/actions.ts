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
    options: { shouldCreateUser: true },
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

export async function signInWithGoogle() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    // Supabase only honours this if it is on the project's allowed redirect list.
    options: { redirectTo: `${protocol}://${host}/auth/callback` },
  });

  if (error || !data.url) {
    console.error("google sign-in failed:", error?.message);
    redirect("/sign-in?error=oauth");
  }
  redirect(data.url);
}
