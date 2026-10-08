import { Defs, Document, Image, LinearGradient, Page, Rect, Stop, Svg, Text, View } from "@react-pdf/renderer";
import type { BankLine } from "../../bank";
import { formatMoney, formatPercent } from "../../money";
import { formatDay } from "../dates";
import { quantityText } from "../units";
import { IMAGE_OPACITY, themeFromStored } from "../themes";
import { makeStyles } from "./styles";
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
function PartyLines({ party, centred = false }: { party: QuoteSnapshot["business"] | NonNullable<QuoteSnapshot["customer"]>; centred?: boolean }) {
  const align = centred ? ({ textAlign: "center" } as const) : undefined;
  const contact = [party.phone, party.email].filter(Boolean).join(" · ");
  return (
    <>
      {party.contactPerson ? <Text style={align}>{party.contactPerson}</Text> : null}
      {party.addressLines.length > 0 ? <Text style={align}>{party.addressLines.join(", ")}</Text> : null}
      {contact ? <Text style={align}>{contact}</Text> : null}
    </>
  );
}

/** A4 in points, for what must fill the whole page. */
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

/** A picture's bytes, loaded by the caller (the document itself never reads the database). */
export type PdfImage = { contentType: string; bytes: Uint8Array };

/**
 * What react-pdf wants for a picture it is given as bytes: the bytes themselves on the server, a data
 * address in the browser (which has no Buffer).
 */
const pdfSource = (image: PdfImage) => {
  const format = image.contentType === "image/png" ? ("png" as const) : ("jpg" as const);
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(image.bytes)) return { data: image.bytes, format };
  let binary = "";
  for (let i = 0; i < image.bytes.length; i += 0x8000) binary += String.fromCharCode(...image.bytes.subarray(i, i + 0x8000));
  return `data:${image.contentType};base64,${btoa(binary)}`;
};

