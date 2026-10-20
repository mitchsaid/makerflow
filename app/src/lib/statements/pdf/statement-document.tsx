import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { BankLine } from "../../bank";
import { formatMoney } from "../../money";
import { formatDay } from "../../quotes/dates";
import { PDF_FONT } from "../../quotes/pdf/fonts";
import { pdfSource, type PdfImage } from "../../quotes/pdf/quote-document";
import type { SnapshotParty } from "../../quotes/snapshot";
import { ageingAmounts, PERIOD_LABELS, type Period, type Statement } from "../index";

/** Everything a statement is drawn from; the document itself never reads the database. */
export type StatementDocumentData = {
  business: SnapshotParty;
  customer: SnapshotParty;
  vatNumberLabel: string;
  today: string;
  period: Period;
  onlyOwing: boolean;
  currencyCode: string;
  numberStyle: Parameters<typeof formatMoney>[2];
  dateLocale: string;
  statement: Statement;
  bank: BankLine[];
  /** The wording from the country's locale pack. */
  words: {
    title: string;
    broughtForward: string;
    invoiced: string;
    credited: string;
    paid: string;
    balance: string;
    creditOnAccount: string;
    ageingTitle: string;
    ageingBuckets: readonly [string, string, string, string, string];
    howToPay: string;
  };
};

const INK = "#1a1a1a";
const MUTED = "#666666";
const RULE = "#d4d4d4";
const TINT = "#f4f4f4";

const styles = StyleSheet.create({
  page: { paddingTop: 44, paddingHorizontal: 44, paddingBottom: 70, fontSize: 10, fontFamily: PDF_FONT, color: INK },
  footer: { position: "absolute", bottom: 26, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: MUTED },
  head: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  headLeft: { flexDirection: "row", gap: 10, flexShrink: 1 },
  logo: { width: 48, height: 48, objectFit: "contain" },
  businessName: { fontSize: 16, fontWeight: 700 },
  small: { fontSize: 9, color: MUTED },
  title: { fontSize: 16, fontWeight: 700, textAlign: "right" },
  right: { alignItems: "flex-end", gap: 2 },
  label: { fontSize: 8, color: MUTED, textTransform: "uppercase", marginBottom: 3 },
  parties: { marginBottom: 16, gap: 1 },
  partyName: { fontSize: 12, fontWeight: 700 },
  boxes: { flexDirection: "row", gap: 8, marginBottom: 16 },
  box: { flexGrow: 1, flexBasis: 0, backgroundColor: TINT, padding: 8, borderRadius: 4 },
  boxValue: { fontSize: 11, fontWeight: 700, marginTop: 2 },
  tableHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: INK, paddingBottom: 4, marginBottom: 2 },
  row: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: RULE },
  cDate: { width: "13%" },
  cRef: { width: "15%" },
  cDetails: { width: "32%", paddingRight: 6 },
  cAmount: { width: "13%", textAlign: "right" },
  cBalance: { width: "14%", textAlign: "right" },
  th: { fontSize: 8, color: MUTED, textTransform: "uppercase" },
  section: { marginTop: 18 },
  how: { marginTop: 4, gap: 2 },
  bankRow: { flexDirection: "row", gap: 6 },
  bankLabel: { width: 110, color: MUTED },
});

