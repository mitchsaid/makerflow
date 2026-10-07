import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import type { BankLine } from "../../bank";
import { formatMoney, formatPercent } from "../../money";
import { formatDay } from "../dates";
import { quantityText } from "../units";
import { themeFor } from "../designs";
import { makeStyles } from "./designs";
import type { QuoteSnapshot, SnapshotDiscount } from "../snapshot";

/**
 * The quote as an A4 document, drawn from a snapshot and from nothing else (see snapshot.ts).
 * All wording that depends on the country (title, "not a tax invoice", the VAT statement) is
 * read from the snapshot, which took it from the locale pack. The few words that are the
 * app's own ("Prepared for", "Total") are English. The look (colours, sizes, spacing) comes from
 * the design the snapshot names (see designs.ts); the content and layout are the same for all.
 */

/**
 * Bank lines in one column when there are up to three, or when any label or value is too long
 * for half the page; otherwise two (the first takes the extra).
 */
function splitInTwo(lines: BankLine[]): BankLine[][] {
  if (lines.length <= 3 || lines.some((l) => l.label.length > 18 || l.value.length > 26)) return [lines];
  const half = Math.ceil(lines.length / 2);
  return [lines.slice(0, half), lines.slice(half)];
}

function lineDiscountText(d: SnapshotDiscount, s: QuoteSnapshot): string {
  return d.kind === "percent"
    ? `Discount: ${formatPercent(d.basisPoints, s.numberStyle)}`
    : `Discount: ${formatMoney(d.cents, s.currencyCode, s.numberStyle)}`;
}

function quoteDiscountText(d: SnapshotDiscount, s: QuoteSnapshot): string {
  return d.kind === "percent" ? `Discount (${formatPercent(d.basisPoints, s.numberStyle)})` : "Discount";
}

/**
 * A business's or customer's details in as few lines as read well: the contact person, the
 * address on one line (it wraps when it must), then phone and email on one line. The address
 * lines are the country's own (from its locale pack); they are only joined here.
 */
function PartyLines({ party }: { party: QuoteSnapshot["business"] | NonNullable<QuoteSnapshot["customer"]> }) {
  const contact = [party.phone, party.email].filter(Boolean).join(" · ");
  return (
    <>
      {party.contactPerson ? <Text>{party.contactPerson}</Text> : null}
      {party.addressLines.length > 0 ? <Text>{party.addressLines.join(", ")}</Text> : null}
      {contact ? <Text>{contact}</Text> : null}
    </>
  );
}

/** A picture's bytes, loaded by the caller (the document itself never reads the database). */
export type PdfImage = { contentType: string; bytes: Buffer };

/** What react-pdf wants for a picture it is given as bytes. */
const pdfSource = (image: PdfImage) => ({ data: image.bytes, format: image.contentType === "image/png" ? ("png" as const) : ("jpg" as const) });

