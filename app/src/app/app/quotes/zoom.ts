/**
 * The maths of the zoom view: where the document sits (`x`, `y`) and how big it is drawn (`scale`) inside a
 * window of a given size. Kept apart from the gestures so it can be tested without a browser.
 */
export type View = { scale: number; x: number; y: number };
export type Size = { w: number; h: number };
export type Point = { x: number; y: number };

export const MIN_SCALE = 1;
export const MAX_SCALE = 5;
/** Where a double-tap goes in to. */
export const DOUBLE_TAP_SCALE = 2.5;
/** What the + and − buttons multiply by. */
export const STEP = 1.5;

export const FIT: View = { scale: 1, x: 0, y: 0 };

/** One axis: smaller than the window, centred; bigger, never leaving a gap at either edge. */
function clampAxis(offset: number, content: number, window: number): number {
  if (content <= window) return (window - content) / 2;
  return Math.min(0, Math.max(window - content, offset));
}

/** The view kept inside the limits: a scale from 1 to 5, and the document never dragged away from the window. */
export function clampView(view: View, window: Size, content: Size): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale));
  return {
    scale,
    x: clampAxis(view.x, content.w * scale, window.w),
    y: clampAxis(view.y, content.h * scale, window.h),
  };
}

/** A new scale with the point under `focal` (in window coordinates) staying under it: zooming into what you touch. */
export function zoomAbout(view: View, nextScale: number, focal: Point, window: Size, content: Size): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
  const ratio = scale / view.scale;
  return clampView({ scale, x: focal.x - (focal.x - view.x) * ratio, y: focal.y - (focal.y - view.y) * ratio }, window, content);
}

/**
 * A pinch: the two fingers started `startDistance` apart around `startMid` with the view `start`; now they are
 * `distance` apart around `mid`. The scale follows the spread, and the part of the document that was between the
 * fingers stays between them as they move.
 */
export function pinch(start: View, startMid: Point, startDistance: number, mid: Point, distance: number, window: Size, content: Size): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, start.scale * (distance / Math.max(startDistance, 1))));
  const pointX = (startMid.x - start.x) / start.scale;
  const pointY = (startMid.y - start.y) / start.scale;
  return clampView({ scale, x: mid.x - pointX * scale, y: mid.y - pointY * scale }, window, content);
}

/** A double-tap: in at the tap if it is fitted (or nearly), back to fitted if it is already in. */
export function doubleTap(view: View, at: Point, window: Size, content: Size): View {
  return view.scale > 1.05 ? clampView(FIT, window, content) : zoomAbout(view, DOUBLE_TAP_SCALE, at, window, content);
}

/** Moved by a drag or the arrow keys. */
export function pan(view: View, dx: number, dy: number, window: Size, content: Size): View {
  return clampView({ ...view, x: view.x + dx, y: view.y + dy }, window, content);
}
