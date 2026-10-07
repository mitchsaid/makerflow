import { StyleSheet } from "@react-pdf/renderer";
import { DEFAULT_DESIGN, type DesignKey } from "../designs";
import { PDF_FONT } from "./fonts";

/**
 * The look of a quote document. A design is a set of styles; a sent version records the key of
 * the design it was drawn with (snapshot.design) so a design can be told apart later. A snapshot
 * without a design (made before designs existed) is the classic one.
 *
 * Classic is refined in place while MakerFlow has no real customers: the content and the numbers
 * on a document never change, only how they are laid out. Once real quotes are in use, a change
 * to the look of a released design becomes a new design instead, so that a quote a customer
 * already holds is always drawn the way they received it.
 *
 * One scale keeps the page consistent. Type: 8 (section labels), 9 (small print, descriptions),
 * 10 (body), 12 (grand total, quote title), 16 (business name), 20 (document title). Space: 4, 8,
 * 12, 20 between things, with 44 as the page margin. Colour: ink for what to read, muted for what
 * explains it, a hairline for rules.
 */

const INK = "#1a1a1a";
const MUTED = "#666666";
const LINE = "#d9d9d9";
const TINT = "#f4f4f4";

/** The page margin, shared by the page, the footer and anything that must line up with it. */
const MARGIN = 44;

/** The item table's columns. The totals sit under the last two, so they line up with them. */
const COL_NAME = "42%";
const COL_QTY = "18%";
const COL_PRICE = "20%";
const COL_AMOUNT = "20%";
const TOTALS_WIDTH = "40%";

export const classicStyles = StyleSheet.create({
  // No line height anywhere: the font's own spacing is right, and a page-wide line height makes
  // the page number in the footer vanish (a react-pdf quirk).
  page: { paddingTop: MARGIN, paddingHorizontal: MARGIN, paddingBottom: 70, fontSize: 10, fontFamily: PDF_FONT, color: INK },
  banner: { backgroundColor: "#fff4d6", color: "#6b4e00", padding: 6, marginBottom: 16, fontSize: 9, textAlign: "center" },

  // The top of the page: the business and the kind of document on one line (their baselines
  // match), the business's details and the number beneath, then who it is for and the dates.
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  headerDetails: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  headerLeft: { width: "55%" },
  businessName: { fontSize: 16, fontWeight: 700 },
  title: { fontSize: 20, fontWeight: 700 },
  number: { fontWeight: 700 },
  partiesRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  party: { width: "55%" },
  partyName: { fontWeight: 700 },
  // Starts level with the customer's name (below the "Prepared for" label).
  meta: { width: TOTALS_WIDTH, marginTop: 15 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  muted: { color: MUTED },

  // Every heading above a block of text: small, capital letters, muted.
  label: { fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6 },
  sectionLabel: { fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 },

  intro: { marginTop: 24 },
  quoteTitle: { fontSize: 12, fontWeight: 700, marginBottom: 2 },

  table: { marginTop: 20 },
  tableHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: INK, paddingBottom: 5 },
  tableHeadText: { fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 7 },
  colName: { width: COL_NAME, paddingRight: 10 },
  colQty: { width: COL_QTY, textAlign: "right", paddingRight: 10 },
  colPrice: { width: COL_PRICE, textAlign: "right", paddingRight: 10 },
  colAmount: { width: COL_AMOUNT, textAlign: "right" },
  description: { color: MUTED, fontSize: 9, marginTop: 2 },

  totals: { marginTop: 8, alignSelf: "flex-end", width: TOTALS_WIDTH },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  totalLabel: { flexShrink: 1, paddingRight: 10 },
  grandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingTop: 6, paddingBottom: 2, marginTop: 4, borderTopWidth: 1, borderTopColor: INK, fontWeight: 700, fontSize: 12 },
  depositBlock: { marginTop: 12, alignSelf: "flex-end", width: TOTALS_WIDTH, backgroundColor: TINT, borderRadius: 3, paddingVertical: 6, paddingHorizontal: 8 },
  bold: { fontWeight: 700 },

  // Blocks of text under the table. Each is the same distance from the one above.
  section: { marginTop: 20 },
  bankRow: { flexDirection: "row", paddingVertical: 1.5 },
  bankLabel: { width: 100, color: MUTED },
  bankValue: { fontWeight: 700 },
  payOther: { marginTop: 6 },
  signOff: { marginTop: 20 },
  signOffName: { fontWeight: 700, marginTop: 2 },

  // The small print: policies, other terms and the tax statement, all at the same small size.
  smallPrint: { fontSize: 9, marginTop: 20 },
  policy: { marginBottom: 8 },
  policyTitle: { fontWeight: 700 },
  terms: { fontSize: 9, color: MUTED, marginTop: 8 },
  termsAlone: { fontSize: 9, color: MUTED, marginTop: 20 },
  statement: { fontSize: 9, color: MUTED, marginTop: 16 },

  footer: { position: "absolute", bottom: 26, left: MARGIN, right: MARGIN, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: LINE, fontSize: 8, color: MUTED, flexDirection: "row", justifyContent: "space-between" },
});

type Styles = typeof classicStyles;

const STYLES: Record<DesignKey, Styles> = { classic: classicStyles };

export function designStyles(key: string | undefined): Styles {
  return STYLES[(key ?? DEFAULT_DESIGN) as DesignKey] ?? classicStyles;
}
