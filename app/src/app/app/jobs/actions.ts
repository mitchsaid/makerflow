"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganisation } from "@/lib/auth/dal";
import { isJobStatus } from "@/lib/jobs";
import type { LineFormValues } from "@/lib/quotes";
import { parseJobLine, parseNewJob, type NewJobErrors, type NewJobValues } from "@/lib/jobs/new-job";
import { jobItemPhoto } from "@/lib/jobs/photos";
import { getProducts } from "@/lib/products/data";
import { forOrganisation } from "@/lib/scope";
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

export type NewJobResult = { status: "error"; errors?: NewJobErrors; message?: string };

/**
 * Makes a job by hand, without a quote. Checked again here (the screen checks too), then the customer is proven to be
 * the person's own with their own session before the server-only function writes anything.
 */
export async function createManualJob(values: NewJobValues): Promise<NewJobResult> {
  const { organisation, user } = await requireOrganisation();
  // Pictures come from the business's own products, never from what the browser sent.
  const products = forOrganisation(await getProducts(), organisation.id);
  const parsed = parseNewJob(values, (line) => jobItemPhoto(line, products));
  if (!parsed.ok) return { status: "error", errors: parsed.errors };
  const job = parsed.value;

  const supabase = await createClient();
  const { data: own } = await supabase
    .from("customers")
    .select("id")
    .eq("id", job.customerId)
    .eq("organisation_id", organisation.id)
    .is("archived_at", null)
    .maybeSingle();
  if (!own) return { status: "error", errors: { customerId: "That customer could not be found. Choose them again." } };

  const made = adminOrMessage();
  if (!made.admin) return { status: "error", message: made.message };
  const { data: jobId, error } = await made.admin.rpc("create_job", {
    p_org: organisation.id,
    p_actor: user.id,
    p_customer_id: job.customerId,
    p_fulfilment: job.fulfilment,
    p_delivery_address: job.deliveryAddress,
    p_needed_by: job.neededBy,
    p_note: job.note,
    // (Everything but the known fields is dropped by the database; here they are already only the known ones.)
    p_items: job.items,
  });
  if (error?.code === "22023") {
    return { status: "error", message: "Something in this job was not accepted. Check the customer and the items, then try again." };
  }
  if (error || typeof jobId !== "string") {
    console.error("could not create a job by hand:", error?.code, error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  revalidatePath("/app/jobs");
  redirect(`/app/jobs/${jobId}`);
}

/**
 * Records how much of an item is made (from none up to all of it, in thousandths). The first unit made starts a job
 * that had not started. Jobs that are Ready or later take no counts.
 */
export async function setItemMade(jobId: string, itemId: string, madeMilli: number): Promise<JobActionResult> {
  const { organisation, user } = await requireOrganisation();
  if (!UUID.test(jobId) || !UUID.test(itemId) || !Number.isSafeInteger(madeMilli)) return { status: "error", message: GENERIC_ERROR };

  const supabase = await createClient();
  const { data: own } = await supabase.from("job_items").select("id").eq("id", itemId).eq("job_id", jobId).eq("organisation_id", organisation.id).maybeSingle();
  if (!own) return { status: "error", message: "That job could not be found." };

  const made = adminOrMessage();
  if (!made.admin) return { status: "error", message: made.message };
  const { error } = await made.admin.rpc("set_job_item_made", {
    p_org: organisation.id,
    p_job_id: jobId,
    p_item_id: itemId,
    p_made_milli: madeMilli,
    p_actor: user.id,
  });
  if (error?.code === "55006") {
    return { status: "error", message: "This job has moved on, so its items can't be counted now. Refresh the page to see where it stands." };
  }
  if (error?.code === "22023") {
    return { status: "error", message: "That is more than was ordered. Enter a number from none up to all of the item." };
  }
  if (error?.code === "P0002") {
    return { status: "error", message: "That item could not be found. Refresh the page to see where the job stands." };
  }
  if (error) {
    console.error("could not count what is made:", error.code, error.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  revalidatePath("/app/jobs");
  revalidatePath(`/app/jobs/${jobId}`);
  return { status: "done" };
}

export type AddJobItemResult = { status: "error"; message: string };

/**
 * Adds one item to a job that exists, checked the way a job's items are when it is made. Its picture comes from the
 * business's own products, never from what the browser sent. Ends by opening the job.
 */
export async function addJobItem(jobId: string, line: LineFormValues): Promise<AddJobItemResult> {
  const { organisation, user } = await requireOrganisation();
  if (!UUID.test(jobId)) return { status: "error", message: "That job could not be found." };

  const products = forOrganisation(await getProducts(), organisation.id);
  const parsed = parseJobLine(line, (l) => jobItemPhoto(l, products));
  if (!parsed.ok) return { status: "error", message: parsed.error };

  const supabase = await createClient();
  const { data: own } = await supabase.from("jobs").select("id").eq("id", jobId).eq("organisation_id", organisation.id).maybeSingle();
  if (!own) return { status: "error", message: "That job could not be found." };

  const made = adminOrMessage();
  if (!made.admin) return { status: "error", message: made.message };
  const { error } = await made.admin.rpc("add_job_item", {
    p_org: organisation.id,
    p_job_id: jobId,
    p_actor: user.id,
    p_item: parsed.value,
  });
  if (error?.code === "55006") {
    return { status: "error", message: "This job has moved on, so it can't take new items now. Refresh the page to see where it stands." };
  }
  if (error?.code === "54000") {
    return { status: "error", message: "A job can have up to 50 items. Start another job for the rest." };
  }
  if (error?.code === "22023" || error?.code === "23503") {
    return { status: "error", message: "Something in this item was not accepted. Check it, then try again." };
  }
  if (error?.code === "P0002") {
    return { status: "error", message: "That job could not be found." };
  }
  if (error) {
    console.error("could not add an item to a job:", error.code, error.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  revalidatePath("/app/jobs");
  revalidatePath(`/app/jobs/${jobId}`);
  redirect(`/app/jobs/${jobId}`);
}
