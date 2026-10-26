import type { BankLine } from "../bank";
import type { LocalePack, WayToPayKind } from "../locale";

/**
 * The ways a business is paid other than its one bank account (docs/plans/payment-methods.md): a payment link,
 * PayShap, pay on collection, something else. The kinds and their fields come from the country's locale pack; nothing
 * here knows what a payment link is. The bank account stays in lib/bank and prints first.
 */

/** A way to pay as stored: one row per way, per business. */
export type PaymentMethod = {
  id: string;
  kind: string;
  name: string;
  /** Field key (from the pack's kind) to value. */
  details: Record<string, string>;
  onNewQuotes: boolean;
  sortOrder: number;
  /** ISO timestamps: when it was added (the order they list in) and when it last changed. */
  createdAt: string;
  updatedAt: string;
};

/** The shape of a stored row, as read from the database. */
export type PaymentMethodRow = {
  id: string;
  kind: string;
  name: string;
  details: unknown;
  on_new_quotes: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

/** One way to pay as a sent document shows it: frozen with the document, so a later change never alters it. */
export type PaymentWaySnapshot = {
  id: string;
  kind: string;
  name: string;
  lines: BankLine[];
};

/** What a quote or invoice screen needs of a saved way to pay: its name and one line saying which. */
export type PaymentWayView = { id: string; name: string; summary: string };

/** The most ways to pay one business keeps (the database enforces it too). */
export const MAX_PAYMENT_METHODS = 20;
export const PAYMENT_NAME_MAX = 60;

export function wayToPayKind(
  kind: string,
  locale: LocalePack,
): WayToPayKind | null {
  return (
    locale.payment.waysToPay.find((k) => k.kind === kind && k.available) ?? null
  );
}

/**
 * Turns a stored row into a way to pay for this country. A kind this country does not offer (or one not built yet) is
 * left out: there is no falling back to another country's rules.
 */
export function paymentMethodFromRow(
  row: PaymentMethodRow,
  locale: LocalePack,
): PaymentMethod | null {
  const kind = wayToPayKind(row.kind, locale);
  if (!kind) return null;
  const raw = row.details;
  const details: Record<string, string> = {};
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    for (const field of kind.fields) {
      const value = (raw as Record<string, unknown>)[field.key];
      if (typeof value === "string" && value !== "") details[field.key] = value;
    }
  }
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    details,
    onNewQuotes: row.on_new_quotes === true,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Oldest first, as the maker added them (sort order, then when). */
export function sortPaymentMethods<
  T extends { sortOrder: number; createdAt: string; id: string },
>(methods: readonly T[]): T[] {
  return [...methods].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
}

export type PaymentMethodFormValues = {
  kind: string;
  name: string;
  fields: Record<string, string>;
  onNewQuotes: boolean;
};

export type PaymentMethodErrors = {
  kind?: string;
  name?: string;
  fields: Record<string, string>;
};

export type ParsedPaymentMethodForm =
  | {
      ok: true;
      kind: string;
      name: string;
      details: Record<string, string>;
      onNewQuotes: boolean;
    }
  | { ok: false; errors: PaymentMethodErrors };

/** Checks the form against the country's kind, saying how to fix each problem. */
export function parsePaymentMethodForm(
  values: PaymentMethodFormValues,
  locale: LocalePack,
): ParsedPaymentMethodForm {
  const errors: PaymentMethodErrors = { fields: {} };
  const kind =
    typeof values.kind === "string" ? wayToPayKind(values.kind, locale) : null;
  if (!kind)
    return {
      ok: false,
      errors: { kind: "Choose which way to pay this is.", fields: {} },
    };

  const name =
    typeof values.name === "string"
      ? values.name.trim().replace(/\s+/g, " ")
      : "";
  if (name === "")
    errors.name =
      "Give it a name the customer will recognise, like “Pay online”.";
  else if (name.length > PAYMENT_NAME_MAX)
    errors.name = `The name can be up to ${PAYMENT_NAME_MAX} characters.`;

  const details: Record<string, string> = {};
  for (const field of kind.fields) {
    const raw = values.fields?.[field.key];
    const typed = typeof raw === "string" ? raw.trim() : "";
    if (typed === "") {
      if (field.required)
        errors.fields[field.key] = `Enter the ${field.label.toLowerCase()}.`;
      continue;
    }
    const checked = field.validate(typed);
    if (checked.ok) details[field.key] = checked.value;
    else errors.fields[field.key] = checked.error;
  }
  if (errors.name || Object.keys(errors.fields).length > 0)
    return { ok: false, errors };
  return {
    ok: true,
    kind: kind.kind,
    name,
    details,
    onNewQuotes: values.onNewQuotes !== false,
  };
}

/** The lines a document prints for one way: one per field the business filled in, in the country's order. */
export function paymentMethodLines(
  method: PaymentMethod,
  locale: LocalePack,
): BankLine[] {
  const kind = wayToPayKind(method.kind, locale);
  if (!kind) return [];
  const lines: BankLine[] = [];
  for (const field of kind.fields) {
    const value = method.details[field.key];
    if (value) lines.push({ label: field.label, value });
  }
  return lines;
}

/** A short line for a screen: "Payment link · https://pay.example.com/x". */
export function paymentMethodSummary(
  method: PaymentMethod,
  locale: LocalePack,
): string {
  const kind = wayToPayKind(method.kind, locale);
  const first = kind?.fields.map((f) => method.details[f.key]).find((v) => !!v);
  return [kind?.label, first].filter(Boolean).join(" · ");
}

/** The ways a new quote or invoice starts with: the ones the maker keeps on new quotes. */
export function waysForNewQuote(
  methods: readonly PaymentMethod[],
): PaymentMethod[] {
  return sortPaymentMethods(methods.filter((m) => m.onNewQuotes));
}

/**
 * What a document freezes: every saved way except the ones the maker unticked on this quote (`hiddenIds`). Ways added
 * after the quote was started show on it unless unticked: only the unticked ones are remembered.
 */
export function paymentWaySnapshots(
  methods: readonly PaymentMethod[],
  hiddenIds: readonly string[],
  locale: LocalePack,
): PaymentWaySnapshot[] {
  return sortPaymentMethods(methods)
    .filter((m) => !hiddenIds.includes(m.id))
    .map((m) => ({
      id: m.id,
      kind: m.kind,
      name: m.name,
      lines: paymentMethodLines(m, locale),
    }));
}

/**
 * What an invoice prints: the current details of the ways the quote it came from showed (matched by id, so a change to
 * a way's details reaches the invoice as the bank details do), and the quote's own copy of a way that has since been
 * removed, so an invoice never loses a way the customer was told about.
 */
export function invoicePaymentWays(
  shown: readonly PaymentWaySnapshot[],
  current: readonly PaymentMethod[],
  locale: LocalePack,
): PaymentWaySnapshot[] {
  return shown.map((way) => {
    const now = current.find((m) => m.id === way.id);
    return now
      ? {
          id: now.id,
          kind: now.kind,
          name: now.name,
          lines: paymentMethodLines(now, locale),
        }
      : way;
  });
}

/** Owners only: changing where customers send money is how invoice fraud happens. */
export function canEditPaymentMethods(role: string | null): boolean {
  return role === "owner";
}

export function paymentWayView(method: PaymentMethod, locale: LocalePack): PaymentWayView {
  return { id: method.id, name: method.name, summary: paymentMethodSummary(method, locale) };
}
