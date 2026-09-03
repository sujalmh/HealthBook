
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

