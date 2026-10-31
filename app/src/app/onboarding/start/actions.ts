"use server";

import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { getLocalePack } from "@/lib/locale";
import { detectMediaType, READER_MAX_BYTES, readerEnabled, sanitiseReading, type Reading } from "@/lib/reader";
import { DEFAULT_READER_MODEL, ReaderError, readDocument } from "@/lib/reader/provider";
import { createClient } from "@/lib/supabase/server";

export type ReadResult =
  | { status: "read"; reading: Reading }
  | { status: "error"; message: string };

const UNREADABLE = "We couldn't read details from that. Try a clearer photo, or fill in your details by hand.";

/**
 * Reads one quote or invoice to fill in the business details (docs/plans/import-onboarding.md, slice 2). The file is
 * checked by its own first bytes, counted (the database refuses more than a few an hour and a day, so a stuck button
 * cannot run up a bill), sent once to the AI service and forgotten: nothing about the document is stored or logged.
 * The answer only fills in a form the maker checks and saves, through the same save as any other change.
 */
export async function readBusinessDocument(formData: FormData): Promise<ReadResult> {
  const { organisation, role, profile, user, demo } = await requireOrganisation();
  // A demo never calls the paid service (docs/plans/demo-accounts.md).
  if (demo) return { status: "error", message: "Reading a document isn't part of the demo. Sign up to try it with your own quote." };
  if (!canEditBusinessProfile(role)) return { status: "error", message: "Only owners and admins can fill in the business details." };
  if (!readerEnabled()) return { status: "error", message: "Reading a document isn't switched on yet. You can fill in your details by hand." };

  const file = formData.get("document");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Choose a quote or invoice first: a PDF, or a photo or screenshot of it." };
  if (file.size > READER_MAX_BYTES) return { status: "error", message: "That file is too big. Send a photo or screenshot of it instead, or a PDF under 4 MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mediaType = detectMediaType(bytes);
  if (!mediaType) return { status: "error", message: "We can read a PDF, or a photo or screenshot (JPG, PNG or WebP). Try one of those." };

  // Counted before the read, so a failed read still counts: the limit is on spending, not on success.
  const supabase = await createClient();
  const { error: limit } = await supabase.from("document_reads").insert({ organisation_id: organisation.id, user_id: user.id });
  if (limit?.code === "54000") {
    return { status: "error", message: "You've reached the limit for reading documents for now (a few an hour, 20 a day). Try again later, or fill in your details by hand." };
  }
  if (limit) {
    console.error("could not count a document read:", limit.code);
    return { status: "error", message: "Something went wrong. Please try again, or fill in your details by hand." };
  }

  try {
    const raw = await readDocument(
      { bytes, mediaType },
      {
        apiKey: process.env.ANTHROPIC_API_KEY!,
        model: process.env.READER_MODEL?.trim() || DEFAULT_READER_MODEL,
        baseUrl: process.env.ANTHROPIC_BASE_URL?.trim() || undefined,
      },
    );
    const reading = sanitiseReading(raw, getLocalePack(profile.countryCode));
    if (Object.keys(reading.business).length === 0 && reading.items.length === 0) {
      return { status: "error", message: "We couldn't find any business details on that. Try the first page of a quote or invoice, or fill in your details by hand." };
    }
    return { status: "read", reading };
  } catch (error) {
    // Only why it failed is logged: never the document or what the service said about it.
    console.error("document read failed:", error instanceof ReaderError ? error.reason : "unexpected");
    if (error instanceof ReaderError && error.reason === "busy") return { status: "error", message: "The reader is busy right now. Try again in a minute, or fill in your details by hand." };
    if (error instanceof ReaderError && error.reason === "timeout") return { status: "error", message: "That took too long. Try a smaller file or a photo of the first page." };
    return { status: "error", message: UNREADABLE };
  }
}
