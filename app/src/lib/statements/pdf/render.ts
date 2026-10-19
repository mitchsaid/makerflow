import "server-only";
import type { ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { drawable, ensureFonts } from "../../quotes/pdf/fonts";
import type { SnapshotParty } from "../../quotes/snapshot";
import type { PdfImage } from "../../quotes/pdf/quote-document";
import { StatementDocument, type StatementDocumentData } from "./statement-document";

const cleanParty = (party: SnapshotParty): SnapshotParty => {
  const clean = (value: string | null) => (value === null ? null : drawable(value));
  return {
    ...party,
    name: drawable(party.name),
    contactPerson: clean(party.contactPerson),
    phone: clean(party.phone),
    email: clean(party.email),
    addressLines: party.addressLines.map((l) => drawable(l)).filter((l) => l !== ""),
    vatNumber: clean(party.vatNumber),
    companyRegistrationNumber: clean(party.companyRegistrationNumber),
  };
};

/** The PDF bytes for a statement. Text the person typed is made safe for the font (emoji dropped), as for quotes. */
export async function renderStatementPdf(data: StatementDocumentData, options: { logo?: PdfImage | null } = {}): Promise<Buffer> {
  await ensureFonts(["sans"]);
  const clean: StatementDocumentData = {
    ...data,
    business: cleanParty(data.business),
    customer: cleanParty(data.customer),
    statement: { ...data.statement, entries: data.statement.entries.map((e) => ({ ...e, description: drawable(e.description) })) },
    bank: data.bank.map((b) => ({ ...b, label: drawable(b.label), value: drawable(b.value) })),
  };
  const document = StatementDocument({ data: clean, logo: options.logo });
  return renderToBuffer(document as ReactElement<DocumentProps>);
}
