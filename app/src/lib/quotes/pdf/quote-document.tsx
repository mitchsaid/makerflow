import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatMoney, formatPercent, formatQuantity } from "../../money";
import { formatDay } from "../dates";
import { PDF_FONT } from "./fonts";
import type { QuoteSnapshot, SnapshotDiscount } from "../snapshot";

/**
 * The quote as an A4 document, drawn from a snapshot and from nothing else (see snapshot.ts).
 * All wording that depends on the country (title, "not a tax invoice", the VAT statement) is
 * read from the snapshot, which took it from the locale pack. The few words that are the
 * app's own ("Prepared for", "Total") are English.
 */

const INK = "#1a1a1a";
const MUTED = "#666666";
const LINE = "#d4d4d4";

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 60, fontSize: 10, fontFamily: PDF_FONT, color: INK, lineHeight: 1.35 },
  banner: { backgroundColor: "#fff4d6", color: "#6b4e00", padding: 6, marginBottom: 14, fontSize: 9, textAlign: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  headerLeft: { width: "55%" },
  headerRight: { width: "40%", alignItems: "flex-end" },
  businessName: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 6, lineHeight: 1.2 },
  muted: { color: MUTED },
  meta: { flexDirection: "row", marginTop: 2 },
  metaLabel: { width: 70, textAlign: "right", color: MUTED, marginRight: 6 },
  metaValue: { minWidth: 70, textAlign: "right" },
  sectionLabel: { fontSize: 8, color: MUTED, textTransform: "uppercase", marginBottom: 3 },
  party: { marginBottom: 22 },
  partyName: { fontWeight: 700, fontSize: 11 },
  tableHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: INK, paddingBottom: 4, fontWeight: 700 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 5 },
  colName: { width: "46%", paddingRight: 8 },
  colQty: { width: "12%", textAlign: "right" },
  colPrice: { width: "20%", textAlign: "right" },
  colAmount: { width: "22%", textAlign: "right" },
  description: { color: MUTED, fontSize: 9, marginTop: 1 },
  totals: { marginTop: 10, alignSelf: "flex-end", width: "52%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grandRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, marginTop: 3, borderTopWidth: 1, borderTopColor: INK, fontWeight: 700, fontSize: 12 },
  notes: { marginTop: 22 },
  statement: { marginTop: 18, color: MUTED, fontSize: 9 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: MUTED, flexDirection: "row", justifyContent: "space-between" },
});

function lineDiscountText(d: SnapshotDiscount, s: QuoteSnapshot): string {
  return d.kind === "percent"
    ? `Discount: ${formatPercent(d.basisPoints, s.numberStyle)}`
    : `Discount: ${formatMoney(d.cents, s.currencyCode, s.numberStyle)}`;
}

function quoteDiscountText(d: SnapshotDiscount, s: QuoteSnapshot): string {
  return d.kind === "percent" ? `Discount (${formatPercent(d.basisPoints, s.numberStyle)})` : "Discount";
}

