/**
 * Draws a PDF onto canvases with pdf.js, one per page, and puts them in `host` only when every page
 * is ready, so whatever was there stays on screen until the new pages can replace it (no blank
 * flash between two drafts of the preview). `cancelled()` is asked between steps so a drawing that has
 * been overtaken stops early.
 */
export async function drawPdfPages(
  host: HTMLElement,
  source: { url: string } | { data: Uint8Array },
  label: string,
  cancelled: () => boolean,
  onFirstPage?: () => void,
): Promise<number | null> {
  // The legacy build runs on older phones too.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (cancelled()) return null;
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = pdfjs.getDocument("url" in source ? { url: source.url } : { data: source.data });
  try {
    const pdf = await task.promise;
    if (cancelled()) return null;
    const width = host.clientWidth || 360;
    // Sharp on dense screens, but never more pixels per page than a phone can hold.
    const ratio = Math.min(window.devicePixelRatio || 1, 2.5, 1800 / width);
    // Nothing on screen yet: draw straight into it, so the first page shows as soon as it is ready.
    // Otherwise draw off to the side and swap when all pages are done.
    const live = host.childElementCount === 0;
    const fragment = document.createDocumentFragment();
    const target: ParentNode = live ? host : fragment;
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      if (cancelled()) return null;
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
      target.appendChild(wrapper);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("no canvas");
      await page.render({ canvasContext: context, canvas, viewport }).promise;
      if (cancelled()) return null;
      if (n === 1 && live) onFirstPage?.();
    }
    if (cancelled()) return null;
    if (!live) host.replaceChildren(fragment);
    return pdf.numPages;
  } finally {
    void task.destroy();
  }
}
