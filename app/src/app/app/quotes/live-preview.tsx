"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import type { PdfWorkerRequest, PdfWorkerResponse } from "@/lib/quotes/pdf/worker";
import type { PdfImage } from "@/lib/quotes/pdf/quote-document";
import type { QuoteSnapshot } from "@/lib/quotes/snapshot";
import { drawPdfPages } from "./pdf-draw";

type Status = "loading" | "ready" | "error";

/** Pictures already fetched, so a new choice never fetches them again. */
const pictures = new Map<string, Promise<PdfImage | null>>();

function picture(id: string, size: "thumb" | "display"): Promise<PdfImage | null> {
  const key = `${id}:${size}`;
  let found = pictures.get(key);
  if (!found) {
    found = fetch(`/app/images/${id}?size=${size}`)
      .then(async (response) => {
        const contentType = response.headers.get("content-type") ?? "";
        // Only pictures the document can draw (the server leaves out anything else).
        if (!response.ok || !/^image\/(jpeg|png)$/.test(contentType)) return null;
        return { contentType, bytes: new Uint8Array(await response.arrayBuffer()) };
      })
      .catch(() => null)
      // A miss is not remembered: the next drawing tries again.
      .then((result) => {
        if (result === null) pictures.delete(key);
        return result;
      });
    pictures.set(key, found);
  }
  return found;
}

/** One worker for the page, made the first time it is needed: it draws the pages off the main thread. */
let worker: Worker | null = null;
let failed = false;
let nextId = 0;
const waiting = new Map<number, { resolve: (data: Uint8Array | null) => void; reject: (error: Error) => void }>();

/** Draws the document in the worker; falls back to the main thread where a worker can't be had. */
async function drawDocument(snapshot: QuoteSnapshot, draft: boolean, images: Map<string, PdfImage>, logo: PdfImage | null): Promise<Uint8Array | null> {
  if (!worker && !failed && typeof Worker !== "undefined") {
    try {
      const made = new Worker(new URL("../../../lib/quotes/pdf/worker.ts", import.meta.url), { type: "module" });
      made.onmessage = (event: MessageEvent<PdfWorkerResponse>) => {
        const entry = waiting.get(event.data.id);
        waiting.delete(event.data.id);
        if (!entry) return;
        if ("error" in event.data) entry.reject(new Error(event.data.error));
        else if ("skipped" in event.data) entry.resolve(null);
        else entry.resolve(event.data.data);
      };
      made.onerror = () => {
        // Give up on the worker for good; whoever is waiting is told, and the next drawing uses the main thread.
        worker = null;
        failed = true;
        for (const entry of waiting.values()) entry.reject(new Error("The drawing worker stopped."));
        waiting.clear();
      };
      worker = made;
    } catch {
      failed = true;
    }
  }
  if (worker && !failed) {
    const id = ++nextId;
    const request: PdfWorkerRequest = { id, snapshot, draft, images: [...images], logo };
    try {
      return await new Promise<Uint8Array | null>((resolve, reject) => {
        waiting.set(id, { resolve, reject });
        worker!.postMessage(request);
      });
    } catch {
      // Fall through to the main thread below.
    }
  }
  const { renderQuotePdfInBrowser } = await import("@/lib/quotes/pdf/browser");
  return renderQuotePdfInBrowser(snapshot, { draft, images, logo });
}

/**
 * The quote's document drawn in the browser from the snapshot, so a change of design shows at once:
 * no save, no page reload and no trip to the server first. It waits a moment after the last change,
 * drops a drawing that has been overtaken, and leaves the old pages up until the new ones are ready.
 * It is the same document code the server uses for the PDF that is downloaded and sent.
 */
export function LivePdfPreview({
  snapshot,
  draft,
  label,
  firstPageOnly = false,
}: {
  snapshot: QuoteSnapshot;
  draft: boolean;
  label: string;
  /** Draw only the first page (the studio keeps it small and pinned). */
  firstPageOnly?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [pages, setPages] = useState(0);
  const [stamp, setStamp] = useState("");
  // What the document is drawn from, as one string, so a change is noticed whatever caused it.
  // The theme's name is never drawn, so renaming one (a keystroke at a time in the studio) draws nothing again.
  const input = JSON.stringify(snapshot.theme ? { ...snapshot, theme: { ...snapshot.theme, name: "" } } : snapshot);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const host = container.current;
        if (!host) return;
        const current: QuoteSnapshot = JSON.parse(input);
        const photoIds = [...new Set(current.lines.flatMap((l) => (l.photoImageId ? [l.photoImageId] : [])))];
        const [logo, ...photos] = await Promise.all([
          current.logoImageId ? picture(current.logoImageId, "display") : Promise.resolve(null),
          ...photoIds.map((id) => picture(id, "thumb")),
        ]);
        if (cancelled) return;
        const images = new Map<string, PdfImage>();
        photoIds.forEach((id, i) => {
          const found = photos[i];
          if (found) images.set(id, found);
        });
        const data = await drawDocument(current, draft, images, logo);
        if (cancelled || data === null) return;
        const count = await drawPdfPages(host, { data }, label, () => cancelled, () => setStatus("ready"), firstPageOnly ? 1 : Infinity);
        if (count !== null) {
          setPages(count);
          setStatus("ready");
          setStamp(`live:${hash(input)}`);
        }
      } catch (error) {
        if (cancelled) return;
        console.error("could not draw the quote preview:", error);
        setStatus("error");
      }
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [input, draft, label, firstPageOnly]);

  return (
    <div className="space-y-3" aria-busy={status === "loading"}>
      {status === "loading" && (
        <Skeleton className="aspect-[1/1.414] w-full rounded-md" aria-label="Drawing your quote…" role="status" />
      )}
      {status === "error" && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            Couldn&apos;t draw the preview here. Download the PDF to see it.
          </AlertDescription>
        </Alert>
      )}
      <div ref={container} data-pages={pages} data-url={stamp} data-testid="pdf-pages" />
    </div>
  );
}

/** A short fingerprint of a string (to tell one drawing from another; not for security). */
function hash(value: string): string {
  let h = 5381;
  for (let i = 0; i < value.length; i++) h = ((h << 5) + h + value.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