function PartyLines({ party }: { party: QuoteSnapshot["business"] | NonNullable<QuoteSnapshot["customer"]> }) {
  return (
    <>
      {party.contactPerson ? <Text>{party.contactPerson}</Text> : null}
      {party.addressLines.map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
      {party.phone ? <Text>{party.phone}</Text> : null}
      {party.email ? <Text>{party.email}</Text> : null}
    </>
  );
}

export function QuoteDocument({ snapshot: s, draft = false }: { snapshot: QuoteSnapshot; draft?: boolean }) {
  const money = (cents: number) => formatMoney(cents, s.currencyCode, s.numberStyle);
  const day = (iso: string) => formatDay(iso, s.dateLocale);
  const lineTotal = s.lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const inclusive = s.vat.registered && s.vat.entry === "inclusive";
  const exclusive = s.vat.registered && s.vat.entry === "exclusive";
  const numberText = s.version > 1 ? `${s.number} · version ${s.version}` : s.number;

  return (
    <Document title={`${s.wording.title} ${s.number}`} author={s.business.name} creator="MakerFlow" producer="MakerFlow">
      <Page size="A4" style={styles.page}>
        {draft ? (
          <Text style={styles.banner}>DRAFT PREVIEW. This quote has not been sent yet and can still change.</Text>
        ) : null}

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.businessName}>{s.business.name}</Text>
            <PartyLines party={s.business} />
            {s.business.vatNumber ? (
              <Text>
                {s.vat.registrationNumberLabel}: {s.business.vatNumber}
              </Text>
            ) : null}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.title}>{s.wording.title}</Text>
            <Text style={{ fontWeight: 700 }}>{numberText}</Text>
            <View style={styles.meta}>
              <Text style={styles.metaLabel}>Date</Text>
              <Text style={styles.metaValue}>{day(s.issueDate)}</Text>
            </View>
            <View style={styles.meta}>
              <Text style={styles.metaLabel}>Valid until</Text>
              <Text style={styles.metaValue}>{day(s.validUntil)}</Text>
            </View>
            {s.neededBy ? (
              <View style={styles.meta}>
                <Text style={styles.metaLabel}>Needed by</Text>
                <Text style={styles.metaValue}>{day(s.neededBy)}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.party}>
          <Text style={styles.sectionLabel}>Prepared for</Text>
          {s.customer ? (
            <>
              <Text style={styles.partyName}>{s.customer.name}</Text>
              <PartyLines party={s.customer} />
              {s.customer.vatNumber ? (
                <Text>
                  {s.vat.registrationNumberLabel}: {s.customer.vatNumber}
                </Text>
              ) : null}
              {s.customer.companyRegistrationNumber ? (
                <Text>Company registration: {s.customer.companyRegistrationNumber}</Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.muted}>No customer chosen yet</Text>
          )}
        </View>

        <View style={styles.tableHead}>
          <Text style={styles.colName}>Item</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colPrice}>Price</Text>
          <Text style={styles.colAmount}>Amount</Text>
        </View>
        {s.lines.map((l, i) => (
          <View key={i} wrap={false}>
            <View style={styles.row}>
              <View style={styles.colName}>
                <Text>{l.name}</Text>
                {l.description ? <Text style={styles.description}>{l.description}</Text> : null}
                {l.discount ? <Text style={styles.description}>{lineDiscountText(l.discount, s)}</Text> : null}
              </View>
              <Text style={styles.colQty}>{formatQuantity(l.quantityMilli, s.numberStyle)}</Text>
              <Text style={styles.colPrice}>{money(l.unitPriceCents)}</Text>
              <Text style={styles.colAmount}>{money(l.lineTotalCents)}</Text>
            </View>
          </View>
        ))}
        {s.lines.length === 0 ? <Text style={[styles.muted, { paddingVertical: 8 }]}>No items yet</Text> : null}

        <View style={styles.totals} wrap={false}>
          {s.quoteDiscount || s.vat.registered ? (
            <View style={styles.totalRow}>
              <Text>
                {exclusive ? `Subtotal (excluding ${s.vat.taxName})` : inclusive ? `Subtotal (including ${s.vat.taxName})` : "Subtotal"}
              </Text>
              <Text>{money(lineTotal)}</Text>
            </View>
          ) : null}
          {s.quoteDiscount ? (
            <View style={styles.totalRow}>
              <Text>{quoteDiscountText(s.quoteDiscount, s)}</Text>
              <Text>-{money(s.quoteDiscount.amountCents)}</Text>
            </View>
          ) : null}
          {exclusive ? (
            <>
              {s.quoteDiscount ? (
                <View style={styles.totalRow}>
                  <Text>Total excluding {s.vat.taxName}</Text>
                  <Text>{money(s.totals.netCents)}</Text>
                </View>
              ) : null}
              <View style={styles.totalRow}>
                <Text>
                  {s.vat.taxName}
                  {s.vat.rateBp !== null ? ` (${formatPercent(s.vat.rateBp, s.numberStyle)})` : ""}
                </Text>
                <Text>{money(s.totals.vatCents)}</Text>
              </View>
            </>
          ) : null}
          <View style={styles.grandRow}>
            <Text>{s.vat.registered ? `Total including ${s.vat.taxName}` : "Total"}</Text>
            <Text>{money(s.totals.grossCents)}</Text>
          </View>
          {inclusive ? (
            <View style={styles.totalRow}>
              <Text style={styles.muted}>
                Includes {s.vat.taxName}
                {s.vat.rateBp !== null ? ` (${formatPercent(s.vat.rateBp, s.numberStyle)})` : ""}
              </Text>
              <Text style={styles.muted}>{money(s.totals.vatCents)}</Text>
            </View>
          ) : null}
        </View>

        {s.notes ? (
          <View style={styles.notes} wrap={false}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text>{s.notes}</Text>
          </View>
        ) : null}

        <View style={styles.statement}>
          {s.wording.inclusiveStatement ? <Text>{s.wording.inclusiveStatement}</Text> : null}
          <Text>{s.wording.notATaxInvoice}</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>
            {s.business.name} · {numberText}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
