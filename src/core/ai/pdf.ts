/**
 * CareCanvas AI — Client-side PDF Text Extraction (stub)
 * Prod pipeline is Mistral OCR only (see ocr.ts); this module preserved for API compat.
 * Why stub: manual pdfjs-dist fallback disabled per client.ts:248 — OCR-only pipeline avoids inaccurate extraction.
 */

export interface ExtractedPdfDocument {
  text: string;
  pageCount: number;
  imagePreviewDataUrl?: string;
}

export async function processPdfData(_pdfData: ArrayBuffer | Uint8Array | string): Promise<ExtractedPdfDocument> {
  console.warn('[pdf] Manual pdfjs extraction disabled — use runDocumentOCR (Mistral OCR) for PDFs');
  return {
    text: '',
    pageCount: 1,
    imagePreviewDataUrl: undefined,
  };
}
