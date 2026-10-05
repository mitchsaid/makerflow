import { StyleSheet } from "@react-pdf/renderer";
import { DEFAULT_DESIGN, type DesignKey } from "../designs";
import { PDF_FONT } from "./fonts";

/**
 * The look of a quote document. A design is a set of styles; a sent version records the key of
 * the design it was drawn with (snapshot.design) so a quote never changes when designs do:
 * a design, once released, is never edited, only added to. A snapshot without a design (made
 * before designs existed) is the classic one.
 */

const INK = "#1a1a1a";
const MUTED = "#666666";
const LINE = "#d4d4d4";

export const classicStyles = StyleSheet.create({
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
  colName: { width: "40%", paddingRight: 8 },
  colQty: { width: "20%", textAlign: "right" },
  colPrice: { width: "18%", textAlign: "right" },
  colAmount: { width: "22%", textAlign: "right" },
  description: { color: MUTED, fontSize: 9, marginTop: 1 },
  totals: { marginTop: 10, alignSelf: "flex-end", width: "52%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grandRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, marginTop: 3, borderTopWidth: 1, borderTopColor: INK, fontWeight: 700, fontSize: 12 },
  quoteTitle: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  intro: { marginBottom: 14 },
  notes: { marginTop: 22 },
  label: { fontSize: 8, color: MUTED, textTransform: "uppercase" },
  signOff: { marginTop: 22 },
  signOffName: { fontWeight: 700, marginTop: 2 },
  terms: { marginTop: 18, color: MUTED, fontSize: 9 },
  statement: { marginTop: 18, color: MUTED, fontSize: 9 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: MUTED, flexDirection: "row", justifyContent: "space-between" },
});

type Styles = typeof classicStyles;

const STYLES: Record<DesignKey, Styles> = { classic: classicStyles };

export function designStyles(key: string | undefined): Styles {
  return STYLES[(key ?? DEFAULT_DESIGN) as DesignKey] ?? classicStyles;
}
