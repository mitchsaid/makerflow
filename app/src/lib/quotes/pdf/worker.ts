/// <reference lib="webworker" />
import type { QuoteSnapshot } from "../snapshot";
import { renderQuotePdfInBrowser } from "./browser";
import type { PdfImage } from "./quote-document";

/**
 * The quote document drawn off the main thread, so a tap on the screen is never held up by laying out
 * the pages. One request at a time comes in as a message; the PDF's bytes go back.
 */
export type PdfWorkerRequest = {
  id: number;
  snapshot: QuoteSnapshot;
  draft: boolean;
  images: [string, PdfImage][];
  logo: PdfImage | null;
  background: PdfImage | null;
};
export type PdfWorkerResponse = { id: number; data: Uint8Array } | { id: number; skipped: true } | { id: number; error: string };

/** The newest request seen: an older one still waiting its turn is skipped, not drawn for nothing. */
let newest = 0;

self.onmessage = async (event: MessageEvent<PdfWorkerRequest>) => {
  const { id, snapshot, draft, images, logo, background } = event.data;
  newest = Math.max(newest, id);
  // Let any messages that arrived while the last drawing ran be counted first.
  await new Promise((resolve) => setTimeout(resolve, 0));
  if (id < newest) return (self as unknown as Worker).postMessage({ id, skipped: true } satisfies PdfWorkerResponse);
  try {
    const data = await renderQuotePdfInBrowser(snapshot, { draft, images: new Map(images), logo, background });
    (self as unknown as Worker).postMessage({ id, data } satisfies PdfWorkerResponse, [data.buffer]);
  } catch (error) {
    (self as unknown as Worker).postMessage({ id, error: String(error) } satisfies PdfWorkerResponse);
  }
};
