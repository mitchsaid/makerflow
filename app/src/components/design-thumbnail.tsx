import type { Theme } from "@/lib/quotes/designs";

/**
 * A miniature of a quote in a design, drawn in plain boxes from the same resolved theme the PDF uses,
 * so the choices on screen are the real ones: the top of the page, the table heading and rows, and the
 * total. Decorative (the design's name and description are beside it), so it is hidden from screen
 * readers.
 */
export function DesignThumbnail({ theme }: { theme: Theme }) {
  const r = Math.min(theme.radius, 6) / 2;
  const bar = (width: string, height = 3, colour = theme.ink, opacity = 1) => (
    <div style={{ width, height, background: colour, opacity, borderRadius: 1 }} />
  );
  const band = theme.header === "band";
  const headText = band ? theme.onAccent : theme.ink;
  const headingRadius = theme.headingFont === "serif" ? 0 : 1;
  const inset = theme.tableHead !== "line" || theme.rows === "zebra" || theme.totals !== "rule" ? 4 : 0;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "3 / 4",
        background: theme.paper,
        border: `1px solid ${theme.line}`,
        borderRadius: 4,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: band ? 0 : 7,
      }}
    >
      {theme.header === "bar" && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: theme.accent }} />}
      <div
        style={{
          background: band ? theme.accent : undefined,
          padding: band ? "8px 7px 6px" : theme.header === "bar" ? "3px 0 0" : 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2, width: "50%" }}>
          <div style={{ width: "80%", height: 5, background: headText, borderRadius: headingRadius }} />
          {bar("60%", 2, headText, 0.5)}
        </div>
        <div style={{ width: "30%", height: 6, background: band ? theme.onAccent : theme.key === "classic" ? theme.ink : theme.accentInk, borderRadius: headingRadius }} />
      </div>
      <div style={{ padding: band ? "0 7px" : 0, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {bar("22%", 2, theme.accentInk, 0.8)}
          {bar("45%", 2, theme.ink, 0.6)}
        </div>
        <div
          style={{
            height: 8,
            padding: `0 ${inset}px`,
            borderBottom: theme.tableHead === "line" ? `1px solid ${theme.accentInk}` : undefined,
            background: theme.tableHead === "filled" ? theme.accent : theme.tableHead === "tint" ? theme.tint : undefined,
            borderRadius: theme.tableHead === "line" ? 0 : r,
          }}
        />
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              height: 9,
              padding: `0 ${inset}px`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: theme.rows === "lines" ? `1px solid ${theme.line}` : undefined,
              background: theme.rows === "zebra" && i % 2 === 1 ? theme.tintStrong : undefined,
              borderRadius: theme.rows === "zebra" ? r : 0,
            }}
          >
            {bar("40%", 2, theme.ink, 0.7)}
            {bar("14%", 2, theme.ink, 0.7)}
          </div>
        ))}
        <div style={{ alignSelf: "flex-end", width: "52%", marginTop: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
          <div
            style={{
              height: 10,
              padding: `0 ${inset ? 3 : 0}px`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderTop: theme.totals === "rule" ? `1px solid ${theme.accentInk}` : undefined,
              background: theme.totals === "solid" ? theme.accent : theme.totals === "tint" ? theme.tint : undefined,
              borderRadius: theme.totals === "rule" ? 0 : r,
            }}
          >
            {bar("34%", 2, theme.totals === "solid" ? theme.onAccent : theme.ink)}
            {bar("26%", 2, theme.totals === "solid" ? theme.onAccent : theme.ink)}
          </div>
        </div>
        <div style={{ height: 3 }} />
      </div>
    </div>
  );
}
