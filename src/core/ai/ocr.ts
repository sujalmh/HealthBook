/**
 * CareCanvas AI Core — Document & Image OCR Pre-Processor
 * Uses Mistral OCR (mistral-ocr-latest) to convert PDFs and images into structured Markdown
 * before downstream AI fact extraction, dramatically speeding up processing and eliminating timeouts.
 * Ref: https://docs.mistral.ai/studio/document-processing/basic_ocr
 */

import { processPdfData } from "./pdf.ts";

export interface OCRResult {
  markdown: string;
  pageCount: number;
  provider: "mistral-ocr" | "pdfjs-client" | "raw-text";
  durationMs: number;
}

export interface OCROptions {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  timeoutMs?: number;
  patientId?: string;
}

function resolveOCRApiKey(): string {
  try {
    if (typeof localStorage !== "undefined") {
      const stored =
        localStorage.getItem("carecanvas_VITE_OCR_API_KEY") ||
        localStorage.getItem("VITE_OCR_API_KEY") ||
        localStorage.getItem("carecanvas_OCR_API_KEY") ||
        localStorage.getItem("OCR_API_KEY") ||
        localStorage.getItem("carecanvas_MISTRAL_API_KEY") ||
        localStorage.getItem("MISTRAL_API_KEY");
      if (stored && stored.trim() !== "") return stored.trim();

      const blob = localStorage.getItem("carecanvas_settings");
      if (blob) {
        const parsed = JSON.parse(blob);
        if (parsed.VITE_OCR_API_KEY) return parsed.VITE_OCR_API_KEY;
        if (parsed.OCR_API_KEY) return parsed.OCR_API_KEY;
        if (parsed.MISTRAL_API_KEY) return parsed.MISTRAL_API_KEY;
      }
    }
  } catch {}

  try {
    const metaEnv = (import.meta as any)?.env ?? {};
    const procEnv = typeof process !== "undefined" ? (process as any).env ?? {} : {};
    const env = { ...procEnv, ...metaEnv };
    return (
      env.VITE_OCR_API_KEY ||
      env.OCR_API_KEY ||
      env.VITE_MISTRAL_API_KEY ||
      env.MISTRAL_API_KEY ||
      ""
    ).trim();
  } catch {
    return "";
  }
}

function resolveOCREndpoint(): string {
  return "https://api.mistral.ai/v1/ocr";
}

/**
 * Pre-processes any document (PDF, JPG, PNG, WebP) with Mistral OCR.
 * Returns clean structured markdown.
 */
export async function runDocumentOCR(
  fileDataUrl: string,
  options?: OCROptions
): Promise<OCRResult> {
  const start = performance.now();
  const apiKey = options?.apiKey || resolveOCRApiKey();
  const model = options?.model || "mistral-ocr-latest";
  const timeoutMs = options?.timeoutMs || 45000;

  const isPdf = fileDataUrl.startsWith("data:application/pdf") || fileDataUrl.includes("application/pdf");
  const isImage = fileDataUrl.startsWith("data:image/");

  // 1. Try Mistral OCR API if API key is configured
  if (apiKey && (isPdf || isImage)) {
    try {
      const endpoint = options?.baseURL || resolveOCREndpoint();
      const payload = {
        model,
        document: isPdf
          ? { type: "document_url", document_url: fileDataUrl }
          : { type: "image_url", image_url: fileDataUrl },
        include_image_base64: false,
      };

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (res.ok) {
        const json: any = await res.json();
        const pages = json.pages || [];
        const markdown = pages
          .map((p: any) => p.markdown || "")
          .filter(Boolean)
          .join("\n\n--- Page Break ---\n\n");

        if (markdown.trim().length > 0) {
          const durationMs = Math.round(performance.now() - start);
          return {
            markdown: markdown.trim(),
            pageCount: pages.length || 1,
            provider: "mistral-ocr",
            durationMs,
          };
        }
      } else {
        const errBody = await res.text().catch(() => "");
        console.warn(`[OCR] Mistral OCR request returned status ${res.status}:`, errBody.slice(0, 200));
      }
    } catch (err: any) {
      console.warn("[OCR] Mistral OCR processing notice:", err?.message || err);
    }
  }

  // 2. Fallback to client-side pdfjs-dist for PDFs
  if (isPdf) {
    try {
      const pdfRes = await processPdfData(fileDataUrl);
      const durationMs = Math.round(performance.now() - start);
      if (pdfRes.text && pdfRes.text.trim().length > 0) {
        return {
          markdown: pdfRes.text.trim(),
          pageCount: pdfRes.pageCount || 1,
          provider: "pdfjs-client",
          durationMs,
        };
      }
    } catch (err) {
      console.warn("[OCR] pdfjs-dist fallback notice:", err);
    }
  }

  const durationMs = Math.round(performance.now() - start);
  return {
    markdown: "",
    pageCount: 1,
    provider: "raw-text",
    durationMs,
  };
}
