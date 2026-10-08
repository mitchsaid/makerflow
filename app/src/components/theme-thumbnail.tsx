import type { CSSProperties } from "react";
import type { Theme } from "@/lib/quotes/themes";

/**
 * Miniatures of a quote drawn in plain boxes from the same resolved theme the PDF uses, so what the
 * cards show is what a choice does: a whole page (`ThemeThumbnail`) or one part of it (`MiniHeader`,
 * `MiniItems`, `MiniTotals`) for the option cards in the studio. Decorative: the choice's name sits
 * beside it, so they are hidden from screen readers.
 */

const bar = (width: string | number, height: number, colour: string, opacity = 1, radius = 1): CSSProperties => ({
  width,
  height,
  background: colour,
  opacity,
  borderRadius: radius,
  flexShrink: 0,
});

const PHOTO = { small: 9, large: 15 } as const;

function Photo({ theme, size }: { theme: Theme; size: number }) {
  const r = theme.photoShape === "round" ? size / 2 : theme.photoShape === "rounded" ? size / 4 : 0;
  return <div style={{ width: size, height: size, background: theme.accent, opacity: 0.35, borderRadius: r, flexShrink: 0 }} />;
}

export function MiniHeader({ theme }: { theme: Theme }) {
  const band = theme.header === "band";
  const text = band ? theme.onAccent : theme.ink;
  const centred = theme.headerAlign === "center";
  const showLogo = theme.headerLogo !== "name";
  const showName = theme.headerLogo !== "logo";
  const serif = theme.headingFont === "serif";
  const heading = (width: string) => <div style={bar(width, 4, text, 1, serif ? 0 : 1)} />;
  const outer: CSSProperties = {
    position: "relative",
    background: band ? theme.accent : undefined,
    border: theme.header === "boxed" ? `1px solid ${theme.accentInk}` : undefined,
    borderRadius: theme.header === "boxed" ? Math.min(theme.radius, 6) : 0,
    padding: band ? "6px 6px 5px" : theme.header === "boxed" ? "4px 5px" : theme.header === "bar" ? "4px 0 0" : 0,
  };
  return (
    <div style={outer}>
      {theme.header === "bar" && <div style={{ position: "absolute", top: -7, left: -7, right: -7, height: 3, background: theme.accent }} />}
      {centred ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          {showLogo && <div style={{ ...bar(14, 7, band ? "#ffffff" : theme.accent, band ? 1 : 0.5, 1) }} />}
          {showName && heading("46%")}
          <div style={bar("38%", 2, text, 0.5)} />
          <div style={bar("26%", 4, band ? theme.onAccent : theme.accentInk, 1, serif ? 0 : 1)} />
        </div>
      ) : (
        <>
          {showLogo && <div style={{ ...bar(14, 7, band ? "#ffffff" : theme.accent, band ? 1 : 0.5, 1), marginBottom: 3 }} />}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, width: "52%" }}>
              {showName && heading("80%")}
              <div style={bar("62%", 2, text, 0.5)} />
            </div>
            <div style={bar("28%", 5, band ? theme.onAccent : theme.accentInk, 1, serif ? 0 : 1)} />
          </div>
        </>
      )}
    </div>
  );
}

