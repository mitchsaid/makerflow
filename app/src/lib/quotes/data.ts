import "server-only";
import type { BalanceDue, DepositKind } from "./deposit";
import { notFound } from "next/navigation";
import { createClient } from "../supabase/server";
import type { VatStatus } from "../money";
import type { DiscountKind, LineOption } from "./index";
import type { Customer, CustomerKind } from "../customers";
import { isStarterKey, type StarterKey } from "./themes";
import type { QuoteEventKind } from "./outcome";
import type { QuoteSnapshot } from "./snapshot";

/**
 * Quote reads. Row-level security limits every query to businesses the signed-in person
 * belongs to; the pages keep only the current business's rows (see customers/data.ts for why
 * this is done after the queries rather than inside them).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type QuoteSummary = {
  id: string;
  organisationId: string;
  number: string;
  version: number;
  status: string;
  customerName: string | null;
  issueDate: string;
  validUntil: string;
  grossCents: number;
  currencyCode: string;
  updatedAt: string;
};

type SummaryRow = {
  id: string;
  organisation_id: string;
  number: string;
  version: number;
  status: string;
  issue_date: string;
  valid_until: string;
  gross_cents: number;
  currency_code: string;
  updated_at: string;
  customers: { name: string } | { name: string }[] | null;
};

/** Every quote of the business, newest changes first. One query. */
export async function getQuotes(): Promise<QuoteSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select(
      "id, organisation_id, number, version, status, issue_date, valid_until, gross_cents, currency_code, updated_at, customers(name)",
    )
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`Could not load quotes: ${error.message}`);
  return (data as unknown as SummaryRow[]).map((row) => {
    const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
    return {
      id: row.id,
      organisationId: row.organisation_id,
      number: row.number,
      version: row.version,
      status: row.status,
      customerName: customer?.name ?? null,
      issueDate: row.issue_date,
      validUntil: row.valid_until,
      grossCents: Number(row.gross_cents),
      currencyCode: row.currency_code,
      updatedAt: row.updated_at,
    };
  });
}

type LineRow = {
  id: string;
  sort_order: number;
  kind: string;
  product_id: string | null;
  name: string;
  description: string | null;
  quantity_milli: number;
  unit: string | null;
  unit_price_cents: number;
  discount_kind: DiscountKind;
  discount_value: number;
  vat_status: VatStatus;
  variation_id: string | null;
  variation_label: string | null;
  variation_name: string | null;
  options: unknown;
};

type VersionRow = {
  version: number;
  sent_at: string;
  sent_via: "shared" | "marked";
  snapshot: QuoteSnapshot;
};

type EventRow = {
  id: string;
  kind: QuoteEventKind;
  version: number;
  via: "shared" | "marked" | null;
  on_date: string | null;
  how: string | null;
  note: string | null;
  has_base: boolean;
  created_at: string;
};

type CustomerRow = {
  id: string;
  organisation_id: string;
  name: string;
  kind: CustomerKind;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  archived_at: string | null;
  address_line1: string | null;
  address_line2: string | null;
  region: string | null;
  postal_code: string | null;
  delivery_address: string | null;
  vat_number: string | null;
  company_registration_number: string | null;
  notes: string | null;
};

type QuoteRow = {
  id: string;
  organisation_id: string;
  number: string;
  version: number;
  updated_at: string;
  customer_id: string | null;
  status: string;
  issue_date: string;
  valid_until: string;
  needed_by: string | null;
  delivery_address: string | null;
  quote_discount_kind: DiscountKind;
  quote_discount_value: number;
  notes: string | null;
  title: string | null;
  description: string | null;
  sign_off: string | null;
  payment_instructions: string | null;
  show_bank_details: boolean;
  show_photos: boolean;
  theme_id: string | null;
  theme_starter: string | null;
  deposit_kind: DepositKind;
  deposit_value: number | string;
  balance_due: BalanceDue;
  balance_due_date: string | null;
  policies: unknown;
  customers: CustomerRow | CustomerRow[] | null;
  quote_lines: LineRow[];
  quote_versions: VersionRow[];
  quote_events: EventRow[];
};

