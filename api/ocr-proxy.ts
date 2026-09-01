/**
 * CareCanvas Serverless Mistral OCR Proxy
 * Proxies document and image OCR requests to https://api.mistral.ai
 * Configured with 120s timeout and full CORS support.
 * Dual-runtime handler: supports both Node.js Serverless (req,res) and Web Request.
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
  return handleWebProxy(req);
}

export async function GET(req: Request) {
  return handleWebProxy(req);
}

export default async function handler(req: any, res?: any) {
  // Node.js Serverless runtime (Vercel default for api/*.ts): req=IncomingMessage, res=ServerResponse
  if (res && typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    try {
      const rawUrl: string = req.url || '';
      const forwardUri: string = (req.headers?.['x-forwarded-uri'] || req.headers?.['x-matched-path'] || rawUrl || '') as string;
      // Extract path after /api/ocr-proxy
      let targetPath = '';
      if (typeof forwardUri === 'string' && forwardUri.includes('/api/ocr-proxy')) {
        // Keep query string if present
        const qIdx = forwardUri.indexOf('?');
        const pathOnly = qIdx >= 0 ? forwardUri.substring(0, qIdx) : forwardUri;
        const searchOnly = qIdx >= 0 ? forwardUri.substring(qIdx) : '';
        targetPath = pathOnly.replace(/^\/api\/ocr-proxy/, '') || '/';
        if (searchOnly) targetPath += searchOnly;
      } else if (rawUrl) {
        // Fallback: rawUrl is like /api/ocr-proxy/v1/ocr
        targetPath = rawUrl.replace(/^\/api\/ocr-proxy/, '') || '/';
      }
      if (!targetPath) targetPath = '/';

      // Handle ?path= fallback (used by some rewrite strategies)
      if ((targetPath === '/' || targetPath === '') && req.query?.path) {
        targetPath = String(req.query.path).startsWith('/') ? String(req.query.path) : '/' + String(req.query.path);
        // Append original search if any
        if (rawUrl.includes('?') && !targetPath.includes('?')) {
          const search = rawUrl.substring(rawUrl.indexOf('?'));
          // avoid duplicating ?path=
          if (!search.includes('path=')) targetPath += search;
        }
      }

      if (!targetPath.startsWith('/')) targetPath = '/' + targetPath;

      // Extract search for mistral target
      const hasSearch = targetPath.includes('?');
      const pathPart = hasSearch ? targetPath.substring(0, targetPath.indexOf('?')) : targetPath;
      const searchPart = hasSearch ? targetPath.substring(targetPath.indexOf('?')) : (rawUrl.includes('?') ? rawUrl.substring(rawUrl.indexOf('?')) : '');

      const targetUrl = `https://api.mistral.ai${pathPart}${searchPart}`;

      const authHeader: string = req.headers?.['authorization'] || req.headers?.['Authorization'] || '';
      const serverKey = (process as any).env?.OCR_API_KEY || (process as any).env?.MISTRAL_API_KEY || (process as any).env?.VITE_OCR_API_KEY || '';
      const effectiveAuth =
        authHeader && authHeader.trim().length > 7 && authHeader.toLowerCase() !== 'bearer' && authHeader !== 'Bearer '
          ? authHeader
          : serverKey
            ? `Bearer ${serverKey}`
            : '';

      if (!effectiveAuth) {
        console.warn('[ocr-proxy] no OCR API key available — set OCR_API_KEY or MISTRAL_API_KEY in Vercel env');
      }

      let body: string | undefined = undefined;
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        if (typeof req.body === 'string') {
          body = req.body;
        } else if (req.body && typeof req.body === 'object') {
          body = JSON.stringify(req.body);
        } else if (typeof req.text === 'function') {
          // Web Request-like (edge)
          try { body = await req.text(); } catch {}
        } else {
          // Fallback: read stream (when bodyParser disabled)
          body = await new Promise<string>((resolve) => {
            let data = '';
            req.on?.('data', (chunk: any) => (data += chunk));
            req.on?.('end', () => resolve(data));
            req.on?.('error', () => resolve(''));
            // timeout fallback
            setTimeout(() => resolve(data), 2000);
          }).catch(() => undefined) as any;
          if (body === '') body = undefined;
        }
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 115000);

      const response = await fetch(targetUrl, {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          ...(effectiveAuth ? { Authorization: effectiveAuth } : {}),
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timer);

      const responseBody = await response.text();
      res.status(response.status);
      res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
      return res.send(responseBody);
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError' || err?.message?.includes('timeout') || err?.message?.includes('aborted');
      return res.status(isTimeout ? 504 : 500).json({
        error: isTimeout ? 'OCR request timed out after 115s' : (err?.message || 'OCR Proxy error'),
        type: isTimeout ? 'timeout_error' : 'ocr_proxy_error',
      });
    }
  }

  // Web standard Request (Edge / Web runtime)
  return handleWebProxy(req);
}

async function handleWebProxy(req: Request) {
  if (req.method === 'OPTIONS') {
    return OPTIONS();
  }

  try {
    const url = new URL(req.url);
    const forwardUri = req.headers.get('x-forwarded-uri') || req.headers.get('x-matched-path') || '';
    let targetPath = url.pathname.replace(/^\/api\/ocr-proxy/, '');

    if (!targetPath || targetPath === '/' || targetPath === '') {
      if (forwardUri.startsWith('/api/ocr-proxy')) {
        targetPath = forwardUri.replace(/^\/api\/ocr-proxy/, '');
      } else if (url.searchParams.has('path')) {
        targetPath = url.searchParams.get('path') || '';
      }
    }

    if (!targetPath.startsWith('/')) {
      targetPath = '/' + targetPath;
    }

    const targetUrl = `https://api.mistral.ai${targetPath}${url.search}`;

    const authHeader = req.headers.get('authorization') || '';
    const serverKey = (process as any).env?.OCR_API_KEY || (process as any).env?.MISTRAL_API_KEY || (process as any).env?.VITE_OCR_API_KEY || '';
    const effectiveAuth = authHeader && authHeader.trim().length > 7 && authHeader.toLowerCase() !== 'bearer' && authHeader !== 'Bearer ' ? authHeader : serverKey ? `Bearer ${serverKey}` : '';
    const body = req.method === 'POST' ? await req.text() : undefined;

    if (!effectiveAuth) {
      console.warn('[ocr-proxy] no OCR API key available — set OCR_API_KEY or MISTRAL_API_KEY in Vercel env');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 115000);

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
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
        'Content-Type': response.headers.get('content-type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError' || err?.message?.includes('timeout') || err?.message?.includes('aborted');
    return new Response(
      JSON.stringify({
        error: isTimeout ? 'OCR request timed out after 115s' : (err?.message || 'OCR Proxy error'),
        type: isTimeout ? 'timeout_error' : 'ocr_proxy_error',
      }),
      {
        status: isTimeout ? 504 : 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
