import html2pdf from 'html2pdf.js';

export interface PdfExportOptions {
  filename?: string;
  margin?: number | [number, number, number, number];
  quality?: number;
  scale?: number;
}

/**
 * Downloads a DOM element as a crisp, formatted A4 PDF file
 * preserving all CSS background colors, fonts, borders, and layouts.
 */
export async function downloadElementAsPdf(
  elementOrId: HTMLElement | string,
  filename: string = 'Document.pdf',
  options?: PdfExportOptions
): Promise<void> {
  const element = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
  
  if (!element) {
    console.error(`Target printable element "${elementOrId}" not found in DOM.`);
    // Fallback to standard window.print if element cannot be located
    window.print();
    return;
  }

  // Ensure clean filename
  const cleanFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;

  // Default margin to 10mm vertical and 12mm horizontal for balanced, executive A4 margins
  const margin = options?.margin ?? [10, 12, 10, 12];
  const scale = options?.scale ?? 2.5; // High resolution for crisp printing
  const quality = options?.quality ?? 0.98;

  const opt = {
    margin: margin,
    filename: cleanFilename,
    image: { type: 'jpeg' as const, quality: quality },
    html2canvas: {
      scale: scale,
      useCORS: true,
      logging: false,
      letterRendering: true,
      scrollY: 0,
      scrollX: 0,
      windowWidth: 800,
      ignoreElements: (el: Element) => {
        return (
          el.classList?.contains('print:hidden') ||
          el.getAttribute('data-print-hide') === 'true' ||
          el.getAttribute('data-internal-financials') === 'true'
        );
      }
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait' as const,
      compress: true
    },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };

  try {
    await html2pdf().set(opt).from(element).save();
  } catch (error) {
    console.error('Error generating PDF via html2pdf:', error);
    // Fallback: trigger print dialog
    window.print();
  }
}

/**
 * Cleanly triggers browser print dialog with full color retention
 */
export function triggerCleanPrint(): void {
  window.print();
}