export function QuoteDocument({
  snapshot: s,
  draft = false,
  images,
  logo,
}: {
  snapshot: QuoteSnapshot;
  draft?: boolean;
  /** The product photos named in the snapshot (small copies), by image id. A missing one is left out. */
  images?: ReadonlyMap<string, PdfImage>;
  /** The business's logo, if the snapshot names one and it could be loaded. */
  logo?: PdfImage | null;
}) {
  const theme = themeFor(s);
  const styles = makeStyles(theme);
  const draftBanner = <Text style={styles.banner}>DRAFT PREVIEW. This quote has not been sent yet and can still change.</Text>;
  const money = (cents: number) => formatMoney(cents, s.currencyCode, s.numberStyle);
  const day = (iso: string) => formatDay(iso, s.dateLocale);
  const lineTotal = s.lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const inclusive = s.vat.registered && s.vat.entry === "inclusive";
  const exclusive = s.vat.registered && s.vat.entry === "exclusive";
  const columns = s.bankDetails ? splitInTwo(s.bankDetails) : [];
  const photoOf = (l: QuoteSnapshot["lines"][number]) => (l.photoImageId ? (images?.get(l.photoImageId) ?? null) : null);
  // When any item has a photo, every item keeps a photo-sized space so the names line up.
  const anyPhoto = s.lines.some((l) => photoOf(l) !== null);
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

        {/* A line of colour across the top of every page (header "bar"). */}
        {theme.header === "bar" ? <View style={styles.topBar} fixed /> : null}

        <View>
          {/* On a band the colour must start at the very top of the page, so the draft banner goes beneath it. */}
          {draft && theme.header !== "band" ? draftBanner : null}

          {/* The business, the kind of document and the number: on a band of colour, or plain on the page. */}
          <View style={theme.header === "band" ? styles.band : undefined}>
            {logo ? (
              <View style={theme.header === "band" ? styles.logoTile : styles.logoBox}>
                {/* A picture inside a PDF: react-pdf's Image, not an HTML img, so no alt text applies. */}
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={pdfSource(logo)} style={styles.logo} />
              </View>
            ) : null}

            <View style={styles.headerTop}>
              <View style={styles.businessNameBox}>
                <Text style={styles.businessName}>{s.business.name}</Text>
              </View>
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
          </View>

          {draft && theme.header === "band" ? <View style={{ marginTop: 12 }}>{draftBanner}</View> : null}

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
              {s.deliveryAddress ? (
                <View style={styles.deliverTo}>
                  <Text style={styles.sectionLabel}>Deliver to</Text>
                  <Text>{s.deliveryAddress}</Text>
                </View>
              ) : null}
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
            {/* Fixed inside the table: it repeats at the top of each page the table runs onto. */}
            <View style={styles.tableHead} fixed>
              <Text style={[styles.tableHeadText, styles.colName]}>Item</Text>
              <Text style={[styles.tableHeadText, styles.colQty]}>Qty</Text>
              <Text style={[styles.tableHeadText, styles.colPrice]}>Price</Text>
              <Text style={[styles.tableHeadText, styles.colAmount]}>Amount</Text>
            </View>
            {s.lines.map((l, i) => (
              <View key={i} wrap={false}>
                <View style={theme.rows === "zebra" && i % 2 === 1 ? [styles.row, styles.rowShaded] : styles.row}>
                  <View style={styles.colName}>
                    <View style={styles.nameRow}>
                      {anyPhoto ? (
                        photoOf(l) ? (
                          // eslint-disable-next-line jsx-a11y/alt-text
                          <Image src={pdfSource(photoOf(l)!)} style={styles.thumb} />
                        ) : (
                          <View style={styles.thumbSpace} />
                        )
                      ) : null}
                      <View style={styles.nameText}>
                        <Text>{l.name}</Text>
                        {l.description ? <Text style={styles.description}>{l.description}</Text> : null}
                        {l.discount ? <Text style={styles.description}>{lineDiscountText(l.discount, s)}</Text> : null}
                      </View>
                    </View>
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
            // One piece of text with its label, so the label can never be left alone at the foot of
            // a page (minPresenceAhead does nothing on a first child), and the text can still run
            // over a page break.
            <Text style={styles.section}>
              <Text style={styles.label}>{"Notes\n"}</Text>
              {s.notes}
            </Text>
          ) : null}

          {s.bankDetails && s.bankDetails.length > 0 ? (
            <View style={styles.section}>
              {/* The label, its rows and the other ways to pay stay together: a short block that never splits across pages. */}
              <View wrap={false}>
                <Text style={styles.sectionLabel}>How to pay</Text>
                {/* Two columns when there are more than three short lines, so the block stays short. */}
                <View style={styles.bankColumns}>
                  {columns.map((column, c) => (
                    <View key={c} style={columns.length > 1 ? styles.bankColumn : styles.bankColumnFull}>
                      {column.map((line, i) => (
                        <View key={i} style={styles.bankRow}>
                          <Text style={styles.bankLabel}>{line.label}</Text>
                          <Text style={styles.bankValue}>{line.value}</Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
                {s.paymentInstructions ? <Text style={styles.payOther}>{s.paymentInstructions}</Text> : null}
              </View>
            </View>
          ) : s.paymentInstructions ? (
            <Text style={styles.section}>
              <Text style={styles.label}>{"How to pay\n"}</Text>
              {s.paymentInstructions}
            </Text>
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
            <Text style={s.policies && s.policies.length > 0 ? styles.terms : styles.termsAlone}>
              <Text style={styles.label}>{s.policies && s.policies.length > 0 ? "Other terms\n" : "Terms\n"}</Text>
              {s.terms}
            </Text>
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
