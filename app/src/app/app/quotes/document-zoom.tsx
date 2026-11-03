"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { MinusIcon, PlusIcon, ScanIcon, ZoomInIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { drawPdfPages } from "./pdf-draw";
import { clampView, doubleTap, FIT, MAX_SCALE, MIN_SCALE, pan, pinch, STEP, zoomAbout, type Point, type Size, type View } from "./zoom";

export type ZoomSource = { url: string } | { data: Uint8Array };

/**
 * "Zoom in" under a document preview: opens the same document full screen, drawn sharper, to pinch, drag and
 * double-tap (docs/plans/quote-viewer-zoom.md). A separate view, so a pinch never fights with scrolling the page.
 * Buttons and keys do everything the fingers do.
 */
export function ZoomButton({ source, label }: { source: ZoomSource | null; label: string }) {
  const [open, setOpen] = useState(false);
  if (!source) return null;
  return (
    <>
      <Button type="button" variant="outline" className="w-full" onClick={() => setOpen(true)} data-testid="zoom-open">
        <ZoomInIcon aria-hidden /> Zoom in
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="gap-0 overflow-hidden p-0 max-md:data-[side=bottom]:h-dvh md:h-dvh md:max-h-none md:w-screen md:data-[side=bottom]:max-w-none md:rounded-none md:border-0"
        >
          {open && <ZoomView source={source} label={label} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function ZoomView({ source, label }: { source: ZoomSource; label: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [view, setViewState] = useState<View>(FIT);
  const viewRef = useRef<View>(FIT);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const sizes = useCallback((): { window: Size; content: Size } => {
    const v = viewport.current;
    const c = content.current;
    return { window: { w: v?.clientWidth ?? 0, h: v?.clientHeight ?? 0 }, content: { w: c?.offsetWidth ?? 0, h: c?.offsetHeight ?? 0 } };
  }, []);

  const setView = useCallback((next: View) => {
    viewRef.current = next;
    setViewState(next);
  }, []);

  // Draw the pages, sharper than the page behind does.
  useEffect(() => {
    let cancelled = false;
    async function draw() {
      try {
        const element = host.current;
        if (!element) return;
        const count = await drawPdfPages(element, source, label, () => cancelled, undefined, Infinity, true);
        if (count !== null && !cancelled) {
          setReady(true);
          // The document is taller now: keep it where it can be.
          const s = sizes();
          setView(clampView(viewRef.current, s.window, s.content));
        }
      } catch (error) {
        if (cancelled) return;
        console.error("could not draw the zoom view:", error);
        setFailed(true);
      }
    }
    void draw();
    return () => {
      cancelled = true;
    };
  }, [source, label, sizes, setView]);

  // A turned phone or a resized window: keep the document in bounds.
  useLayoutEffect(() => {
    const v = viewport.current;
    const c = content.current;
    if (!v || !c || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const s = sizes();
      setView(clampView(viewRef.current, s.window, s.content));
    });
    observer.observe(v);
    observer.observe(c);
    return () => observer.disconnect();
  }, [sizes, setView]);

  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ view: View; mid: Point; spread: number } | null>(null);
  const drag = useRef<{ view: View; at: Point; moved: boolean } | null>(null);
  const lastTap = useRef<{ time: number; at: Point } | null>(null);

  const local = (event: { clientX: number; clientY: number }): Point => {
    const box = viewport.current!.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  function startGesture() {
    const points = [...pointers.current.values()];
    if (points.length === 2) {
      gesture.current = { view: viewRef.current, mid: { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }, spread: distance(points[0], points[1]) };
      drag.current = null;
    } else if (points.length === 1) {
      gesture.current = null;
      drag.current = { view: viewRef.current, at: points[0], moved: false };
    } else {
      gesture.current = null;
      drag.current = null;
    }
  }

  function onPointerDown(event: React.PointerEvent) {
    viewport.current?.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, local(event));
    startGesture();
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, local(event));
    const s = sizes();
    const points = [...pointers.current.values()];
    if (points.length >= 2 && gesture.current) {
      const g = gesture.current;
      const mid = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
      setView(pinch(g.view, g.mid, g.spread, mid, distance(points[0], points[1]), s.window, s.content));
    } else if (drag.current) {
      const d = drag.current;
      const dx = points[0].x - d.at.x;
      const dy = points[0].y - d.at.y;
      if (Math.hypot(dx, dy) > 6) d.moved = true;
      if (d.moved) setView(pan(d.view, dx, dy, s.window, s.content));
    }
  }

  function onPointerEnd(event: React.PointerEvent) {
    const wasDrag = drag.current;
    const at = pointers.current.get(event.pointerId);
    pointers.current.delete(event.pointerId);
    if (wasDrag && !wasDrag.moved && at && event.type === "pointerup") {
      // A tap. Two close together, in the same place, is a double-tap.
      const now = Date.now();
      const previous = lastTap.current;
      if (previous && now - previous.time < 350 && distance(previous.at, at) < 30) {
        const s = sizes();
        setView(doubleTap(viewRef.current, at, s.window, s.content));
        lastTap.current = null;
      } else {
        lastTap.current = { time: now, at };
      }
    }
    startGesture();
  }

  function zoomBy(factor: number) {
    const s = sizes();
    const centre = { x: s.window.w / 2, y: s.window.h / 2 };
    setView(zoomAbout(viewRef.current, viewRef.current.scale * factor, centre, s.window, s.content));
  }

  // The wheel needs a listener that can stop the page zooming, which React's passive one cannot.
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const s = sizes();
      if (event.ctrlKey) {
        // A trackpad pinch, or Ctrl and scroll.
        const box = element!.getBoundingClientRect();
        const factor = Math.exp(-event.deltaY * 0.01);
        setView(zoomAbout(viewRef.current, viewRef.current.scale * factor, { x: event.clientX - box.left, y: event.clientY - box.top }, s.window, s.content));
      } else {
        setView(pan(viewRef.current, -event.deltaX, -event.deltaY, s.window, s.content));
      }
    }
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [sizes, setView]);

  function onKeyDown(event: React.KeyboardEvent) {
    const s = sizes();
    const step = 80;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (event.key in moves) {
      event.preventDefault();
      const [dx, dy] = moves[event.key];
      setView(pan(viewRef.current, dx, dy, s.window, s.content));
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomBy(STEP);
    } else if (event.key === "-") {
      event.preventDefault();
      zoomBy(1 / STEP);
    } else if (event.key === "0") {
      event.preventDefault();
      setView(clampView(FIT, s.window, s.content));
    }
  }

  // What a screen reader hears when the size changes (the pages are pictures).
  const announce = `Zoom ${Math.round(view.scale * 100)} percent`;

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-popover p-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <SheetTitle className="min-w-0 flex-1 truncate px-1">{label}</SheetTitle>
        <SheetDescription className="sr-only">Pinch, or use the buttons, to zoom. Drag to move around.</SheetDescription>
        <Button type="button" variant="outline" size="icon" aria-label="Zoom out" disabled={view.scale <= MIN_SCALE} onClick={() => zoomBy(1 / STEP)} data-testid="zoom-out">
          <MinusIcon aria-hidden />
        </Button>
        <Button type="button" variant="outline" size="icon" aria-label="Fit to screen" disabled={view.scale <= MIN_SCALE} onClick={() => setView(clampView(FIT, sizes().window, sizes().content))} data-testid="zoom-fit">
          <ScanIcon aria-hidden />
        </Button>
        <Button type="button" variant="outline" size="icon" aria-label="Zoom in" disabled={view.scale >= MAX_SCALE} onClick={() => zoomBy(STEP)} data-testid="zoom-in">
          <PlusIcon aria-hidden />
        </Button>
        <SheetClose render={<Button type="button" variant="default" data-testid="zoom-close" />}>Close</SheetClose>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
      <div
        ref={viewport}
        className="relative min-h-0 flex-1 touch-none overflow-hidden overscroll-none select-none outline-none focus-visible:ring-2 focus-visible:ring-ring"
        tabIndex={0}
        role="group"
        aria-label={`${label}, zoomable`}
        data-testid="zoom-viewport"
        data-scale={view.scale.toFixed(2)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
      >
        {!ready && !failed && <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground" role="status">Drawing your document…</div>}
        {failed && (
          <p className="p-4 text-sm text-destructive" role="alert">
            Couldn&apos;t draw the document here. Close this and download the PDF to see it.
          </p>
        )}
        <div
          ref={content}
          className="w-full origin-top-left p-3 will-change-transform"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        >
          <div ref={host} data-testid="zoom-pages" />
        </div>
      </div>
    </div>
  );
}