export function QuoteDocument({
  snapshot: s,
  draft = false,
  images,
  logo,
  background,
}: {
  snapshot: QuoteSnapshot;
  draft?: boolean;
  /** The product photos named in the snapshot (small copies), by image id. A missing one is left out. */
  images?: ReadonlyMap<string, PdfImage>;
  /** The business's logo, if the snapshot names one and it could be loaded. */
  logo?: PdfImage | null;
  /** The picture behind every page, if the theme has one and it could be loaded. */
  background?: PdfImage | null;
}) {
  const theme = themeFromStored(s);
  const styles = makeStyles(theme);
  const headCell = theme.layout === "table" && theme.rows === "sheet" ? styles.cellGrid : undefined;
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
  // The logo and the name, as the theme asks: both, only the logo (the name when there is no logo), or only the name.
  const showLogo = !!logo && theme.headerLogo !== "name";
  const showName = !(theme.headerLogo === "logo" && !!logo);
  // Photo sizes by layout and the theme's choice, and their shape.
  const tablePhoto = theme.photo === "large" ? 60 : 38;
  const cardPhoto = theme.photo === "large" ? 80 : 48;
  const showcasePhoto = theme.photo === "large" ? 96 : 64;
  const photoStyle = (size: number) => ({
    width: size,
    height: size,
    marginRight: 10,
    objectFit: "cover" as const,
    borderRadius: theme.photoShape === "round" ? size / 2 : theme.photoShape === "rounded" ? Math.min(size / 6, 10) : 0,
  });
  const numberText = s.version > 1 ? `${s.number} · version ${s.version}` : s.number;

  return (
    <Document title={`${s.wording.title} ${s.number}`} author={s.business.name} creator="MakerFlow" producer="MakerFlow">
      <Page size="A4" style={styles.page}>
        {/* Behind everything, on every page: a gradient over the paper colour, or a picture faded into it. */}
        {theme.background === "gradient" ? (
          <Svg fixed style={{ position: "absolute", top: 0, left: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT }}>
            <Defs>
              {/* Top to bottom runs down the middle (x 0.5 to 0.5): react-pdf reads an end of "0" as "1", which would tilt it. */}
              <LinearGradient
                id="page-gradient"
                x1={theme.gradientDirection === "diagonal" ? "0" : "0.5"}
                y1="0"
                x2={theme.gradientDirection === "diagonal" ? "1" : "0.5"}
                y2="1"
              >
                <Stop offset="0" stopColor={theme.paper} />
                <Stop offset="1" stopColor={theme.gradientTo} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={PAGE_WIDTH} height={PAGE_HEIGHT} fill="url(#page-gradient)" />
          </Svg>
        ) : null}
        {theme.background === "image" && background ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={pdfSource(background)} fixed style={{ position: "absolute", top: 0, left: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, objectFit: "cover", opacity: IMAGE_OPACITY[theme.imageStrength] }} />
        ) : null}

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

          {/* The business, the kind of document and the number: on a band of colour, in a frame, or plain on the page. */}
          <View style={theme.header === "band" ? styles.band : theme.header === "boxed" ? styles.boxedHeader : undefined}>
            {showLogo ? (
              <View style={theme.header === "band" ? styles.logoTile : styles.logoBox}>
                {/* A picture inside a PDF: react-pdf's Image, not an HTML img, so no alt text applies. */}
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={pdfSource(logo!)} style={styles.logo} />
              </View>
            ) : null}

            {theme.headerAlign === "center" ? (
              <View style={styles.centredHeader}>
                {showName ? <Text style={styles.centredName}>{s.business.name}</Text> : null}
                <PartyLines party={s.business} centred />
                {s.business.vatNumber ? (
                  <Text>
                    {s.vat.registrationNumberLabel}: {s.business.vatNumber}
                  </Text>
                ) : null}
                <Text style={styles.centredTitle}>{s.wording.title}</Text>
                <Text style={styles.centredNumber}>{numberText}</Text>
              </View>
            ) : (
              <>
                <View style={styles.headerTop}>
                  <View style={styles.businessNameBox}>{showName ? <Text style={styles.businessName}>{s.business.name}</Text> : null}</View>
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
              </>
            )}
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

          {theme.layout === "table" ? (
            <View style={styles.table}>
              {/* Fixed inside the table: it repeats at the top of each page the table runs onto. */}
              {theme.tableHead !== "none" ? (
                <View style={styles.tableHead} fixed>
                  {theme.numbered ? <Text style={[styles.colNo, styles.tableHeadText, ...(headCell ? [headCell] : [])]}>No.</Text> : null}
                  <Text style={[styles.tableHeadText, styles.colName, ...(headCell ? [headCell] : [])]}>Item</Text>
                  {theme.showQty ? <Text style={[styles.tableHeadText, styles.colQty, ...(headCell ? [headCell] : [])]}>Qty</Text> : null}
                  {theme.showUnitPrice ? <Text style={[styles.tableHeadText, styles.colPrice, ...(headCell ? [headCell] : [])]}>Price</Text> : null}
                  <Text style={[styles.tableHeadText, styles.colAmount]}>Amount</Text>
                </View>
              ) : null}
              {s.lines.map((l, i) => {
                const cell = theme.layout === "table" && theme.rows === "sheet" ? styles.cellGrid : undefined;
                return (
                  <View key={i} wrap={false}>
                    <View style={[styles.row, ...(theme.rows === "zebra" && i % 2 === 1 ? [styles.rowShaded] : []), ...(i === 0 ? [styles.rowFirst] : [])]}>
                      {theme.numbered ? <Text style={[styles.colNo, cell ?? {}]}>{i + 1}</Text> : null}
                      <View style={[styles.colName, cell ?? {}]}>
                        <View style={styles.nameRow}>
                          {anyPhoto && theme.photo !== "none" ? (
                            photoOf(l) ? (
                              // eslint-disable-next-line jsx-a11y/alt-text
                              <Image src={pdfSource(photoOf(l)!)} style={photoStyle(tablePhoto)} />
                            ) : (
                              <View style={{ width: tablePhoto, marginRight: 10 }} />
                            )
                          ) : null}
                          <View style={styles.nameText}>
                            <Text>{l.name}</Text>
                            {theme.descriptions && l.description ? <Text style={styles.description}>{l.description}</Text> : null}
                            {l.discount ? <Text style={styles.description}>{lineDiscountText(l.discount, s)}</Text> : null}
                          </View>
                        </View>
                      </View>
                      {theme.showQty ? <Text style={[styles.colQty, cell ?? {}]}>{quantityText(l.quantityMilli, l.unit, s.numberStyle, " ")}</Text> : null}
                      {theme.showUnitPrice ? <Text style={[styles.colPrice, cell ?? {}]}>{money(l.unitPriceCents)}</Text> : null}
                      <Text style={styles.colAmount}>{money(l.lineTotalCents)}</Text>
                    </View>
                  </View>
                );
              })}
              {s.lines.length === 0 ? <Text style={[styles.muted, { paddingVertical: 8 }]}>No items yet</Text> : null}
            </View>
          ) : (
            <View style={{ marginTop: 16 }}>
              {s.lines.map((l, i) => {
                const photo = theme.photo !== "none" ? photoOf(l) : null;
                const size = theme.layout === "cards" ? cardPhoto : theme.layout === "showcase" ? showcasePhoto : tablePhoto;
                const shaded = theme.rows === "zebra" && i % 2 === 1;
                const label = `${theme.numbered ? `${i + 1}. ` : ""}${l.name}`;
                const meta = [theme.showQty ? quantityText(l.quantityMilli, l.unit, s.numberStyle, " ") : null, theme.showUnitPrice ? `${money(l.unitPriceCents)}${theme.showQty ? "" : " each"}` : null]
                  .filter(Boolean)
                  .join(theme.showQty && theme.showUnitPrice ? " × " : "");
                const details = (
                  <>
                    {theme.descriptions && l.description ? <Text style={styles.description}>{l.description}</Text> : null}
                    {l.discount ? <Text style={styles.description}>{lineDiscountText(l.discount, s)}</Text> : null}
                  </>
                );
                if (theme.layout === "cards") {
                  return (
                    <View key={i} wrap={false} style={styles.card}>
                      {photo ? (
                        // eslint-disable-next-line jsx-a11y/alt-text
                        <Image src={pdfSource(photo)} style={photoStyle(size)} />
                      ) : anyPhoto && theme.photo !== "none" ? (
                        <View style={{ width: size, marginRight: 10 }} />
                      ) : null}
                      <View style={styles.cardBody}>
                        <Text style={styles.itemName}>{label}</Text>
                        {details}
                        <View style={styles.cardBottom}>
                          <Text style={styles.itemMeta}>{meta}</Text>
                          <Text style={styles.bold}>{money(l.lineTotalCents)}</Text>
                        </View>
                      </View>
                    </View>
                  );
                }
                if (theme.layout === "showcase") {
                  return (
                    <View key={i} wrap={false} style={styles.showcaseItem}>
                      {photo ? (
                        // eslint-disable-next-line jsx-a11y/alt-text
                        <Image src={pdfSource(photo)} style={photoStyle(size)} />
                      ) : null}
                      <View style={styles.cardBody}>
                        <Text style={styles.showcaseName}>{label}</Text>
                        {details}
                        <View style={styles.cardBottom}>
                          <Text style={styles.itemMeta}>{meta}</Text>
                          <Text style={styles.bold}>{money(l.lineTotalCents)}</Text>
                        </View>
                      </View>
                    </View>
                  );
                }
                return (
                  <View key={i} wrap={false} style={[styles.listItem, ...(shaded ? [styles.rowShaded] : [])]}>
                    {photo ? (
                      // eslint-disable-next-line jsx-a11y/alt-text
                      <Image src={pdfSource(photo)} style={photoStyle(size)} />
                    ) : anyPhoto && theme.photo !== "none" ? (
                      <View style={{ width: size, marginRight: 10 }} />
                    ) : null}
                    <View style={styles.nameText}>
                      <Text style={styles.itemName}>{label}</Text>
                      {details}
                      {meta ? <Text style={styles.itemMeta}>{meta}</Text> : null}
                    </View>
                    <Text style={styles.listAmount}>{money(l.lineTotalCents)}</Text>
                  </View>
                );
              })}
              {s.lines.length === 0 ? <Text style={[styles.muted, { paddingVertical: 8 }]}>No items yet</Text> : null}
            </View>
          )}

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
