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
};
export type PdfWorkerResponse = { id: number; data: Uint8Array } | { id: number; error: string };

self.onmessage = async (event: MessageEvent<PdfWorkerRequest>) => {
  const { id, snapshot, draft, images, logo } = event.data;
  try {
    const data = await renderQuotePdfInBrowser(snapshot, { draft, images: new Map(images), logo });
    (self as unknown as Worker).postMessage({ id, data } satisfies PdfWorkerResponse, [data.buffer]);
  } catch (error) {
    (self as unknown as Worker).postMessage({ id, error: String(error) } satisfies PdfWorkerResponse);
  }
};