/** A stored quote with its lines, as numbers. Turn it into form text with toFormValues(). */
export type StoredQuote = {
  id: string;
  organisationId: string;
  /** "QT-0042": given when the draft was first saved; a revision keeps it. */
  number: string;
  /** The version being edited (a draft) or the latest sent. 1 until the quote is revised. */
  version: number;
  /** When the draft was last saved; sending refuses a draft that changed after this. */
  updatedAt: string;
  status: string;
  customerId: string | null;
  issueDate: string;
  validUntil: string;
  neededBy: string | null;
  /** Where a delivery goes (this quote's own copy), or null. */
  deliveryAddress: string | null;
  discountKind: DiscountKind;
  discountValue: number;
  notes: string | null;
  title: string | null;
  description: string | null;
  signOff: string | null;
  paymentInstructions: string | null;
  /** Show the business's bank details on this quote. */
  showBankDetails: boolean;
  /** Show each product's photo beside its item. */
  showPhotos: boolean;
  /** This quote's own theme: one of the business's (an id) or a starter; neither means it follows the business's default. */
  themeId: string | null;
  themeStarter: StarterKey | null;
  /** The deposit terms (basis points or cents) and when the balance is due. */
  depositKind: DepositKind;
  depositValue: number;
  balanceDue: BalanceDue;
  balanceDueDate: string | null;
  /** The quote's terms: its own copy of each library term, and terms written just for it (no policyId). */
  policies: { policyId: string | null; title: string | null; body: string }[];
  lines: {
    id: string;
    sortOrder: number;
    kind: string;
    productId: string | null;
    name: string;
    description: string | null;
    quantityMilli: number;
    unit: string | null;
    unitPriceCents: number;
    discountKind: DiscountKind;
    discountValue: number;
    vatStatus: VatStatus;
    variationId: string | null;
    variationLabel: string | null;
    variationName: string | null;
    options: LineOption[];
  }[];
  /** The customer as they are now (a draft shows live details; a sent version has its own copy). */
  customer: Customer | null;
  /** Every time it was sent, newest first, with the frozen document. */
  versions: { version: number; sentAt: string; sentVia: "shared" | "marked"; snapshot: QuoteSnapshot }[];
  /**
   * A draft that is a revision of a sent quote can go back to the version that was sent, when the copy
   * kept at the start of the revision exists (revisions begun before it was kept cannot).
   */
  canDiscardRevision: boolean;
  /** The activity log, oldest first. */
  events: {
    id: string;
    kind: QuoteEventKind;
    version: number;
    via: "shared" | "marked" | null;
    /** For an answer from the customer: the day, and how they said it. */
    on: string | null;
    how: string | null;
    note: string | null;
    at: string;
  }[];
};

/** An item's options as stored (snake_case JSON), as the form holds them; anything unreadable is left out. */
function storedOptions(value: unknown): LineOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((o): LineOption[] => {
    if (typeof o !== "object" || o === null) return [];
    const r = o as Record<string, unknown>;
    const kind = r.kind === "one" || r.kind === "any" || r.kind === "text" ? r.kind : null;
    // Every option's amount is added to each item (a stored "charge" from before is ignored).
    const amount = Number(r.amount_cents);
    if (!kind || typeof r.group !== "string" || !Number.isSafeInteger(amount)) return [];
    return [
      {
        groupId: typeof r.group_id === "string" ? r.group_id : "",
        group: r.group,
        kind,
        valueId: typeof r.value_id === "string" ? r.value_id : "",
        value: typeof r.value === "string" ? r.value : "",
        text: typeof r.text === "string" ? r.text : "",
        amountCents: amount,
      },
    ];
  });
}

/** The quote's own terms as stored (a list), ignoring anything that isn't one. */
function storedPolicies(value: unknown): StoredQuote["policies"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const x = item as Record<string, unknown> | null;
    if (!x || (typeof x.title !== "string" && x.title !== null && x.title !== undefined) || typeof x.body !== "string") return [];
    return [
      {
        policyId: typeof x.policy_id === "string" ? x.policy_id : null,
        title: typeof x.title === "string" ? x.title : null,
        body: x.body,
      },
    ];
  });
}

