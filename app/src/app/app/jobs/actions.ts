"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganisation } from "@/lib/auth/dal";
import { isJobStatus } from "@/lib/jobs";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Making a job from an accepted quote, and moving it along. Like sending and recording an answer, these changes run
 * ONLY here, on the server: the database functions can be called by the server's own key and nobody else (migration
 * 20261028100000_jobs.sql). The person's own session proves the quote or job is theirs first.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC_ERROR = "Something went wrong. Please try again.";
const NOT_SET_UP = "This version of MakerFlow can't do that yet, so nothing was changed. We've been told.";

export type JobActionResult = { status: "done" } | { status: "error"; message: string };

function adminOrMessage() {
  try {
    return { admin: createAdminClient() };
  } catch (error) {
    console.error("the server key for jobs is missing:", (error as Error).message);
    return { message: NOT_SET_UP };
  }
}

/** Makes a job from an accepted quote and opens it. */
export async function createJob(quoteId: string): Promise<JobActionResult> {
  const { organisation, user } = await requireOrganisation();
  if (!UUID.test(quoteId)) return { status: "error", message: "That quote could not be found." };

  const supabase = await createClient();
  const { data: own } = await supabase.from("quotes").select("id").eq("id", quoteId).eq("organisation_id", organisation.id).maybeSingle();
  if (!own) return { status: "error", message: "That quote could not be found." };

  const made = adminOrMessage();
  if (!made.admin) return { status: "error", message: made.message };
  const { data: jobId, error } = await made.admin.rpc("create_job_from_quote", {
    p_org: organisation.id,
    p_quote_id: quoteId,
    p_actor: user.id,
  });
  if (error?.code === "23505") {
    return { status: "error", message: "This quote already has a job. Refresh the page to see it." };
  }
  if (error?.code === "P0002") {
    return { status: "error", message: "This quote has changed since you opened it, and can't become a job now. Refresh the page to see where it stands." };
  }
  if (error?.code === "22023") {
    return { status: "error", message: "This quote has no customer, so it can't become a job." };
  }
  if (error || typeof jobId !== "string") {
    console.error("could not create job:", error?.code, error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  revalidatePath("/app/jobs");
  revalidatePath(`/app/quotes/${quoteId}`);
  redirect(`/app/jobs/${jobId}`);
}

/** Moves a job to another status, if that move is allowed. */
export async function moveJob(jobId: string, to: string): Promise<JobActionResult> {
  const { organisation, user } = await requireOrganisation();
  if (!UUID.test(jobId) || !isJobStatus(to)) return { status: "error", message: GENERIC_ERROR };

  const supabase = await createClient();
  const { data: own } = await supabase.from("jobs").select("id").eq("id", jobId).eq("organisation_id", organisation.id).maybeSingle();
  if (!own) return { status: "error", message: "That job could not be found." };

  const made = adminOrMessage();
  if (!made.admin) return { status: "error", message: made.message };
  const { error } = await made.admin.rpc("move_job_status", { p_org: organisation.id, p_job_id: jobId, p_actor: user.id, p_to: to });
  if (error?.code === "P0002") {
    return { status: "error", message: "This job, or its quote, has changed since you opened it, so that move isn't possible now. Refresh the page to see where it stands." };
  }
  if (error?.code === "23505") {
    return { status: "error", message: "This quote has another job now, so this one can't be restored." };
  }
  if (error) {
    console.error("could not move job:", error.code, error.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  revalidatePath("/app/jobs");
  revalidatePath(`/app/jobs/${jobId}`);
  return { status: "done" };
}

export type JobNoteState = { status: "idle" } | { status: "saved" } | { status: "error"; message: string };

/** Saves the maker's own note on a job (empty clears it). */
export async function saveJobNote(jobId: string, note: string): Promise<JobNoteState> {
  const { organisation } = await requireOrganisation();
  if (!UUID.test(jobId)) return { status: "error", message: GENERIC_ERROR };
  const text = note.trim();
  if (text.length > 2000) return { status: "error", message: "Keep the note to 2000 characters or fewer." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .update({ note: text === "" ? null : text })
    .eq("id", jobId)
    .eq("organisation_id", organisation.id)
    .select("id");
  if (error || !data || data.length !== 1) {
    console.error("could not save the job note:", error?.code, error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath(`/app/jobs/${jobId}`);
  return { status: "saved" };
}
