"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

type Status = "loading" | "ready" | "error";

/**
 * The quote's real PDF, drawn page by page on the screen (pdf.js), so what you see is exactly
 * what is downloaded or sent, and every design shows up here without a second copy of the
 * layout. The PDF comes from the server (a draft's preview or a sent version's frozen
 * document). pdf.js is loaded only when this screen is opened. The pages are pictures, so a
 * text version of the same document is kept for screen readers by the page around it.
 */
export function PdfPreview({ url, label }: { url: string; label: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [pages, setPages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | null = null;

    async function draw() {
      try {
        // The legacy build runs on older phones too.
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const task = pdfjs.getDocument({ url });
        destroy = () => void task.destroy();
        const pdf = await task.promise;
        if (cancelled) return;
        const host = container.current;
        if (!host) return;
        host.replaceChildren();
        setPages(pdf.numPages);

        const width = host.clientWidth || 360;
        const ratio = Math.min(window.devicePixelRatio || 1, 2.5);
        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width / base.width) * ratio });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.className = "block w-full rounded-md bg-white shadow-sm ring-1 ring-foreground/15";
          canvas.setAttribute("role", "img");
          canvas.setAttribute("aria-label", `${label}, page ${n} of ${pdf.numPages}`);
          canvas.dataset.testid = "pdf-page";
          const wrapper = document.createElement("div");
          wrapper.className = "mb-3";
          wrapper.appendChild(canvas);
          host.appendChild(wrapper);
          const context = canvas.getContext("2d");
          if (!context) throw new Error("no canvas");
          await page.render({ canvasContext: context, canvas, viewport }).promise;
        }
        if (!cancelled) setStatus("ready");
      } catch (error) {
        if (cancelled) return;
        console.error("could not draw the quote preview:", error);
        setStatus("error");
      }
    }
    void draw();
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [url, label]);

  return (
    <div className="space-y-3" aria-busy={status === "loading"}>
      {status === "loading" && (
        <Skeleton className="aspect-[1/1.414] w-full rounded-md" aria-label="Drawing your quote…" role="status" />
      )}
      {status === "error" && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            Couldn&apos;t draw the preview here.{" "}
            <a href={url} target="_blank" rel="noopener" className="font-medium underline">
              Open the PDF
            </a>{" "}
            to see it.
          </AlertDescription>
        </Alert>
      )}
      <div ref={container} data-pages={pages} data-testid="pdf-pages" className={status === "error" ? "hidden" : ""} />
    </div>
  );
}
