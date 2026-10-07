import "server-only";
import type { ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { QuoteSnapshot, SnapshotParty } from "../snapshot";
import { drawable, registerPdfFonts } from "./fonts";
import { QuoteDocument } from "./quote-document";

const clean = (value: string | null) => (value === null ? null : drawable(value));

function cleanParty<T extends SnapshotParty>(party: T): T {
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
  return {
    ...snapshot,
    business: cleanParty(snapshot.business),
    customer: snapshot.customer ? cleanParty(snapshot.customer) : null,
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

/** The PDF bytes for a quote snapshot. `draft` adds a "not sent yet" banner for previews. */
export async function renderQuotePdf(snapshot: QuoteSnapshot, options: { draft?: boolean } = {}): Promise<Buffer> {
  registerPdfFonts();
  // QuoteDocument is a plain function that returns the <Document>, which is what renderToBuffer wants.
  // Text the font cannot draw (emoji, mostly) is dropped for the PDF only; the snapshot keeps it.
  const document = QuoteDocument({ snapshot: forPdf(snapshot), draft: options.draft ?? false });
  return renderToBuffer(document as ReactElement<DocumentProps>);
}
