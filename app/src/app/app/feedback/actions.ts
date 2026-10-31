"use server";

import { requireOrganisation } from "@/lib/auth/dal";
import { parseFeedback, type FeedbackErrors } from "@/lib/feedback";
import { createClient } from "@/lib/supabase/server";

export type FeedbackState = { status: "sent" } | { status: "error"; message?: string; errors?: FeedbackErrors };

/**
 * "Send feedback" (docs/plans/feedback-button.md). Any member can send it; it is kept for the people who run MakerFlow
 * and nobody reads it back through the app. The address to reply to is the person's own account address, and only when
 * they said we may.
 */
export async function sendFeedback(input: unknown): Promise<FeedbackState> {
  const { organisation, user } = await requireOrganisation();
  const parsed = parseFeedback(input);
  if (!parsed.ok) return { status: "error", errors: parsed.errors };
  const f = parsed.value;

  const supabase = await createClient();
  const { error } = await supabase.from("feedback").insert({
    organisation_id: organisation.id,
    user_id: user.id,
    kind: f.kind,
    message: f.message,
    page: f.page,
    user_agent: f.userAgent,
    viewport: f.viewport,
    contact_email: f.contact ? (user.email ?? null) : null,
  });
  if (error) {
    if (error.code === "54000") return { status: "error", message: "You've sent a lot in the last hour. Please try again a little later." };
    console.error("could not save feedback:", error.code, error.message);
    return { status: "error", message: "Something went wrong, so that wasn't sent. Please try again." };
  }
  return { status: "sent" };
}
