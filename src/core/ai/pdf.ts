/**
 * CareCanvas AI — Client-side PDF Text Extraction & Canvas Page Rendering
 * Converts PDF files/data into full plain text + PNG page preview data URLs for AI multimodal extraction.
 */

import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker for browser/Vite environment
if (typeof window !== 'undefined') {
  try {
    (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${(pdfjsLib as any).version || '3.11.174'}/build/pdf.worker.min.js`;
  } catch {}
}

export interface ExtractedPdfDocument {
  text: string;
  pageCount: number;
  imagePreviewDataUrl?: string;
}

export async function processPdfData(pdfData: ArrayBuffer | Uint8Array | string): Promise<ExtractedPdfDocument> {
  let data: Uint8Array;
  if (typeof pdfData === 'string') {
    if (pdfData.startsWith('data:')) {
      const base64 = pdfData.split(',')[1] || '';
      const binaryString = atob(base64);
      data = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        data[i] = binaryString.charCodeAt(i);
      }
    } else {
      const binaryString = atob(pdfData);
      data = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        data[i] = binaryString.charCodeAt(i);
      }
    }
  } else if (pdfData instanceof ArrayBuffer) {
    data = new Uint8Array(pdfData);
  } else {
    data = pdfData;
  }

  const loadingTask = (pdfjsLib as any).getDocument({ data });
  const doc = await loadingTask.promise;
  const pageCount = doc.numPages;

  let fullText = '';
  let imagePreviewDataUrl: string | undefined;

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => (item && typeof item.str === 'string' ? item.str : ''))
      .join(' ');
    if (pageText.trim()) {
      fullText += (fullText ? '\n\n' : '') + pageText.trim();
    }

    // Render page 1 to canvas preview if in browser
    if (i === 1 && typeof document !== 'undefined') {
      try {
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
          imagePreviewDataUrl = canvas.toDataURL('image/png');
        }
      } catch (err) {
        console.warn('[pdf] Canvas page rendering failed, continuing with text extraction:', err);
      }
    }
  }

  return {
    text: fullText,
    pageCount,
    imagePreviewDataUrl,
  };
}
