import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "../supabase/server";
import { isJobStatus, type JobDetail, type JobFulfilment, type JobOption, type JobStatus, type JobSummary } from "./index";

/**
 * Job reads. Row-level security limits every query to businesses the signed-in person belongs to; pages keep only the
 * current business's rows (see lib/scope.ts).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ItemRow = { name: string; quantity_milli: number | string; unit: string | null; sort_order: number };
type SummaryRow = {
  id: string;
  organisation_id: string;
  number: number;
  status: string;
  fulfilment: JobFulfilment;
  needed_by: string | null;
  customer_name: string;
  created_at: string;
  job_items: ItemRow[] | null;
};

const status = (value: string): JobStatus => (isJobStatus(value) ? value : "not_started");

function summary(row: SummaryRow): JobSummary {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    number: row.number,
    status: status(row.status),
    fulfilment: row.fulfilment,
    neededBy: row.needed_by,
    customerName: row.customer_name,
    items: [...(row.job_items ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({ name: i.name, quantityMilli: Number(i.quantity_milli), unit: i.unit })),
    createdAt: row.created_at,
  };
}

/** Every job of the business, with its items' names. One query. */
export async function getJobs(): Promise<JobSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("id, organisation_id, number, status, fulfilment, needed_by, customer_name, created_at, job_items ( name, quantity_milli, unit, sort_order )")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`Could not load jobs: ${error.message}`);
  return (data as unknown as SummaryRow[]).map(summary);
}

type DetailRow = SummaryRow & {
  quote_id: string;
  quote_version: number;
  delivery_address: string | null;
  customer_id: string | null;
  customer_contact_person: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  note: string | null;
  quotes: { number: string } | { number: string }[] | null;
  job_items:
    | (ItemRow & {
        description: string | null;
        variation_label: string | null;
        variation_name: string | null;
        options: unknown;
        photo_image_id: string | null;
      })[]
    | null;
  job_events: { kind: "created" | "status"; from_status: string | null; to_status: string; created_at: string }[] | null;
};

const COLUMNS = `id, organisation_id, number, status, fulfilment, needed_by, customer_name, created_at, quote_id, quote_version,
  delivery_address, customer_id, customer_contact_person, customer_phone, customer_email, note,
  quotes ( number ),
  job_items ( name, description, quantity_milli, unit, sort_order, variation_label, variation_name, options, photo_image_id ),
  job_events ( kind, from_status, to_status, created_at )`;

function options(value: unknown): JobOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((o) => {
    if (typeof o !== "object" || o === null) return [];
    const r = o as Record<string, unknown>;
    return [
      {
        group: typeof r.group === "string" ? r.group : "",
        kind: typeof r.kind === "string" ? r.kind : "one",
        value: typeof r.value === "string" ? r.value : null,
        text: typeof r.text === "string" ? r.text : null,
        quantityMilli: typeof r.quantityMilli === "number" ? r.quantityMilli : null,
      },
    ];
  });
}

function detail(row: DetailRow): JobDetail {
  const quote = Array.isArray(row.quotes) ? row.quotes[0] : row.quotes;
  const items = [...(row.job_items ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  return {
    ...summary(row),
    quoteId: row.quote_id,
    quoteNumber: quote?.number ?? "",
    quoteVersion: row.quote_version,
    deliveryAddress: row.delivery_address,
    customerId: row.customer_id,
    customerContactPerson: row.customer_contact_person,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    note: row.note,
    fullItems: items.map((i) => ({
      name: i.name,
      description: i.description,
      quantityMilli: Number(i.quantity_milli),
      unit: i.unit,
      variationLabel: i.variation_label,
      variationName: i.variation_name,
      options: options(i.options),
      photoImageId: i.photo_image_id,
    })),
    events: [...(row.job_events ?? [])]
      .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.kind === "created" ? -1 : 1))
      .map((e) => ({
        kind: e.kind,
        fromStatus: e.from_status && isJobStatus(e.from_status) ? e.from_status : null,
        toStatus: status(e.to_status),
        createdAt: e.created_at,
      })),
  };
}

/** One job, or null for a bad id or one this person cannot see. */
export async function findJob(id: string): Promise<JobDetail | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("jobs").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load the job: ${error.message}`);
  return data ? detail(data as unknown as DetailRow) : null;
}

/** One job. Shows the "not found" page for a bad or foreign id. */
export async function getJob(id: string): Promise<JobDetail> {
  const job = await findJob(id);
  if (!job) notFound();
  return job;
}
