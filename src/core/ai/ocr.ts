/**
 * CareCanvas AI Core — Document & Image OCR Pre-Processor
 * Uses Mistral OCR (mistral-ocr-latest) to convert PDFs and images into structured Markdown.
 */

export interface OCRResult {
  markdown: string;
  pageCount: number;
  provider: "mistral-ocr" | "pdfjs-client" | "raw-text";
  durationMs: number;
  model?: string;
  tables?: Array<{ html: string; pageIndex: number; id?: string }>;
  pages?: unknown[];
  usageInfo?: unknown;
}

export interface OCROptions {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  timeoutMs?: number;
  patientId?: string;
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
        const parsed = JSON.parse(blob) as unknown as Record<string, unknown>;
        if (typeof parsed.VITE_OCR_API_KEY === 'string' && parsed.VITE_OCR_API_KEY) return parsed.VITE_OCR_API_KEY;
        if (typeof parsed.OCR_API_KEY === 'string' && parsed.OCR_API_KEY) return parsed.OCR_API_KEY;
        if (typeof parsed.MISTRAL_API_KEY === 'string' && parsed.MISTRAL_API_KEY) return parsed.MISTRAL_API_KEY;
      }
    }
  } catch { /* intentionally empty */ }

  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, unknown> })?.env ?? {};
    const procEnv = typeof globalThis !== 'undefined' && 'process' in globalThis
      ? ((globalThis as unknown as { process?: { env?: Record<string, unknown> } }).process?.env ?? {})
      : {};
    const env = { ...procEnv, ...metaEnv } as Record<string, unknown>;
    const v = (env.VITE_OCR_API_KEY as string) || (env.OCR_API_KEY as string) || (env.VITE_MISTRAL_API_KEY as string) || (env.MISTRAL_API_KEY as string) || "";
    return String(v).trim();
  } catch {
    return "";
  }
}

function resolveOCREndpoint(): string {
  return "https://api.mistral.ai/v1/ocr";
}

function isRealBrowser(): boolean {
  if (typeof window === 'undefined' || typeof window.location === 'undefined') return false;
  const proc = (globalThis as unknown as { process?: { env?: Record<string, unknown> } }).process;
  if (proc?.env?.VITEST === 'true') return false;
  return typeof window.location.origin === 'string' && window.location.origin.startsWith('http');
}

function resolveOCREndpointForFetch(raw: string): string {
  if (isRealBrowser() && raw.startsWith('https://api.mistral.ai/')) {
    return raw.replace('https://api.mistral.ai/', '/api/ocr-proxy/');
  }
  return raw;
}

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

  const canCallViaProxy = isRealBrowser() && resolveOCREndpointForFetch(resolveOCREndpoint()).startsWith('/api/');
  if ((apiKey || canCallViaProxy) && (isPdf || isImage)) {
    try {
      const endpoint = options?.baseURL || resolveOCREndpoint();
      const tableFormat = (options?.tableFormat as unknown as string) ?? "html";
      const includeBlocks = options?.includeBlocks ?? true;

      const payload: Record<string, unknown> = {
        model,
        document: isPdf
          ? { type: "document_url", document_url: fileDataUrl }
          : { type: "image_url", image_url: fileDataUrl },
        include_image_base64: false,
        table_format: tableFormat,
        include_blocks: includeBlocks,
      };

      const fetchEndpoint = resolveOCREndpointForFetch(endpoint);

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

      if (res.ok) {
        const json = await res.json() as unknown as { pages?: unknown[]; model?: string; usage_info?: unknown; usageInfo?: unknown };
        const pages = (json.pages || []) as Array<{ markdown?: string; header?: string; footer?: string; index?: number; tables?: unknown[] }>;

        const tablesCollected: Array<{ html: string; pageIndex: number; id?: string }> = [];
        const pageMarkdowns: string[] = [];

        for (const p of pages) {
          let pageMd = (p.markdown || "").trim();
          if (p.header) pageMd = `> **Header:** ${p.header}\n\n${pageMd}`;
          if (p.footer) pageMd = `${pageMd}\n\n> **Footer:** ${p.footer}`;

          if (Array.isArray(p.tables) && p.tables.length > 0) {
            for (const t of p.tables) {
              const tbl = t as { html?: unknown; content?: unknown; markdown?: unknown; id?: unknown };
              const html = String(tbl.html ?? tbl.content ?? tbl.markdown ?? "");
              if (html) {
                tablesCollected.push({ html, pageIndex: p.index ?? 0, id: typeof tbl.id === 'string' ? tbl.id : undefined });
              }
            }
            const tablesHtmlBlock = (p.tables as Array<{ html?: unknown; content?: unknown; markdown?: unknown }>)
              .map(tbl => String(tbl.html ?? tbl.content ?? tbl.markdown ?? ""))
              .filter(Boolean)
              .join("\n\n");
            if (tablesHtmlBlock) {
              pageMd += `\n\n<!-- Tables for page ${p.index ?? "?"} -->\n${tablesHtmlBlock}`;
            }
          }

          if (pageMd) pageMarkdowns.push(pageMd);
        }

        const markdown = pageMarkdowns.join("\n\n---\n\n");

        if (markdown.trim().length > 0) {
          const durationMs = Math.round(performance.now() - start);
          const result: OCRResult = {
            markdown: markdown.trim(),
            pageCount: pages.length || 1,
            provider: "mistral-ocr",
            durationMs,
            model: json.model || model,
            tables: tablesCollected,
            pages: pages as unknown[],
            usageInfo: (json as { usage_info?: unknown; usageInfo?: unknown }).usage_info ?? (json as { usageInfo?: unknown }).usageInfo,
          };
          return result;
        }
      } else {
        const errBody = await res.text().catch(() => "");
        console.warn(`[OCR] Mistral OCR request returned status ${res.status}:`, errBody.slice(0, 500));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[OCR] Mistral OCR processing notice:", msg);
    }
  }

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
  return emptyResult;
}