/** One quote with its lines, or null for a bad id or one this person can't see. */
export async function findStoredQuote(id: string): Promise<StoredQuote | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select(
      `id, organisation_id, number, version, updated_at, customer_id, status, issue_date,
       valid_until, needed_by, delivery_address, quote_discount_kind, quote_discount_value, notes,
       title, description, sign_off, payment_instructions, show_bank_details, show_photos, theme_id, theme_starter,
       deposit_kind, deposit_value, balance_due, balance_due_date, policies,
       quote_lines (
         id, sort_order, kind, product_id, name, description, quantity_milli, unit, unit_price_cents,
         discount_kind, discount_value, vat_status, variation_id, variation_label, variation_name, options
       ),
       customers (
         id, organisation_id, name, kind, contact_person, phone, email, city, archived_at,
         address_line1, address_line2, region, postal_code, delivery_address,
         vat_number, company_registration_number, notes
       ),
       quote_versions ( version, sent_at, sent_via, snapshot ),
       quote_events ( id, kind, version, via, on_date, how, note, has_base, created_at )`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load the quote: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as QuoteRow;
  return {
    id: row.id,
    organisationId: row.organisation_id,
    number: row.number,
    version: row.version,
    updatedAt: row.updated_at,
    status: row.status,
    customerId: row.customer_id,
    issueDate: row.issue_date,
    validUntil: row.valid_until,
    neededBy: row.needed_by,
    deliveryAddress: row.delivery_address,
    discountKind: row.quote_discount_kind,
    discountValue: Number(row.quote_discount_value),
    notes: row.notes,
    title: row.title,
    description: row.description,
    signOff: row.sign_off,
    paymentInstructions: row.payment_instructions,
    showBankDetails: row.show_bank_details,
    showPhotos: row.show_photos,
    themeId: row.theme_id,
    themeStarter: isStarterKey(row.theme_starter) ? row.theme_starter : null,
    depositKind: row.deposit_kind,
    depositValue: Number(row.deposit_value),
    balanceDue: row.balance_due,
    balanceDueDate: row.balance_due_date,
    policies: storedPolicies(row.policies),
    lines: row.quote_lines.map((l) => ({
      id: l.id,
      sortOrder: l.sort_order,
      kind: l.kind,
      productId: l.product_id,
      name: l.name,
      description: l.description,
      quantityMilli: Number(l.quantity_milli),
      unit: l.unit,
      unitPriceCents: Number(l.unit_price_cents),
      discountKind: l.discount_kind,
      discountValue: Number(l.discount_value),
      vatStatus: l.vat_status,
      variationId: l.variation_id,
      variationLabel: l.variation_label,
      variationName: l.variation_name,
      options: storedOptions(l.options),
    })),
    customer: (() => {
      const c = Array.isArray(row.customers) ? row.customers[0] : row.customers;
      return c
        ? {
            id: c.id,
            organisationId: c.organisation_id,
            name: c.name,
            kind: c.kind,
            contactPerson: c.contact_person,
            phone: c.phone,
            email: c.email,
            addressLine1: c.address_line1,
            addressLine2: c.address_line2,
            city: c.city,
            region: c.region,
            postalCode: c.postal_code,
            deliveryAddress: c.delivery_address,
            vatNumber: c.vat_number,
            companyRegistrationNumber: c.company_registration_number,
            notes: c.notes,
            archived: c.archived_at !== null,
          }
        : null;
    })(),
    versions: [...row.quote_versions]
      .sort((a, b) => b.version - a.version)
      .map((v) => ({ version: v.version, sentAt: v.sent_at, sentVia: v.sent_via, snapshot: v.snapshot })),
    canDiscardRevision:
      row.status === "draft" &&
      row.version > 1 &&
      // The latest "revised" entry of this version (a version can be started again after a discard).
      [...row.quote_events]
        .filter((e) => e.kind === "revised" && e.version === row.version)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.has_base === true &&
      row.quote_versions.some((v) => v.version === row.version - 1),
    events: [...row.quote_events]
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.version - b.version)
      .map((e) => ({ id: e.id, kind: e.kind, version: e.version, via: e.via, on: e.on_date, how: e.how, note: e.note, at: e.created_at })),
  };
}

/** One quote with its lines. Shows the "not found" page for a bad or foreign id. */
export async function getStoredQuote(id: string): Promise<StoredQuote> {
  const quote = await findStoredQuote(id);
  if (!quote) notFound();
  return quote;
}
