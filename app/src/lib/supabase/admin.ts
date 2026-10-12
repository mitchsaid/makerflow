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

/** What a person sees when this site has not been given its server key. It says what is missing and who can fix it. */
export const SERVER_KEY_MISSING_MESSAGE =
  "MakerFlow's server key isn't set on this site yet, so nothing was changed. Whoever runs the site needs to add SUPABASE_SECRET_KEY (the steps are in docs/runbooks/server-secret-key.md).";

/**
 * The server's own database access, or the message to show when this site has no server key (also logged, with what
 * was being attempted). Every action that changes state through a server-only database function starts here.
 */
export function adminOrMessage(attempt: string): { admin: ReturnType<typeof createAdminClient>; message?: undefined } | { admin?: undefined; message: string } {
  try {
    return { admin: createAdminClient() };
  } catch (error) {
    console.error(`the server key is missing, so ${attempt} could not run:`, (error as Error).message);
    return { message: SERVER_KEY_MISSING_MESSAGE };
  }
}
