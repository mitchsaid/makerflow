import "server-only";
import { getRenditions } from "../images/data";
import type { PdfImage } from "../quotes/pdf/quote-document";
import type { QuoteSnapshot } from "../quotes/snapshot";
import { themeFromStored } from "../quotes/themes";

/**
 * The pictures an invoice's document names, as the PDF draws them: the product photos' small copies, the QR codes for
 * paying from their full-size copy (so they scan), the logo and the theme's background.
 */
export async function pdfImagesFor(snapshot: QuoteSnapshot): Promise<{ images: Map<string, PdfImage>; logo: PdfImage | null; background: PdfImage | null }> {
  const photoIds = snapshot.lines.flatMap((l) => (l.photoImageId ? [l.photoImageId] : []));
  const theme = themeFromStored(snapshot);
  const backgroundId = theme.background === "image" ? theme.backgroundImageId : null;
  const qrIds = (snapshot.paymentMethods ?? []).flatMap((w) => (w.imageId ? [w.imageId] : []));
  const [photos, qrs, logos, backgrounds] = await Promise.all([
    getRenditions(photoIds, "thumb"),
    getRenditions(qrIds, "display"),
    getRenditions(snapshot.logoImageId ? [snapshot.logoImageId] : [], "display"),
    getRenditions(backgroundId ? [backgroundId] : [], "display"),
  ]);
  return {
    images: new Map([...photos, ...qrs]),
    logo: snapshot.logoImageId ? (logos.get(snapshot.logoImageId) ?? null) : null,
    background: backgroundId ? (backgrounds.get(backgroundId) ?? null) : null,
  };
}
