/**
 * CareCanvas AI Core — Document & Image OCR Pre-Processor
 * Uses Mistral OCR (mistral-ocr-latest) to convert PDFs and images into structured Markdown
 * before downstream AI fact extraction, dramatically speeding up processing and eliminating timeouts.
 * Ref: https://docs.mistral.ai/studio/document-processing/basic_ocr
 */

export interface OCRResult {
  markdown: string;
  pageCount: number;
  provider: "mistral-ocr" | "pdfjs-client" | "raw-text";
  durationMs: number;
  /** Raw API model id (e.g. mistral-ocr-2505) */
  model?: string;
  /** Extracted tables as HTML (when table_format=html) — preserves table structure per page */
  tables?: Array<{ html: string; pageIndex: number; id?: string }>;
  /** Raw pages payload for advanced rendering — preserves hierarchy, dimensions, blocks */
  pages?: any[];
  usageInfo?: any;
}

export interface OCROptions {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  timeoutMs?: number;
  patientId?: string;
  /** Preserve tables as html (default) or markdown; null inline. Default: html */
  tableFormat?: "html" | "markdown" | null;
  includeBlocks?: boolean;
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

function isRealBrowser(): boolean {
  if (typeof window === 'undefined' || typeof window.location === 'undefined') return false;
  if (typeof process !== 'undefined' && (process as any).env?.VITEST === 'true') return false;
  return typeof window.location.origin === 'string' && window.location.origin.startsWith('http');
}

function resolveOCREndpointForFetch(raw: string): string {
  // In browser, proxy Mistral OCR through same-origin /api/ocr-proxy to avoid CORS (mirrors AI proxy pattern)
  if (isRealBrowser() && raw.startsWith('https://api.mistral.ai/')) {
    return raw.replace('https://api.mistral.ai/', '/api/ocr-proxy/');
  }
  return raw;
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

  // 1. Try Mistral OCR API — structure-preserving pipeline
  // In browser the request goes via /api/ocr-proxy which injects OCR_API_KEY server-side, so allow without client key
  const canCallViaProxy = isRealBrowser() && resolveOCREndpointForFetch(resolveOCREndpoint()).startsWith('/api/');
  if ((apiKey || canCallViaProxy) && (isPdf || isImage)) {
    try {
      const endpoint = options?.baseURL || resolveOCREndpoint();
      const tableFormat = (options?.tableFormat as any) ?? "html";
      const includeBlocks = options?.includeBlocks ?? true;

      // Per https://docs.mistral.ai/studio/document-processing/basic_ocr :
      // Preserve tables, headers/footers, block bounding boxes & reading order.
      const payload: any = {
        model,
        document: isPdf
          ? { type: "document_url", document_url: fileDataUrl }
          : { type: "image_url", image_url: fileDataUrl },
        include_image_base64: false,
        // Preserve document structure
        table_format: tableFormat, // html | markdown — keeps tables as structured cells, not flattened text
        include_blocks: includeBlocks, // paragraph-level blocks with bbox & labels in reading order
      };

      console.log("[OCR] Sending Mistral OCR request", {
        endpoint,
        model,
        isPdf,
        isImage,
        tableFormat,
        includeBlocks,
        payloadKeys: Object.keys(payload),
      });

      const fetchEndpoint = resolveOCREndpointForFetch(endpoint);
      console.log("[OCR] Fetch endpoint (proxied if browser):", fetchEndpoint, "original:", endpoint);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(fetchEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timer);

      console.log(`[OCR] Mistral OCR HTTP ${res.status} ${res.statusText} — duration ${Math.round(performance.now() - start)}ms`);

      if (res.ok) {
        const json: any = await res.json();
        console.log("[OCR] Mistral OCR Raw Response:", JSON.stringify(json, null, 2));

        const pages = json.pages || [];

        // Build enriched markdown preserving structure:
        // - markdown already contains tables as inline placeholders when table_format=null
        // - when table_format=html|markdown tables come separately in p.tables — inject them after page markdown
        const tablesCollected: Array<{ html: string; pageIndex: number; id?: string }> = [];
        const pageMarkdowns: string[] = [];

        for (const p of pages) {
          let pageMd = (p.markdown || "").trim();

          // Attach headers/footers if present (when future params enable extraction)
          if (p.header) pageMd = `> **Header:** ${p.header}\n\n${pageMd}`;
          if (p.footer) pageMd = `${pageMd}\n\n> **Footer:** ${p.footer}`;

          // When table_format is html/markdown, pages contain tables array — preserve structure
          if (Array.isArray(p.tables) && p.tables.length > 0) {
            for (const t of p.tables) {
              const html = (t as any).html || (t as any).content || (t as any).markdown || "";
              if (html) {
                tablesCollected.push({ html, pageIndex: p.index ?? 0, id: (t as any).id || undefined });
              }
            }
            // Append structured tables block after the page text so downstream AI sees full table fidelity
            const tablesHtmlBlock = p.tables
              .map((t: any) => (t as any).html || (t as any).content || (t as any).markdown || "")
              .filter(Boolean)
              .join("\n\n");
            if (tablesHtmlBlock) {
              pageMd += `\n\n<!-- Tables for page ${p.index ?? "?"} -->\n${tablesHtmlBlock}`;
            }
          }

          // Images placeholder already inside markdown via ![img-...]; keep as-is for structure

          if (pageMd) pageMarkdowns.push(pageMd);
        }

        const markdown = pageMarkdowns.join("\n\n---\n\n");

        console.log("[OCR] Assembled markdown length:", markdown.length, "pages:", pages.length, "tables:", tablesCollected.length);

        if (markdown.trim().length > 0) {
          const durationMs = Math.round(performance.now() - start);
          const result: OCRResult = {
            markdown: markdown.trim(),
            pageCount: pages.length || 1,
            provider: "mistral-ocr",
            durationMs,
            model: json.model || model,
            tables: tablesCollected,
            pages,
            usageInfo: json.usage_info || json.usageInfo,
          };
          console.log("[OCR] OCRResult summary:", {
            provider: result.provider,
            model: result.model,
            pageCount: result.pageCount,
            durationMs: result.durationMs,
            markdownPreview: result.markdown.slice(0, 500),
            tablesCount: result.tables?.length || 0,
          });
          return result;
        } else {
          console.log("[OCR] Empty markdown after structure assembly — falling back to pdfjs");
        }
      } else {
        const errBody = await res.text().catch(() => "");
        console.warn(`[OCR] Mistral OCR request returned status ${res.status}:`, errBody.slice(0, 500));
        console.log("[OCR] Full error body:", errBody);
      }
    } catch (err: any) {
      console.warn("[OCR] Mistral OCR processing notice:", err?.message || err);
      console.log("[OCR] Exception details:", err);
    }
  }

  // 2. No manual pdfjs fallback — prod pipeline is Mistral OCR only
  // If Mistral failed or no key, return empty to surface issue rather than inaccurate manual extraction
  if (isPdf) {
    console.warn("[OCR] Mistral OCR not used or failed, and manual pdfjs fallback is disabled (OCR-only pipeline)");
  }

  const durationMs = Math.round(performance.now() - start);
  const emptyResult: OCRResult = {
    markdown: "",
    pageCount: 1,
    provider: "raw-text",
    durationMs,
  };
  console.log("[OCR] No OCR output — returning raw-text empty marker:", emptyResult);
  return emptyResult;
}
