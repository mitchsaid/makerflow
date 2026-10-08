import { StyleSheet } from "@react-pdf/renderer";
import type { Theme } from "../themes";
import { PDF_FONT, PDF_FONT_SERIF } from "./fonts";

/**
 * The look of a quote document, drawn from a resolved theme (see ../designs.ts): the design the
 * maker picked, their brand colour and anything they changed, all worked out into plain values and
 * frozen into a sent version, so a quote never changes when a design or the brand colour does. A
 * snapshot without a theme (sent before themes existed) is drawn as the classic design.
 *
 * Classic is refined in place while MakerFlow has no real customers: the content and the numbers on
 * a document never change, only how they are laid out.
 *
 * One scale keeps every design consistent. Type: 8 (section labels), 9 (small print, descriptions),
 * 10 (body), 12 (grand total, quote title), 16 (business name), 20 (document title). Space: 20 between
 * sections, 16 around the table and parties, 8 to 12 inside a block, 2 to 6 between rows, with 44 as the
 * page margin. A design changes colour, headings, the top of the page, the table, the totals, the
 * corners and the paper, and nothing about what goes where.
 */

/** The page margin, shared by the page, the footer and anything that must line up with it. */
export const MARGIN = 44;

/** The item table's columns. The totals sit under the last two, so they line up with them. */
const COL_QTY = "18%";
const COL_PRICE = "20%";
const COL_AMOUNT = "20%";
const TOTALS_WIDTH = "40%";

