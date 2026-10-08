"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { drawPdfPages } from "./pdf-draw";

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

    async function draw() {
      try {
        const host = container.current;
        if (!host) return;
        const count = await drawPdfPages(host, { url }, label, () => cancelled, () => setStatus("ready"));
        if (count !== null) {
          setPages(count);
          setStatus("ready");
        }
      } catch (error) {
        if (cancelled) return;
        console.error("could not draw the quote preview:", error);
        setStatus("error");
      }
    }
    void draw();
    return () => {
      cancelled = true;
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
      <div ref={container} data-pages={pages} data-url={url} data-testid="pdf-pages" className={status === "error" ? "hidden" : ""} />
    </div>
  );
}
