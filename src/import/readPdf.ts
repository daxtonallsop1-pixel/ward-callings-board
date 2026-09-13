import { tableFromPdfItems, type PdfItem } from './pdfLayout';

/**
 * Reads the table out of a PDF entirely in the browser. pdf.js is loaded on
 * demand so it doesn't slow down the board itself.
 */
export async function readPdfTable(file: File): Promise<string | undefined> {
  const pdfjs = await import('pdfjs-dist');
  const { default: workerSrc } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  // In pdf.js 6, teardown lives on the loading task, not the document.
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  try {
    const pages: PdfItem[][] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      pages.push(
        content.items.flatMap((it) =>
          'str' in it && it.str.trim()
            ? [{ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height || Math.abs(it.transform[3]) }]
            : [],
        ),
      );
    }
    return tableFromPdfItems(pages);
  } finally {
    await task.destroy();
  }
}
