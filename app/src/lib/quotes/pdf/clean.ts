import type { QuoteSnapshot, SnapshotParty } from "../snapshot";
import { themeFromStored } from "../themes";
import { drawable as drawableIn } from "./fonts";

function cleanParty<T extends SnapshotParty>(party: T, drawable: (text: string) => string): T {
  const clean = (value: string | null) => (value === null ? null : drawable(value));
  return {
    ...party,
    name: drawable(party.name),
    contactPerson: clean(party.contactPerson),
    phone: clean(party.phone),
    email: clean(party.email),
    addressLines: party.addressLines.map(drawable).filter((line) => line !== ""),
    vatNumber: clean(party.vatNumber),
    companyRegistrationNumber: clean(party.companyRegistrationNumber),
  };
}

/**
 * The text the person typed, made safe for the PDF's font (see drawable()). Only that text:
 * wording and number styles from the locale pack are left exactly as they are.
 */
export function forPdf(snapshot: QuoteSnapshot): QuoteSnapshot {
  // Letters the theme's fonts have no shape for are left out along with the emoji.
  const theme = themeFromStored(snapshot);
  const drawable = (text: string) => drawableIn(text, [theme.headingFont, theme.bodyFont]);
  const clean = (value: string | null) => (value === null ? null : drawable(value));
  return {
    ...snapshot,
    business: cleanParty(snapshot.business, drawable),
    customer: snapshot.customer ? cleanParty(snapshot.customer, drawable) : null,
    lines: snapshot.lines.map((l) => ({
      ...l,
      name: drawable(l.name),
      description: clean(l.description),
      unit: clean(l.unit ?? null),
    })),
    notes: clean(snapshot.notes),
    deliveryAddress: clean(snapshot.deliveryAddress ?? null),
    title: clean(snapshot.title ?? null),
    description: clean(snapshot.description ?? null),
    signOff: clean(snapshot.signOff ?? null),
    terms: clean(snapshot.terms ?? null),
    paymentInstructions: clean(snapshot.paymentInstructions ?? null),
    bankDetails: snapshot.bankDetails?.map((l) => ({ label: drawable(l.label), value: drawable(l.value) })),
    policies: snapshot.policies?.map((p) => ({ ...p, title: drawable(p.title), body: drawable(p.body) })),
  };
}