/** A statement of account as an A4 document. */
export function StatementDocument({ data, logo }: { data: StatementDocumentData; logo?: PdfImage | null }) {
  const { statement: s, words } = data;
  const money = (cents: number) => formatMoney(cents, data.currencyCode, data.numberStyle);
  const day = (iso: string) => formatDay(iso, data.dateLocale);
  const owing = s.closingCents > 0;
  const periodText = data.period === "all" ? "" : `${PERIOD_LABELS[data.period]} · `;
  const contact = (p: SnapshotParty) => [p.phone, p.email].filter(Boolean).join(" · ");

  return (
    <Document title={`${words.title} · ${data.customer.name}`} author={data.business.name} creator="MakerFlow" producer="MakerFlow">
      <Page size="A4" style={styles.page}>
        <View style={styles.footer} fixed>
          <Text>
            {data.business.name} · {words.title}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

        <View style={styles.head}>
          <View style={styles.headLeft}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {logo ? <Image src={pdfSource(logo)} style={styles.logo} /> : null}
            <View style={{ flexShrink: 1, gap: 1 }}>
              <Text style={styles.businessName}>{data.business.name}</Text>
              {data.business.addressLines.length > 0 ? <Text style={styles.small}>{data.business.addressLines.join(", ")}</Text> : null}
              {contact(data.business) ? <Text style={styles.small}>{contact(data.business)}</Text> : null}
              {data.business.vatNumber ? (
                <Text style={styles.small}>
                  {data.vatNumberLabel}: {data.business.vatNumber}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.right}>
            <Text style={styles.title}>{words.title}</Text>
            <Text style={styles.small}>{day(data.today)}</Text>
            <Text style={styles.small}>
              {periodText}
              {s.entries.length === 0 ? "" : `${day(s.entries[0].date)} to ${day(s.entries[s.entries.length - 1].date)}`}
            </Text>
          </View>
        </View>

        <View style={styles.parties}>
          <Text style={styles.label}>For</Text>
          <Text style={styles.partyName}>{data.customer.name}</Text>
          {data.customer.contactPerson ? <Text>{data.customer.contactPerson}</Text> : null}
          {data.customer.addressLines.length > 0 ? <Text>{data.customer.addressLines.join(", ")}</Text> : null}
          {contact(data.customer) ? <Text>{contact(data.customer)}</Text> : null}
        </View>

        <View style={styles.boxes}>
          {[
            [words.invoiced, money(s.invoicedCents)],
            [words.credited, money(s.creditedCents)],
            [words.paid, money(s.paidCents)],
            [words.balance, money(s.closingCents)],
          ].map(([label, value]) => (
            <View key={label} style={styles.box}>
              <Text style={styles.small}>{label}</Text>
              <Text style={styles.boxValue}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.tableHead} fixed>
          <Text style={[styles.th, styles.cDate]}>Date</Text>
          <Text style={[styles.th, styles.cRef]}>Reference</Text>
          <Text style={[styles.th, styles.cDetails]}>Details</Text>
          <Text style={[styles.th, styles.cAmount]}>{words.invoiced}</Text>
          <Text style={[styles.th, styles.cAmount]}>{words.credited}</Text>
          <Text style={[styles.th, styles.cBalance]}>{words.balance}</Text>
        </View>
        {data.period !== "all" ? (
          <View style={styles.row} wrap={false}>
            <Text style={styles.cDate} />
            <Text style={styles.cRef} />
            <Text style={styles.cDetails}>{words.broughtForward}</Text>
            <Text style={styles.cAmount} />
            <Text style={styles.cAmount} />
            <Text style={styles.cBalance}>{money(s.openingCents)}</Text>
          </View>
        ) : null}
        {s.entries.map((e) => (
          <View key={e.key} style={styles.row} wrap={false}>
            <Text style={styles.cDate}>{day(e.date)}</Text>
            <Text style={styles.cRef}>{e.reference}</Text>
            <Text style={styles.cDetails}>{e.description}</Text>
            <Text style={styles.cAmount}>{e.debitCents ? money(e.debitCents) : ""}</Text>
            <Text style={styles.cAmount}>{e.creditCents ? money(e.creditCents) : ""}</Text>
            <Text style={styles.cBalance}>{money(e.balanceCents)}</Text>
          </View>
        ))}

        {owing ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.label}>{words.ageingTitle}</Text>
            <View style={styles.boxes}>
              {ageingAmounts(s.ageing).map((cents, i) => (
                <View key={i} style={styles.box}>
                  <Text style={styles.small}>{words.ageingBuckets[i]}</Text>
                  <Text style={styles.boxValue}>{money(cents)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {s.creditOnAccountCents > 0 ? (
          <Text style={{ marginTop: 6 }}>
            {words.creditOnAccount}: {money(s.creditOnAccountCents)}
          </Text>
        ) : null}

        {owing && data.bank.length > 0 ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.label}>{words.howToPay}</Text>
            <View style={styles.how}>
              {data.bank.map((b, i) => (
                <View key={i} style={styles.bankRow}>
                  <Text style={styles.bankLabel}>{b.label}</Text>
                  <Text>{b.value}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