export function makeStyles(theme: Theme) {
  const heading = theme.headingFont === "serif" ? PDF_FONT_SERIF : PDF_FONT;
  const body = theme.bodyFont === "serif" ? PDF_FONT_SERIF : PDF_FONT;
  const centred = theme.headerAlign === "center";
  /** Space above and below an item, by how airy the theme is. */
  const pad = { compact: 3.5, comfortable: theme.rows === "none" ? 8 : 6, airy: 10 }[theme.density];
  const cardGap = { compact: 5, comfortable: 8, airy: 12 }[theme.density];
  const grid = theme.layout === "table" && theme.rows === "grid";
  const noHead = theme.tableHead === "none";
  const neutral = theme.accent === theme.ink || theme.accent === "#1a1a1a";
  /** The colour of small section labels and the rules that carry the accent. */
  const labelColour = neutral ? theme.muted : theme.accentInk;
  const ruleColour = neutral ? theme.ink : theme.accentInk;
  // Shaded or filled blocks need their text pulled in from the edge, and everything in the table and
  // the totals shares the same inset so that columns and amounts still line up.
  const inset =
    theme.tableHead === "tint" || theme.tableHead === "filled" || theme.rows === "zebra" || theme.rows === "grid" || theme.totals !== "rule" ? 10 : 0;
  const onBand = theme.header === "band";
  const band = onBand ? theme.onAccent : theme.ink;

  const headFilled = theme.tableHead === "filled";
  const headTint = theme.tableHead === "tint";
  const headText = headFilled ? theme.onAccent : headTint ? theme.accentInk : labelColour;

  return StyleSheet.create({
    // No line height anywhere: the font's own spacing is right, and a page-wide line height makes
    // the page number in the footer vanish (a react-pdf quirk).
    page: {
      paddingTop: MARGIN,
      paddingHorizontal: MARGIN,
      paddingBottom: 70,
      fontSize: 10,
      fontFamily: body,
      color: theme.ink,
      backgroundColor: theme.paper,
    },
    banner: { backgroundColor: "#fff4d6", color: "#6b4e00", padding: 6, marginBottom: 16, fontSize: 9, textAlign: "center" },

    // A line of colour across the very top of every page (header "bar").
    topBar: { position: "absolute", top: 0, left: 0, right: 0, height: 7, backgroundColor: theme.accent },
    // The top of page one (header "band"): the colour runs to the page edges and the text on it is reversed.
    band: {
      marginTop: -MARGIN,
      marginHorizontal: -MARGIN,
      paddingTop: 38,
      paddingBottom: 22,
      paddingHorizontal: MARGIN,
      marginBottom: 4,
      backgroundColor: theme.accent,
      color: band,
    },

    // The top of the page: the business and the kind of document on one line (their baselines
    // match), the business's details and the number beneath, then who it is for and the dates.
    logoBox: { marginBottom: 12, alignSelf: centred ? "center" : "flex-start" },
    // The header inside a frame of the accent colour.
    boxedHeader: { borderWidth: 1, borderColor: ruleColour, borderRadius: Math.max(theme.radius, 0), padding: 14, marginBottom: 4 },
    // Centred: everything stacked in the middle.
    centredHeader: { alignItems: "center", textAlign: "center" },
    centredName: { fontSize: 18, fontWeight: 700, fontFamily: heading, marginBottom: 4, textAlign: "center" },
    centredTitle: { fontSize: 20, fontWeight: 700, fontFamily: heading, marginTop: 10, textAlign: "center", color: onBand ? theme.onAccent : neutral ? theme.ink : theme.accentInk },
    centredNumber: { fontWeight: 700, marginTop: 2, textAlign: "center" },
    // On a band the logo sits on a white tile, so a dark logo never disappears into the colour.
    logoTile: { marginBottom: 12, alignSelf: centred ? "center" : "flex-start", backgroundColor: "#ffffff", padding: 6, borderRadius: Math.max(theme.radius, 2) },
    logo: { maxHeight: 48, maxWidth: 160, objectFit: "contain", objectPosition: "left" },
    headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
    headerDetails: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
    headerLeft: { width: "55%" },
    // A long name wraps inside this box and never pushes the title off the page.
    businessNameBox: { flexShrink: 1, maxWidth: "62%", paddingRight: 12 },
    businessName: { fontSize: 16, fontWeight: 700, fontFamily: heading },
    title: { fontSize: 20, fontWeight: 700, flexShrink: 0, fontFamily: heading, color: onBand ? theme.onAccent : neutral ? theme.ink : theme.accentInk },
    number: { fontWeight: 700 },
    partiesRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
    party: { width: "55%" },
    partyName: { fontWeight: 700 },
    deliverTo: { marginTop: 8 },
    // Starts level with the customer's name (below the "Prepared for" label).
    meta: { width: TOTALS_WIDTH, marginTop: 15 },
    metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
    muted: { color: theme.muted },

    // Every heading above a block of text: small, capital letters.
    label: { fontSize: 8, color: labelColour, textTransform: "uppercase", letterSpacing: 0.6 },
    sectionLabel: { fontSize: 8, color: labelColour, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 },

    intro: { marginTop: 20 },
    quoteTitle: { fontSize: 12, fontWeight: 700, marginBottom: 2, fontFamily: heading },

    table: {
      marginTop: 16,
      ...(grid ? { borderWidth: 0.5, borderColor: theme.line, borderRadius: theme.radius } : {}),
    },
    tableHead: {
      flexDirection: "row",
      paddingHorizontal: inset,
      paddingTop: headFilled || headTint ? 6 : 0,
      paddingBottom: headFilled || headTint ? 6 : 5,
      borderBottomWidth: headFilled || headTint ? 0 : 1,
      borderBottomColor: ruleColour,
      backgroundColor: headFilled ? theme.accent : headTint ? theme.tint : undefined,
      borderRadius: headFilled || headTint ? theme.radius : 0,
    },
    tableHeadText: { fontSize: 8, color: headText, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: headFilled ? 700 : 400 },
    row: {
      flexDirection: "row",
      paddingVertical: pad,
      paddingHorizontal: inset,
      borderBottomWidth: theme.rows === "lines" || theme.rows === "grid" ? 0.5 : 0,
      borderBottomColor: theme.line,
      borderRadius: theme.rows === "zebra" ? theme.radius : 0,
    },
    rowShaded: { backgroundColor: theme.tintStrong },
    // Without a heading, a table with only space or shade between rows still wants a line to start from.
    rowFirst: noHead && theme.rows !== "grid" ? { borderTopWidth: 0.5, borderTopColor: theme.line } : {},
    colNo: { width: 20, paddingRight: 6, color: theme.muted },
    colName: { flex: 1, paddingRight: 10 },
    colQty: { width: COL_QTY, textAlign: "right", paddingRight: 10 },
    colPrice: { width: COL_PRICE, textAlign: "right", paddingRight: 10 },
    colAmount: { width: COL_AMOUNT, textAlign: "right" },
    // The full grid draws a line between the columns too.
    cellGrid: { borderRightWidth: 0.5, borderRightColor: theme.line },
    nameRow: { flexDirection: "row" },
    nameText: { flex: 1 },
    description: { color: theme.muted, fontSize: 9, marginTop: 2 },
    itemName: { fontWeight: 700 },

    // A list: the name and its details on the left, the amount on the right, one item under another.
    listItem: {
      flexDirection: "row",
      paddingVertical: pad,
      paddingHorizontal: inset,
      borderBottomWidth: theme.rows === "lines" ? 0.5 : 0,
      borderBottomColor: theme.line,
      ...(theme.rows === "grid" ? { borderWidth: 0.5, borderColor: theme.line, borderRadius: theme.radius, marginBottom: cardGap / 2 } : {}),
      borderRadius: theme.rows === "zebra" || theme.rows === "grid" ? theme.radius : 0,
    },
    listAmount: { fontWeight: 700, textAlign: "right", paddingLeft: 10 },
    itemMeta: { color: theme.muted, fontSize: 9, marginTop: 2 },

    // Cards: each item in its own box.
    card: {
      flexDirection: "row",
      borderWidth: 0.75,
      borderColor: theme.line,
      borderRadius: Math.max(theme.radius, 2),
      padding: 10,
      marginBottom: cardGap,
      backgroundColor: theme.rows === "zebra" ? theme.tintStrong : undefined,
    },
    cardBody: { flex: 1 },
    cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 },

    // Showcase: a large picture beside the details, with space between items.
    showcaseItem: {
      flexDirection: "row",
      paddingBottom: cardGap + 4,
      marginBottom: cardGap + 4,
      borderBottomWidth: theme.rows === "lines" || theme.rows === "grid" ? 0.5 : 0,
      borderBottomColor: theme.line,
    },
    showcaseName: { fontSize: 12, fontWeight: 700, fontFamily: heading },

    totals: { marginTop: 8, alignSelf: "flex-end", width: TOTALS_WIDTH },
    totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5, paddingHorizontal: inset },
    totalLabel: { flexShrink: 1, paddingRight: 10 },
    grandRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      paddingTop: 6,
      paddingBottom: theme.totals === "rule" ? 2 : 6,
      paddingHorizontal: inset,
      marginTop: 4,
      borderTopWidth: theme.totals === "rule" ? 1 : 0,
      borderTopColor: ruleColour,
      backgroundColor: theme.totals === "solid" || theme.totals === "pill" ? theme.accent : theme.totals === "tint" ? theme.tint : undefined,
      borderRadius: theme.totals === "rule" ? 0 : theme.totals === "pill" ? 20 : theme.radius,
      color: theme.totals === "solid" || theme.totals === "pill" ? theme.onAccent : theme.totals === "tint" ? theme.accentInk : theme.ink,
      fontWeight: 700,
      fontSize: 12,
      fontFamily: heading,
    },
    depositBlock: {
      marginTop: 12,
      alignSelf: "flex-end",
      width: "48%",
      backgroundColor: theme.tint,
      borderRadius: Math.min(theme.radius, 8),
      paddingVertical: 6,
      // The rows inside carry their own inset when the design has one.
      paddingHorizontal: inset > 0 ? 0 : 8,
    },
    bold: { fontWeight: 700 },

    // Blocks of text under the table. Each is the same distance from the one above.
    section: { marginTop: 20 },
    bankColumns: { flexDirection: "row" },
    bankColumn: { width: "50%", paddingRight: 12 },
    bankColumnFull: { width: "100%" },
    bankRow: { flexDirection: "row", paddingVertical: 1.5 },
    bankLabel: { width: 94, flexShrink: 0, color: theme.muted },
    bankValue: { fontWeight: 700, flexShrink: 1 },
    payOther: { marginTop: 6 },
    signOff: { marginTop: 20 },
    signOffName: { fontWeight: 700, marginTop: 2, fontFamily: heading },

    // The small print: policies, other terms and the tax statement, all at the same small size.
    smallPrint: { fontSize: 9, marginTop: 20 },
    policy: { marginBottom: 8 },
    policyTitle: { fontWeight: 700 },
    terms: { fontSize: 9, color: theme.muted, marginTop: 8 },
    termsAlone: { fontSize: 9, color: theme.muted, marginTop: 20 },
    statement: { fontSize: 9, color: theme.muted, marginTop: 16 },

    footer: {
      position: "absolute",
      bottom: 26,
      left: MARGIN,
      right: MARGIN,
      paddingTop: 6,
      borderTopWidth: 0.5,
      borderTopColor: theme.line,
      fontSize: 8,
      color: theme.muted,
      flexDirection: "row",
      justifyContent: "space-between",
    },
  });
}

export type Styles = ReturnType<typeof makeStyles>;
