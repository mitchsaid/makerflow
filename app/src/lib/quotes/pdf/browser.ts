import { pdf } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import type { QuoteSnapshot } from "../snapshot";
import { forPdf } from "./clean";
import { registerPdfFonts } from "./fonts";
import { QuoteDocument, type PdfImage } from "./quote-document";

/**
 * The same document the server draws, drawn in the browser: the preview and the theme studio use it
 * so a choice shows at once, with no trip to the server. Loaded only on those screens (it brings the
 * PDF drawing code and the fonts with it). The downloaded and sent PDFs still come from the server,
 * from the same QuoteDocument.
 */
export async function renderQuotePdfInBrowser(
  snapshot: QuoteSnapshot,
  options: { draft?: boolean; images?: ReadonlyMap<string, PdfImage>; logo?: PdfImage | null } = {},
): Promise<Uint8Array> {
  registerPdfFonts();
  const document = QuoteDocument({ snapshot: forPdf(snapshot), draft: options.draft ?? false, images: options.images, logo: options.logo });
  const blob = await pdf(document as ReactElement<DocumentProps>).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}
