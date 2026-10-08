import "server-only";
import type { ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { QuoteSnapshot } from "../snapshot";
import { forPdf } from "./clean";
import { registerPdfFonts } from "./fonts";
import { QuoteDocument, type PdfImage } from "./quote-document";

export { forPdf };

/** The PDF bytes for a quote snapshot. `draft` adds a "not sent yet" banner for previews. */
export async function renderQuotePdf(
  snapshot: QuoteSnapshot,
  options: {
    draft?: boolean;
    /** The product photos the snapshot names (small copies), by image id. */
    images?: ReadonlyMap<string, PdfImage>;
    /** The logo the snapshot names. */
    logo?: PdfImage | null;
  } = {},
): Promise<Buffer> {
  registerPdfFonts();
  // QuoteDocument is a plain function that returns the <Document>, which is what renderToBuffer wants.
  // Text the font cannot draw (emoji, mostly) is dropped for the PDF only; the snapshot keeps it.
  const document = QuoteDocument({ snapshot: forPdf(snapshot), draft: options.draft ?? false, images: options.images, logo: options.logo });
  return renderToBuffer(document as ReactElement<DocumentProps>);
}
