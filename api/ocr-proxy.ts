/**
 * CareCanvas Serverless Mistral OCR Proxy
 * Proxies document and image OCR requests to https://api.mistral.ai
 * Configured with 120s timeout and full CORS support.
 */

export const maxDuration = 120; // 120 seconds execution limit

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function POST(req: Request) {
  return handleProxy(req);
}

export async function GET(req: Request) {
  return handleProxy(req);
}

export default async function handler(req: Request) {
  return handleProxy(req);
}

async function handleProxy(req: Request) {
  if (req.method === "OPTIONS") {
    return OPTIONS();
  }

  try {
    const url = new URL(req.url);
    const forwardUri = req.headers.get("x-forwarded-uri") || req.headers.get("x-matched-path") || "";
    let targetPath = url.pathname.replace(/^\/api\/ocr-proxy/, "");

    if (!targetPath || targetPath === "/" || targetPath === "") {
      if (forwardUri.startsWith("/api/ocr-proxy")) {
        targetPath = forwardUri.replace(/^\/api\/ocr-proxy/, "");
      } else if (url.searchParams.has("path")) {
        targetPath = url.searchParams.get("path") || "";
      }
    }

    if (!targetPath.startsWith("/")) {
      targetPath = "/" + targetPath;
    }

    const targetUrl = `https://api.mistral.ai${targetPath}${url.search}`;

    const authHeader = req.headers.get("authorization") || "";
    const serverKey = (process as any).env?.OCR_API_KEY || (process as any).env?.MISTRAL_API_KEY || (process as any).env?.VITE_OCR_API_KEY || "";
    const effectiveAuth = authHeader && authHeader.trim().length > 7 && authHeader.toLowerCase() !== 'bearer' && authHeader !== 'Bearer ' ? authHeader : serverKey ? `Bearer ${serverKey}` : "";
    const body = req.method === "POST" ? await req.text() : undefined;

    if (!effectiveAuth) {
      console.warn('[ocr-proxy] no OCR API key available — set OCR_API_KEY or MISTRAL_API_KEY in Vercel env');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 115000);

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        ...(effectiveAuth ? { Authorization: effectiveAuth } : {}),
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timer);

    const responseBody = await response.text();
    return new Response(responseBody, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (err: any) {
    const isTimeout = err?.name === "AbortError" || err?.message?.includes("timeout") || err?.message?.includes("aborted");
    return new Response(
      JSON.stringify({
        error: isTimeout ? "OCR request timed out after 115s" : (err?.message || "OCR Proxy error"),
        type: isTimeout ? "timeout_error" : "ocr_proxy_error",
      }),
      {
        status: isTimeout ? 504 : 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}
