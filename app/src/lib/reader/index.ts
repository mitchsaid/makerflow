import { optionalChoice, optionalText, optionalValidated } from "../form-values";
import type { LocalePack } from "../locale";
import { parseMoney, type Cents } from "../money";
import { PRODUCT_NAME_MAX } from "../products";
import { validateBusinessName, validateEmail, validatePhone } from "../validation";

/**
 * Reading a business's own quote or invoice to fill in the business details (docs/plans/import-onboarding.md, slice
 * 2). The model's answer is untrusted text: it is cut down to a fixed shape here, each value is kept only if the
 * same checks the Business profile form applies accept it, and nothing in it can do anything but fill in a form the
 * maker then checks and saves. Money is read with `parseMoney`, to whole cents.
 */

/** The biggest document taken: a Vercel function accepts 4.5 MB, and a phone photo is shrunk in the browser first. */
export const READER_MAX_BYTES = 4_000_000;
/** Where the list of found items waits for the product import's paste box (this tab only; cleared once read). */
export const FOUND_LIST_KEY = "makerflow:found-products";
/** The most items taken from one document. */
export const READER_MAX_ITEMS = 50;

export type ReaderMediaType = "application/pdf" | "image/png" | "image/jpeg" | "image/webp";

/** What kind of file this really is, from its first bytes (a name or a declared type is not trusted). Null for anything else. */
export function detectMediaType(bytes: Uint8Array): ReaderMediaType | null {
  const startsWith = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (startsWith(0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf"; // %PDF-
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (startsWith(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (startsWith(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp"; // RIFF....WEBP
  return null;
}

/** What was found about the business, in the Business profile form's own field names. Only fields that were found and pass the form's checks are present. */
export type FoundBusiness = Partial<{
  ownerName: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  vatRegistered: boolean;
  vatNumber: string;
}>;

export type FoundItem = { name: string; priceCents: Cents };

export type Reading = {
  /** The business name as the document has it. It is shown to be checked; the business's own name is never overwritten. */
  businessName: string | null;
  business: FoundBusiness;
  items: FoundItem[];
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): string => (typeof v === "string" ? v : "");

/** Cuts the model's answer down to a Reading. Anything that is not the expected shape, or that the form's checks refuse, is left out. */
export function sanitiseReading(raw: unknown, locale: LocalePack): Reading {
  const input = isRecord(raw) ? raw : {};
  const b = isRecord(input.business) ? input.business : {};
  const business: FoundBusiness = {};

  const keep = <K extends keyof FoundBusiness>(key: K, value: FoundBusiness[K] | null | undefined) => {
    if (value !== null && value !== undefined && value !== "") business[key] = value;
  };
  const ok = <T>(r: { ok: true; value: T } | { ok: false }): T | null => (r.ok ? r.value : null);

  keep("ownerName", ok(optionalText(text(b.ownerName), 120, "Name")) as string | null);
  keep("phone", ok(optionalValidated(text(b.phone), validatePhone)) as string | null);
  keep("email", ok(optionalValidated(text(b.email), validateEmail)) as string | null);
  keep("addressLine1", ok(optionalText(text(b.addressLine1), 120, "Address")) as string | null);
  keep("addressLine2", ok(optionalText(text(b.addressLine2), 120, "Address")) as string | null);
  keep("city", ok(optionalText(text(b.city), 80, "City")) as string | null);
  // The province must be one of the country's own, matched without regard to case; "Gauteng" yes, "somewhere" no.
  const regionText = text(b.region).trim().toLowerCase();
  const region = locale.address.regions.find((r) => r.toLowerCase() === regionText);
  if (region) keep("region", ok(optionalChoice(region, locale.address.regions, "")) as string | null);
  keep("postalCode", ok(optionalValidated(text(b.postalCode), locale.address.validatePostalCode)) as string | null);

  // A VAT number that fails the country's check is not offered: a wrong one on a quote is worse than an empty field.
  const vat = locale.tax.validateRegistrationNumber(text(b.vatNumber));
  if (vat.ok) {
    business.vatRegistered = true;
    business.vatNumber = vat.value;
  }

  const name = validateBusinessName(text(b.name));

  const rows = Array.isArray(input.items) ? input.items : [];
  const seen = new Set<string>();
  const items: FoundItem[] = [];
  for (const row of rows) {
    if (items.length >= READER_MAX_ITEMS) break;
    if (!isRecord(row)) continue;
    const itemName = text(row.name).trim().replace(/\s+/g, " ");
    if (itemName === "" || itemName.length > PRODUCT_NAME_MAX) continue;
    const price = parseMoney(text(row.unitPrice).replace(/^[A-Za-z]{0,3}\s*(?=\d)/, "").replace(/[^\d.,\s]/g, ""));
    if (!price.ok) continue;
    const key = itemName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ name: itemName, priceCents: price.value });
  }
  return { businessName: name.ok ? name.value : null, business, items };
}

/** The found items as a tab-separated list with headings, ready for the product import's paste box. */
export function itemsAsList(items: readonly FoundItem[]): string {
  const price = (cents: Cents) => `${Math.trunc(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
  return ["Name\tPrice", ...items.map((i) => `${i.name.replace(/[\t\r\n]+/g, " ")}\t${price(i.priceCents)}`)].join("\n");
}

/** Whether the reader is switched on: it is off until a key is set, like Google sign-in. */
export function readerEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return typeof env.ANTHROPIC_API_KEY === "string" && env.ANTHROPIC_API_KEY.trim() !== "";
}

/**
 * What the Business profile form starts with after a read: what was found fills in only what is still empty, and
 * never the business's name or what the maker already saved. Ticking VAT registered comes with the VAT number found.
 */
export function applyFound<T extends { [K in keyof FoundBusiness]-?: unknown }>(initial: T, found: FoundBusiness): T {
  const next: Record<string, unknown> = { ...initial };
  for (const [key, value] of Object.entries(found)) {
    if (key === "vatRegistered" || key === "vatNumber") continue;
    if (value !== undefined && (next[key] === "" || next[key] === undefined)) next[key] = value;
  }
  if (found.vatNumber && !initial.vatRegistered && (initial.vatNumber === "" || initial.vatNumber === undefined)) {
    next.vatRegistered = true;
    next.vatNumber = found.vatNumber;
  }
  return next as T;
}
