import "server-only";
import type { ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { QuoteSnapshot } from "../snapshot";
import { forPdf } from "./clean";
import { ensureFonts } from "./fonts";
import { themeFromStored } from "../themes";
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
    /** The picture behind the pages, if the theme names one. */
    background?: PdfImage | null;
  } = {},
): Promise<Buffer> {
  const theme = themeFromStored(snapshot);
  await ensureFonts([theme.headingFont, theme.bodyFont]);
  // QuoteDocument is a plain function that returns the <Document>, which is what renderToBuffer wants.
  // Text the font cannot draw (emoji, mostly) is dropped for the PDF only; the snapshot keeps it.
  const document = QuoteDocument({ snapshot: forPdf(snapshot), draft: options.draft ?? false, images: options.images, logo: options.logo, background: options.background });
  return renderToBuffer(document as ReactElement<DocumentProps>);
}