export function MiniItems({ theme, count = 3 }: { theme: Theme; count?: number }) {
  const r = Math.min(theme.radius, 6) / 2;
  const row = { compact: 7, comfortable: 9, airy: 13 }[theme.density];
  const inset = theme.tableHead === "tint" || theme.tableHead === "filled" || theme.rows === "zebra" || theme.rows === "grid" ? 3 : 0;
  const photo = theme.photo === "none" ? 0 : PHOTO[theme.photo];
  const items = Array.from({ length: count }, (_, i) => i);
  const cols = (strong = false) => (
    <>
      {theme.showQty && <div style={bar("10%", 2, theme.ink, 0.6)} />}
      {theme.showUnitPrice && <div style={bar("14%", 2, theme.ink, 0.6)} />}
      <div style={bar("16%", 2, theme.ink, strong ? 0.9 : 0.7)} />
    </>
  );

  if (theme.layout === "table") {
    return (
      <div style={{ border: theme.rows === "grid" ? `1px solid ${theme.line}` : undefined, borderRadius: theme.rows === "grid" ? r : 0, display: "flex", flexDirection: "column" }}>
        {theme.tableHead !== "none" && (
          <div
            style={{
              height: 7,
              padding: `0 ${inset}px`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: theme.tableHead === "line" ? `1px solid ${theme.accentInk}` : undefined,
              background: theme.tableHead === "filled" ? theme.accent : theme.tableHead === "tint" ? theme.tint : undefined,
              borderRadius: theme.tableHead === "line" ? 0 : r,
            }}
          >
            <div style={bar("16%", 2, theme.tableHead === "filled" ? theme.onAccent : theme.accentInk, 0.9)} />
          </div>
        )}
        {items.map((i) => (
          <div
            key={i}
            style={{
              height: row,
              padding: `0 ${inset}px`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              borderBottom: theme.rows === "lines" || theme.rows === "grid" ? `1px solid ${theme.line}` : undefined,
              background: theme.rows === "zebra" && i % 2 === 1 ? theme.tintStrong : undefined,
              borderRadius: theme.rows === "zebra" ? r : 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 2, flex: 1 }}>
              {theme.numbered && <div style={bar(3, 2, theme.ink, 0.4)} />}
              {photo > 0 && <Photo theme={theme} size={Math.min(photo, row - 2)} />}
              <div style={bar("46%", 2, theme.ink, 0.75)} />
            </div>
            {cols()}
          </div>
        ))}
      </div>
    );
  }

  if (theme.layout === "list") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: theme.rows === "grid" ? 2 : 0 }}>
        {items.map((i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              padding: `${row / 4}px ${inset}px`,
              // Never both the shorthand and a single side: React warns when one is removed on a redraw.
              ...(theme.rows === "grid" ? { border: `1px solid ${theme.line}` } : { borderBottom: theme.rows === "lines" ? `1px solid ${theme.line}` : "0 solid transparent" }),
              background: theme.rows === "zebra" && i % 2 === 1 ? theme.tintStrong : undefined,
              borderRadius: theme.rows === "zebra" || theme.rows === "grid" ? r : 0,
            }}
          >
            {photo > 0 && <Photo theme={theme} size={photo} />}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1.5 }}>
              <div style={bar("52%", 2.5, theme.ink, 0.85)} />
              <div style={bar("34%", 1.5, theme.ink, 0.45)} />
            </div>
            <div style={bar("14%", 2.5, theme.ink, 0.9)} />
          </div>
        ))}
      </div>
    );
  }

  if (theme.layout === "cards") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: row / 4 + 1 }}>
        {items.map((i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              padding: 3,
              border: `1px solid ${theme.line}`,
              borderRadius: Math.max(r, 1.5),
              background: theme.rows === "zebra" && i % 2 === 1 ? theme.tintStrong : undefined,
            }}
          >
            {photo > 0 && <Photo theme={theme} size={photo + 3} />}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1.5 }}>
              <div style={bar("50%", 2.5, theme.ink, 0.85)} />
              <div style={bar("30%", 1.5, theme.ink, 0.45)} />
            </div>
            <div style={bar("14%", 2.5, theme.ink, 0.9)} />
          </div>
        ))}
      </div>
    );
  }

  // Showcase: a large picture beside the details.
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: row / 3 + 1 }}>
      {items.slice(0, 2).map((i) => (
        <div key={i} style={{ display: "flex", gap: 3, paddingBottom: 2, borderBottom: theme.rows === "lines" || theme.rows === "grid" ? `1px solid ${theme.line}` : undefined }}>
          {theme.photo !== "none" && <Photo theme={theme} size={theme.photo === "large" ? 22 : 16} />}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1.5, justifyContent: "center" }}>
            <div style={bar("52%", 3, theme.ink, 0.9, theme.headingFont === "serif" ? 0 : 1)} />
            <div style={bar("70%", 1.5, theme.ink, 0.45)} />
            <div style={{ ...bar("16%", 2.5, theme.ink, 0.9), alignSelf: "flex-end" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MiniTotals({ theme }: { theme: Theme }) {
  const solid = theme.totals === "solid" || theme.totals === "pill";
  const r = Math.min(theme.radius, 6) / 2;
  return (
    <div style={{ alignSelf: "flex-end", width: "52%", display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div style={bar("38%", 1.5, theme.ink, 0.5)} />
        <div style={bar("24%", 1.5, theme.ink, 0.5)} />
      </div>
      <div
        style={{
          height: 9,
          padding: "0 3px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: theme.totals === "rule" ? `1px solid ${theme.accentInk}` : undefined,
          background: solid ? theme.accent : theme.totals === "tint" ? theme.tint : undefined,
          borderRadius: theme.totals === "rule" ? 0 : theme.totals === "pill" ? 9 : r,
        }}
      >
        <div style={bar("34%", 2.5, solid ? theme.onAccent : theme.ink)} />
        <div style={bar("26%", 2.5, solid ? theme.onAccent : theme.ink)} />
      </div>
    </div>
  );
}

/** A whole page in miniature. */
export function ThemeThumbnail({ theme }: { theme: Theme }) {
  const band = theme.header === "band";
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
      <MiniHeader theme={theme} />
      <div style={{ padding: band ? "0 7px" : 0, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={bar("22%", 2, theme.accentInk, 0.8)} />
          <div style={bar("45%", 2, theme.ink, 0.6)} />
        </div>
        <MiniItems theme={theme} />
        <div style={{ marginTop: "auto" }}>
          <MiniTotals theme={theme} />
        </div>
        <div style={{ height: 3 }} />
      </div>
    </div>
  );
}
