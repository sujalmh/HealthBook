/**
 * CareCanvas Serverless Exa Search Proxy
 * Proxies healthcare grounding search requests to https://api.exa.ai/search
 * Docs: https://exa.ai/docs/reference/search-best-practices
 * Endpoint: POST https://api.exa.ai/search — Auth via Authorization: Bearer <EXA_API_KEY>
 *
 * Best practices followed:
 * - Accepts exact /search JSON body per Exa docs (contents nested, not top-level)
 * - Server injects key from EXA_API_KEY / VITE_EXA_API_KEY so browser never needs to expose it
 * - If client already sends Authorization, proxy respects it (Settings override)
 * - Dual-runtime: Node Serverless (Vercel) + Web Request (Edge) — mirrors ocr-proxy/ai-proxy
 */

export const maxDuration = 30;

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
    const env: any = (typeof process !== 'undefined' ? (process as any).env : {}) || {};
    // Support multiple var names user might have set
    return (
      env.EXA_API_KEY ||
      env.VITE_EXA_API_KEY ||
      env.VITE_EXA_KEY ||
      env.EXA_KEY ||
      ""
    ).trim();
  } catch {
    return "";
  }
}

export default async function handler(req: any, res?: any) {
  if (res && typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') return res.status(204).end();

    try {
      const targetUrl = 'https://api.exa.ai/search';

      const authHeader: string = req.headers?.['authorization'] || req.headers?.['Authorization'] || '';
      const serverKey = resolveServerKey();
      const effectiveAuth =
        authHeader && authHeader.trim().length > 7 && !authHeader.toLowerCase().includes('bearer undefined')
          ? authHeader
          : serverKey
            ? `Bearer ${serverKey}`
            : '';

      if (!effectiveAuth) {
        return res.status(401).json({
          error: 'EXA_API_KEY not configured — set EXA_API_KEY in Vercel env or VITE_EXA_API_KEY locally',
          type: 'missing_api_key',
        });
      }

      let body: string | undefined = undefined;
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        if (typeof req.body === 'string') body = req.body;
        else if (req.body && typeof req.body === 'object') body = JSON.stringify(req.body);
        else if (typeof req.text === 'function') {
          try { body = await req.text(); } catch {}
        } else {
          body = await new Promise<string>((resolve) => {
            let data = '';
            req.on?.('data', (c: any) => (data += c));
            req.on?.('end', () => resolve(data));
            req.on?.('error', () => resolve(''));
            setTimeout(() => resolve(data), 2000);
          }).catch(() => undefined) as any;
          if (body === '') body = undefined;
        }
      }

      // Minimal body validation — must have query per docs
      if (body) {
        try {
          const parsed = JSON.parse(body);
          if (!parsed.query || typeof parsed.query !== 'string' || !parsed.query.trim()) {
            return res.status(400).json({ error: 'query is required (string)', type: 'bad_request' });
          }
        } catch {
          // forward anyway, let Exa validate
        }
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);

      // Copy Exa-Beta header for dynamic highlights if present
      const betaHeader: string | undefined = req.headers?.['exa-beta'] || req.headers?.['Exa-Beta'] || req.headers?.['x-exa-beta'];

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: effectiveAuth,
          ...(betaHeader ? { 'Exa-Beta': betaHeader } : {}),
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);
      const responseBody = await response.text();
      res.status(response.status);
      res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
      // Pass through cost header if present
      const cost = response.headers.get('x-cost-dollars') || response.headers.get('x-exa-cost');
      if (cost) res.setHeader('X-Exa-Cost', cost);
      return res.send(responseBody);
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError' || err?.message?.includes('timeout') || err?.message?.includes('aborted');
      return res.status(isTimeout ? 504 : 500).json({
        error: isTimeout ? 'Exa request timed out after 25s' : (err?.message || 'Exa proxy error'),
        type: isTimeout ? 'timeout_error' : 'proxy_error',
      });
    }
  }
  return handleWebProxy(req);
}

async function handleWebProxy(req: Request) {
  if (req.method === 'OPTIONS') return OPTIONS();
  try {
    const targetUrl = 'https://api.exa.ai/search';
    const authHeader = req.headers.get('authorization') || '';
    const serverKey = resolveServerKey();
    const effectiveAuth = authHeader && authHeader.trim().length > 7 ? authHeader : serverKey ? `Bearer ${serverKey}` : '';

    if (!effectiveAuth) {
      return new Response(JSON.stringify({ error: 'EXA_API_KEY not configured', type: 'missing_api_key' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    let body: string | undefined = undefined;
    if (req.method === 'POST') body = await req.text().catch(() => undefined);
    if (body) {
      try {
        const parsed = JSON.parse(body);
        if (!parsed.query || typeof parsed.query !== 'string' || !parsed.query.trim()) {
          return new Response(JSON.stringify({ error: 'query is required (string)', type: 'bad_request' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }
      } catch {}
    }

    const betaHeader = req.headers.get('exa-beta') || req.headers.get('Exa-Beta');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: effectiveAuth,
        ...(betaHeader ? { 'Exa-Beta': betaHeader } : {}),
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
      },
    });
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError';
    return new Response(JSON.stringify({ error: isTimeout ? 'Exa request timed out' : (err?.message || 'Proxy error'), type: isTimeout ? 'timeout_error' : 'proxy_error' }), {
      status: isTimeout ? 504 : 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
