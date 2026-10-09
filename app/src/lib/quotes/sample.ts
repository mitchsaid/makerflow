import type { Workspace } from "../auth/dal";
import { getLocalePack, vatSettingsFor } from "../locale";
import { moneyToInput } from "../money";
import type { ProductSummary } from "../products";
import { addDays, todayIn } from "./dates";
import { parseQuote, type QuoteFormValues } from "./index";
import { buildQuoteSnapshot, type QuoteSnapshot } from "./snapshot";

/** A stand-in product id for the sample's first item (never stored: the sample is never saved). */
const SAMPLE_PRODUCT = "00000000-0000-4000-8000-000000000001";

/** What a sample quote is made of when the business has no products to borrow. */
const GENERIC: { name: string; description: string; unitPrice: string; quantity: string }[] = [
  { name: "Made-to-order piece", description: "Made by hand to your size and colours", unitPrice: "1200", quantity: "1" },
  { name: "Set of small pieces", description: "A matching set, wrapped and ready to give", unitPrice: "180", quantity: "4" },
  { name: "Custom engraving", description: "Your words or initials", unitPrice: "150", quantity: "1" },
];

/**
 * A quote to show a theme on: the business's own details, logo and bank details, and its first products
 * (with their photos) as the items, or a few generic ones. Never saved or sent, and it says "SAMPLE" for
 * the customer and number so it can't be mistaken for a real one.
 */
export function sampleSnapshot(workspace: Workspace, products: readonly ProductSummary[]): QuoteSnapshot {
  try {
    return buildSample(workspace, products);
  } catch {
    // Borrowed products with prices too big to total: show the generic items instead.
    return buildSample(workspace, []);
  }
}

function buildSample(workspace: Workspace, products: readonly ProductSummary[]): QuoteSnapshot {
  const { organisation, profile } = workspace;
  const locale = getLocalePack(profile.countryCode);
  const vat = vatSettingsFor(profile, locale);
  const today = todayIn(locale.timeZone);

  // Products with a photo first, so layouts that show pictures have some to show.
  const borrowed = [...products.filter((p) => !p.archived && p.kind !== "service" && p.photoImageId), ...products.filter((p) => !p.archived && !p.photoImageId)].slice(0, 3);
  const items = [
    ...borrowed.map((p) => ({
      name: p.name,
      description: p.description ?? "",
      unitPrice: moneyToInput(p.unitPriceCents, locale.numberStyle),
      quantity: "1",
      photoImageId: p.photoImageId ?? null,
    })),
    ...GENERIC.slice(borrowed.length).map((g) => ({ ...g, photoImageId: null as string | null })),
  ];

  const values: QuoteFormValues = {
    customerId: "",
    issueDate: today,
    validUntil: addDays(today, 14),
    neededBy: "",
    lines: items.map((l, i) => ({
      key: `s${i}`,
      // The first item carries an extra (as if from a product), so a theme's way of showing extra prices shows.
      kind: i === 0 ? ("product" as const) : ("custom" as const),
      productId: i === 0 ? SAMPLE_PRODUCT : "",
      options:
        i === 0
          ? [
              { groupId: "", group: "Extras", kind: "any" as const, charge: "item" as const, valueId: "", value: "Hand finishing", text: "", amountCents: 5000 },
              { groupId: "", group: "Extras", kind: "any" as const, charge: "line" as const, valueId: "", value: "Gift wrap", text: "", amountCents: 2500 },
            ]
          : [],
      name: l.name,
      description: l.description,
      quantity: l.quantity,
      unit: "",
      unitPrice: l.unitPrice,
      discountKind: "none" as const,
      discountValue: "",
    })),
    fulfilment: "none",
    deliveryFee: "",
    deliveryAddress: "",
    discountKind: "none",
    discountValue: "",
    notes: "Thank you for the chance to quote. This is a sample, to show how your quotes will look.",
    title: "Sample quote",
    description: "Here is what I would make for you.",
    signOff: "",
    paymentInstructions: "",
    showBankDetails: true,
    showPhotos: true,
    depositKind: "percent",
    depositValue: "50",
    balanceDue: "handover",
    balanceDueDate: "",
    policies: [],
  };
  const parsed = parseQuote(values, vat);
  if (!parsed.ok) throw new Error("the sample quote should always parse: " + JSON.stringify(parsed.errors));

  const snapshot = buildQuoteSnapshot({
    quote: parsed.quote,
    number: "SAMPLE",
    version: 1,
    business: { name: organisation.name, ...profile },
    customer: null,
    countryCode: profile.countryCode,
    currencyCode: profile.currencyCode,
    vat,
    locale,
    bank: workspace.bankDetails,
  });
  return {
    ...snapshot,
    customer: { name: "Sample customer", contactPerson: null, phone: null, email: null, addressLines: [], vatNumber: null, companyRegistrationNumber: null },
    lines: snapshot.lines.map((l, i) => ({ ...l, photoImageId: items[i]?.photoImageId ?? null })),
  };
}
