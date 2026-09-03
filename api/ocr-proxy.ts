/**
 * Healthbook Serverless Mistral OCR Proxy
 * Dual-runtime: Node.js Serverless + Web Request.
 */

export const maxDuration = 120;

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

function resolveServerKey(): string {
  try {
    const env = (typeof globalThis !== 'undefined' && 'process' in globalThis
      ? ((globalThis as unknown as { process?: { env?: Record<string, string> } }).process?.env ?? {})
      : {}) as Record<string, string>;
    return (env.OCR_API_KEY || env.MISTRAL_API_KEY || env.VITE_OCR_API_KEY || "").trim();
  } catch {
    return "";
  }
}

function resolveEffectiveAuth(header: string, serverKey: string): string {
  if (header && header.trim().length > 7 && header.toLowerCase() !== 'bearer' && header !== 'Bearer ') return header;
  if (serverKey) return `Bearer ${serverKey}`;
  return '';
}

export default async function handler(req: unknown, res?: unknown) {
  const r = req as { method?: string; url?: string; headers?: Record<string, string>; body?: unknown; text?: () => Promise<string>; on?: (e: string, cb: (c: unknown) => void) => void; query?: Record<string, unknown> };
  const response = res as { setHeader?: (k: string, v: string) => void; status?: (n: number) => { end: () => void; json: (o: unknown) => void; send: (b: string) => void } };
  if (response && typeof response.setHeader === 'function') {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    response.setHeader('Access-Control-Max-Age', '86400');

    if (r.method === 'OPTIONS') {
      return (response.status as (n:number)=>{end:()=>void})(204).end();
    }

    try {
      const rawUrl: string = (r.url || '') as string;
      const forwardUri: string = (r.headers?.['x-forwarded-uri'] || r.headers?.['x-matched-path'] || rawUrl || '') as string;
      let targetPath = '';
      if (typeof forwardUri === 'string' && forwardUri.includes('/api/ocr-proxy')) {
        const qIdx = forwardUri.indexOf('?');
        const pathOnly = qIdx >= 0 ? forwardUri.substring(0, qIdx) : forwardUri;
        const searchOnly = qIdx >= 0 ? forwardUri.substring(qIdx) : '';
        targetPath = pathOnly.replace(/^\/api\/ocr-proxy/, '') || '/';
        if (searchOnly) targetPath += searchOnly;
      } else if (rawUrl) {
        targetPath = rawUrl.replace(/^\/api\/ocr-proxy/, '') || '/';
      }
      if (!targetPath) targetPath = '/';

      if ((targetPath === '/' || targetPath === '') && r.query?.path) {
        targetPath = String(r.query.path).startsWith('/') ? String(r.query.path) : '/' + String(r.query.path);
        if (rawUrl.includes('?') && !targetPath.includes('?')) {
          const search = rawUrl.substring(rawUrl.indexOf('?'));
          if (!search.includes('path=')) targetPath += search;
        }
      }

      if (!targetPath.startsWith('/')) targetPath = '/' + targetPath;

      const hasSearch = targetPath.includes('?');
      const pathPart = hasSearch ? targetPath.substring(0, targetPath.indexOf('?')) : targetPath;
      const searchPart = hasSearch ? targetPath.substring(targetPath.indexOf('?')) : (rawUrl.includes('?') ? rawUrl.substring(rawUrl.indexOf('?')) : '');

      const targetUrl = `https://api.mistral.ai${pathPart}${searchPart}`;

      const authHeader: string = r.headers?.['authorization'] || r.headers?.['Authorization'] || '';
      const serverKey = resolveServerKey();
      const effectiveAuth = resolveEffectiveAuth(authHeader, serverKey);

      if (!effectiveAuth) {
        console.warn('[ocr-proxy] no OCR API key available — set OCR_API_KEY or MISTRAL_API_KEY in Vercel env');
      }

      let body: string | undefined = undefined;
      if (r.method === 'POST' || r.method === 'PUT' || r.method === 'PATCH') {
        if (typeof r.body === 'string') {
          body = r.body;
        } else if (r.body && typeof r.body === 'object') {
          body = JSON.stringify(r.body);
        } else if (typeof r.text === 'function') {
          try { body = await r.text(); } catch { /* intentionally empty */ }
        } else {
          body = await new Promise<string>((resolve) => {
            let data = '';
            (r.on as unknown as (e:string, cb:(c:string)=>void)=>void)?.('data', (chunk: string) => (data += chunk));
            (r.on as unknown as (e:string, cb:()=>void)=>void)?.('end', () => resolve(data));
            (r.on as unknown as (e:string, cb:()=>void)=>void)?.('error', () => resolve(''));
            setTimeout(() => resolve(data), 2000);
          }).catch(() => undefined) as unknown as string;
          if (body === '') body = undefined;
        }
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 115000);

      const fetchResponse = await fetch(targetUrl, {
        method: r.method,
        headers: {
          'Content-Type': 'application/json',
          ...(effectiveAuth ? { Authorization: effectiveAuth } : {}),
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timer);

      const responseBody = await fetchResponse.text();
      (response.status as (n:number)=>void)(fetchResponse.status);
      response.setHeader?.('Content-Type', fetchResponse.headers.get('content-type') || 'application/json');
      return (response as unknown as { send: (b:string)=>void }).send(responseBody);
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      const isTimeout = e?.name === 'AbortError' || e?.message?.includes('timeout') || e?.message?.includes('aborted');
      return (response.status as (n:number)=>{json:(o:unknown)=>void})(isTimeout ? 504 : 500).json({
        error: isTimeout ? 'OCR request timed out after 115s' : (e?.message || 'OCR Proxy error'),
        type: isTimeout ? 'timeout_error' : 'ocr_proxy_error',
      });
    }
  }

  return handleWebProxy(req as Request);
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
    const serverKey = resolveServerKey();
    const effectiveAuth = resolveEffectiveAuth(authHeader, serverKey);
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
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string };
    const isTimeout = e?.name === 'AbortError' || e?.message?.includes('timeout') || e?.message?.includes('aborted');
    return new Response(
      JSON.stringify({
        error: isTimeout ? 'OCR request timed out after 115s' : (e?.message || 'OCR Proxy error'),
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
