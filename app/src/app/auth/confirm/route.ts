import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validation";

/**
 * Magic-link landing. The email link carries a one-time token that is verified
 * here on the server, so it works even if the link is opened in a different
 * browser than the one that asked for it (common on phones).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNextPath(searchParams.get("next"));

  // New users receive a "signup" confirmation email and returning users a "email"
  // (magic link) one. Both carry the same kind of one-time token.
  if (tokenHash && (type === "email" || type === "signup")) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) redirect(next);
  }

  redirect("/sign-in?error=link");
}
