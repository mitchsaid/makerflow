import { describe, expect, it } from "vitest";
import { clampView, doubleTap, FIT, MAX_SCALE, pan, pinch, zoomAbout } from "../zoom";

const window = { w: 400, h: 800 };
// Two pages stacked, a little taller than the window.
const content = { w: 400, h: 1200 };

describe("zoom view maths", () => {
  it("never zooms out past fitted or in past the limit", () => {
    expect(clampView({ scale: 0.3, x: 0, y: 0 }, window, content).scale).toBe(1);
    expect(clampView({ scale: 99, x: 0, y: 0 }, window, content).scale).toBe(MAX_SCALE);
  });

  it("centres a document that is smaller than the window, and keeps a bigger one covering it", () => {
    expect(clampView(FIT, { w: 400, h: 2000 }, content)).toEqual({ scale: 1, x: 0, y: 400 });
    const dragged = clampView({ scale: 2, x: 500, y: 500 }, window, content);
    expect(dragged.x).toBe(0);
    expect(dragged.y).toBe(0);
    const far = clampView({ scale: 2, x: -9999, y: -9999 }, window, content);
    expect(far.x).toBe(400 - 800);
    expect(far.y).toBe(800 - 2400);
  });

  it("zooms into the point touched: it stays under the finger", () => {
    const at = { x: 300, y: 200 };
    const next = zoomAbout(FIT, 2, at, window, content);
    // The document point under the finger before: (300, 200). After: x * 2 + offset = 300.
    expect(300 * next.scale + next.x).toBeCloseTo(300);
    expect(200 * next.scale + next.y).toBeCloseTo(200);
  });

  it("follows a pinch: spreading zooms in, the middle can move, closing zooms out", () => {
    const start = FIT;
    const spread = pinch(start, { x: 200, y: 300 }, 100, { x: 200, y: 300 }, 250, window, content);
    expect(spread.scale).toBeCloseTo(2.5);
    expect(200 * spread.scale + spread.x).toBeCloseTo(200);
    // The fingers slide right as they spread: the same part of the page stays between them.
    const slid = pinch(start, { x: 200, y: 300 }, 100, { x: 260, y: 300 }, 200, window, content);
    expect(200 * slid.scale + slid.x).toBeCloseTo(260);
    expect(pinch(spread, { x: 200, y: 300 }, 250, { x: 200, y: 300 }, 10, window, content).scale).toBe(1);
  });

  it("double-tap goes in at the tap, and out again to fitted", () => {
    const zoomed = doubleTap(FIT, { x: 100, y: 100 }, window, content);
    expect(zoomed.scale).toBe(2.5);
    expect(doubleTap(zoomed, { x: 100, y: 100 }, window, content)).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it("pans, stopping at the edges", () => {
    const zoomed = zoomAbout(FIT, 2, { x: 0, y: 0 }, window, content);
    expect(pan(zoomed, -50, -50, window, content)).toEqual({ scale: 2, x: -50, y: -50 });
    expect(pan(zoomed, 50, 50, window, content)).toEqual(zoomed);
    expect(pan(zoomed, -5000, 0, window, content).x).toBe(-400);
  });
});
