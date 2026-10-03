import { useSyncExternalStore } from "react";

/**
 * Getting the quote's PDF to the customer from the browser. On a phone the share sheet
 * (WhatsApp, email, messages) takes the file; where the browser can't share files, the PDF is
 * downloaded instead. Runs in the browser only.
 */

export type ShareOutcome = "shared" | "downloaded" | "cancelled" | "failed";

function pdfFile(blob: Blob, filename: string): File {
  return new File([blob], filename, { type: "application/pdf" });
}

/** Can this browser hand a PDF to the phone's share sheet? Decided after the page loads. */
export function canSharePdf(): boolean {
  try {
    return typeof navigator !== "undefined" && typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [pdfFile(new Blob(["%PDF-"]), "quote.pdf")] });
  } catch {
    return false;
  }
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function sharePdf(url: string, filename: string, title: string): Promise<ShareOutcome> {
  let blob: Blob;
  try {
    const response = await fetch(url, { credentials: "same-origin" });
    if (!response.ok) return "failed";
    blob = await response.blob();
  } catch {
    return "failed";
  }
  const file = pdfFile(blob, filename);
  if (canSharePdf()) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch (error) {
      // Closing the share sheet is a choice, not a failure.
      if ((error as { name?: string } | null)?.name === "AbortError") return "cancelled";
      // Anything else (for example the browser wanting a fresh tap): fall back to a download.
    }
  }
  download(blob, filename);
  return "downloaded";
}

const never = () => () => {};

/**
 * Can this browser share files? False on the server and during the first render, so the page
 * and the browser agree, then the real answer once it is on screen.
 */
export function useCanSharePdf(): boolean {
  return useSyncExternalStore(never, canSharePdf, () => false);
}
