import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatMoney, formatPercent } from "../../money";
import { formatDay } from "../dates";
import { quantityText } from "../units";
import { designStyles } from "./designs";
import type { QuoteSnapshot, SnapshotDiscount } from "../snapshot";

/**
 * The quote as an A4 document, drawn from a snapshot and from nothing else (see snapshot.ts).
 * All wording that depends on the country (title, "not a tax invoice", the VAT statement) is
 * read from the snapshot, which took it from the locale pack. The few words that are the
 * app's own ("Prepared for", "Total") are English. The look (colours, sizes, spacing) comes from
 * the design the snapshot names (see designs.ts); the content and layout are the same for all.
 */

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
  const styles = designStyles(s.design);
  const money = (cents: number) => formatMoney(cents, s.currencyCode, s.numberStyle);
  const day = (iso: string) => formatDay(iso, s.dateLocale);
  const lineTotal = s.lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const inclusive = s.vat.registered && s.vat.entry === "inclusive";
  const exclusive = s.vat.registered && s.vat.entry === "exclusive";
  const numberText = s.version > 1 ? `${s.number} · version ${s.version}` : s.number;

  return (
    <Document title={`${s.wording.title} ${s.number}`} author={s.business.name} creator="MakerFlow" producer="MakerFlow">
      <Page size="A4" style={styles.page}>
        {/* Fixed to the foot of every page. */}
        <View style={styles.footer} fixed>
          <Text>
            {s.business.name} · {numberText}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

        <View>
          {draft ? (
            <Text style={styles.banner}>DRAFT PREVIEW. This quote has not been sent yet and can still change.</Text>
          ) : null}

          <View style={styles.headerTop}>
            <Text style={styles.businessName}>{s.business.name}</Text>
            <Text style={styles.title}>{s.wording.title}</Text>
          </View>
          <View style={styles.headerDetails}>
            <View style={styles.headerLeft}>
              <PartyLines party={s.business} />
              {s.business.vatNumber ? (
                <Text>
                  {s.vat.registrationNumberLabel}: {s.business.vatNumber}
                </Text>
              ) : null}
            </View>
            <Text style={styles.number}>{numberText}</Text>
          </View>

          <View style={styles.partiesRow}>
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
            <View style={styles.meta}>
              <View style={styles.metaRow}>
                <Text style={styles.muted}>Date</Text>
                <Text>{day(s.issueDate)}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.muted}>Valid until</Text>
                <Text>{day(s.validUntil)}</Text>
              </View>
              {s.neededBy ? (
                <View style={styles.metaRow}>
                  <Text style={styles.muted}>Needed by</Text>
                  <Text>{day(s.neededBy)}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {s.title || s.description ? (
            <View style={styles.intro}>
              {s.title ? <Text style={styles.quoteTitle}>{s.title}</Text> : null}
              {s.description ? <Text>{s.description}</Text> : null}
            </View>
          ) : null}

          <View style={styles.table}>
            <View style={styles.tableHead}>
              <Text style={[styles.tableHeadText, styles.colName]}>Item</Text>
              <Text style={[styles.tableHeadText, styles.colQty]}>Qty</Text>
              <Text style={[styles.tableHeadText, styles.colPrice]}>Price</Text>
              <Text style={[styles.tableHeadText, styles.colAmount]}>Amount</Text>
            </View>
            {s.lines.map((l, i) => (
              <View key={i} wrap={false}>
                <View style={styles.row}>
                  <View style={styles.colName}>
                    <Text>{l.name}</Text>
                    {l.description ? <Text style={styles.description}>{l.description}</Text> : null}
                    {l.discount ? <Text style={styles.description}>{lineDiscountText(l.discount, s)}</Text> : null}
                  </View>
                  <Text style={styles.colQty}>{quantityText(l.quantityMilli, l.unit, s.numberStyle, " ")}</Text>
                  <Text style={styles.colPrice}>{money(l.unitPriceCents)}</Text>
                  <Text style={styles.colAmount}>{money(l.lineTotalCents)}</Text>
                </View>
              </View>
            ))}
            {s.lines.length === 0 ? <Text style={[styles.muted, { paddingVertical: 8 }]}>No items yet</Text> : null}
          </View>

          <View style={styles.totals} wrap={false}>
            {s.quoteDiscount || s.vat.registered ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  {exclusive ? `Subtotal (excluding ${s.vat.taxName})` : inclusive ? `Subtotal (including ${s.vat.taxName})` : "Subtotal"}
                </Text>
                <Text>{money(lineTotal)}</Text>
              </View>
            ) : null}
            {s.quoteDiscount ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{quoteDiscountText(s.quoteDiscount, s)}</Text>
                <Text>-{money(s.quoteDiscount.amountCents)}</Text>
              </View>
            ) : null}
            {exclusive ? (
              <>
                {s.quoteDiscount ? (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total excluding {s.vat.taxName}</Text>
                    <Text>{money(s.totals.netCents)}</Text>
                  </View>
                ) : null}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>
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
                <Text style={[styles.muted, styles.totalLabel]}>
                  Includes {s.vat.taxName}
                  {s.vat.rateBp !== null ? ` (${formatPercent(s.vat.rateBp, s.numberStyle)})` : ""}
                </Text>
                <Text style={styles.muted}>{money(s.totals.vatCents)}</Text>
              </View>
            ) : null}
          </View>

          {s.deposit ? (
            <View style={styles.depositBlock} wrap={false}>
              <View style={styles.totalRow}>
                <Text style={[styles.bold, styles.totalLabel]}>
                  {s.deposit.label}
                  {s.deposit.percentText ? ` (${s.deposit.percentText})` : ""}
                </Text>
                <Text style={styles.bold}>{money(s.deposit.depositCents)}</Text>
              </View>
              {s.deposit.balanceCents > 0 ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>
                    {s.deposit.balanceLabel}, {s.deposit.dueText}
                  </Text>
                  <Text>{money(s.deposit.balanceCents)}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {s.notes ? (
            // The label never sits alone at the foot of a page; the text can run over a page break.
            <View style={styles.section}>
              <Text style={styles.sectionLabel} minPresenceAhead={40}>
                Notes
              </Text>
              <Text>{s.notes}</Text>
            </View>
          ) : null}

          {s.bankDetails && s.bankDetails.length > 0 ? (
            <View style={styles.section}>
              {/* The label, its rows and the other ways to pay stay together: a short block that never splits across pages. */}
              <View wrap={false}>
                <Text style={styles.sectionLabel}>How to pay</Text>
                {s.bankDetails.map((line, i) => (
                  <View key={i} style={styles.bankRow}>
                    <Text style={styles.bankLabel}>{line.label}</Text>
                    <Text style={styles.bankValue}>{line.value}</Text>
                  </View>
                ))}
                {s.paymentInstructions ? <Text style={styles.payOther}>{s.paymentInstructions}</Text> : null}
              </View>
            </View>
          ) : s.paymentInstructions ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel} minPresenceAhead={40}>
                How to pay
              </Text>
              <Text>{s.paymentInstructions}</Text>
            </View>
          ) : null}

          {s.signOff ? (
            <View style={styles.signOff} wrap={false}>
              <Text>{s.signOff}</Text>
              <Text style={styles.signOffName}>{s.business.name}</Text>
            </View>
          ) : null}

          {s.policies && s.policies.length > 0 ? (
            <View style={styles.smallPrint}>
              <Text style={styles.sectionLabel}>Terms and policies</Text>
              {s.policies.map((p, i) => (
                // One piece of text with its title, so the title is never alone at the foot of a page.
                <Text key={i} style={styles.policy}>
                  <Text style={styles.policyTitle}>{`${p.title}\n`}</Text>
                  {p.body}
                </Text>
              ))}
            </View>
          ) : null}

          {s.terms ? (
            <View style={s.policies && s.policies.length > 0 ? styles.terms : styles.termsAlone}>
              <Text style={styles.sectionLabel} minPresenceAhead={40}>
                {s.policies && s.policies.length > 0 ? "Other terms" : "Terms"}
              </Text>
              <Text>{s.terms}</Text>
            </View>
          ) : null}

          <View style={styles.statement}>
            {s.wording.inclusiveStatement ? <Text>{s.wording.inclusiveStatement}</Text> : null}
            <Text>{s.wording.notATaxInvoice}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
