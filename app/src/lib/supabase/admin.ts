import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

/**
 * A Supabase client that acts as the SERVER, not as a signed-in person (the secret key: it
 * skips row-level security). Use it ONLY for the few database functions that are callable by
 * the server alone (send_quote, revise_quote), and only after the person's own session has
 * proved they may do the thing. Never import this from a client component, never pass its
 * results through unchecked, and never log the key. `server-only` makes the build fail if a
 * browser bundle ever pulls it in.
 */
export function createAdminClient() {
  const { url } = supabaseEnv();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY. Sending quotes needs it on the server (see docs/runbooks/server-secret-key.md).",
    );
  }
  return createSupabaseClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
