
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

  try {
    const url = new URL(req.url);
    const forwarded = req.headers.get('x-forwarded-uri') || req.headers.get('x-matched-path') || '';
    const isHealth = url.pathname.endsWith('/health') || url.searchParams.get('health') === '1' || forwarded.includes('/health') || forwarded.includes('health=1') || req.headers.get('x-health-check') === '1';
    if (isHealth) {
      const key = resolveServerKey();
      return new Response(JSON.stringify({ enabled: !!key, hasKey: !!key, base: '/api/exa-proxy', status: key ? 'ready' : 'missing_api_key' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  } catch {}
  return handleWebProxy(req);
}

function resolveServerKey(): string {
  try {
    const env = (typeof globalThis !== 'undefined' && 'process' in globalThis
      ? ((globalThis as unknown as { process?: { env?: Record<string, string> } }).process?.env ?? {})
      : {}) as Record<string, string>;
    return (env.EXA_API_KEY || env.VITE_EXA_API_KEY || "").trim();
  } catch {
    return "";
  }
}

export default async function handler(req: unknown, res?: unknown) {
  const r = req as { headers?: Record<string, string>; method?: string; body?: unknown; text?: () => Promise<string>; on?: (e: string, cb: (c: unknown) => void) => void; url?: string };
  const response = res as { setHeader?: (k: string, v: string) => void; status?: (c: number) => { json: (o: unknown) => unknown; end: () => unknown; send: (b: string) => unknown }; json?: (o: unknown) => unknown };
  if (response && typeof response.setHeader === 'function') {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    response.setHeader('Access-Control-Max-Age', '86400');
    if (r.method === 'OPTIONS') return (response.status as (n:number)=>{end:()=>void})(204).end();

    try {
      const rawUrl: string = (r as any).url || '';
      const forwarded: string = ((r.headers?.['x-forwarded-uri'] as string) || (r.headers?.['x-matched-path'] as string) || '') as string;
      const isHealth = rawUrl.includes('/health') || rawUrl.includes('health=1') || forwarded.includes('/health') || forwarded.includes('health=1');
      if (r.method === 'GET' && isHealth) {
        const key = resolveServerKey();
        return (response.status as (n:number)=>{json:(o:unknown)=>unknown})(200).json({ enabled: !!key, hasKey: !!key, base: '/api/exa-proxy', status: key ? 'ready' : 'missing_api_key' });
      }
    } catch {}

    try {
      const targetUrl = 'https://api.exa.ai/search';

      const authHeader: string = (r.headers?.['authorization'] || r.headers?.['Authorization'] || '') as string;
      const serverKey = resolveServerKey();
      const effectiveAuth =
        authHeader && authHeader.trim().length > 7 && !authHeader.toLowerCase().includes('bearer undefined')
          ? authHeader
          : serverKey
            ? `Bearer ${serverKey}`
            : '';

      if (!effectiveAuth) {
        return (response.status as (n:number)=>{json:(o:unknown)=>unknown})(401).json({
          error: 'EXA_API_KEY not configured — set EXA_API_KEY in Vercel env or VITE_EXA_API_KEY locally',
          type: 'missing_api_key',
        });
      }

      let body: string | undefined = undefined;
      if (r.method === 'POST' || r.method === 'PUT' || r.method === 'PATCH') {
        if (typeof r.body === 'string') body = r.body;
        else if (r.body && typeof r.body === 'object') body = JSON.stringify(r.body);
        else if (typeof r.text === 'function') {
          try { body = await r.text(); } catch {  }
        } else {
          body = await new Promise<string>((resolve) => {
            let data = '';
            (r.on as unknown as (e:string, cb:(c:string)=>void)=>void)?.('data', (c: string) => (data += c));
            (r.on as unknown as (e:string, cb:()=>void)=>void)?.('end', () => resolve(data));
            (r.on as unknown as (e:string, cb:()=>void)=>void)?.('error', () => resolve(''));
            setTimeout(() => resolve(data), 2000);
          }).catch(() => undefined) as unknown as string;
          if (body === '') body = undefined;
        }
      }

      if (body) {
        try {
          const parsed = JSON.parse(body) as Record<string, unknown>;
          if (!parsed.query || typeof parsed.query !== 'string' || !parsed.query.trim()) {
            return (response.status as (n:number)=>{json:(o:unknown)=>unknown})(400).json({ error: 'query is required (string)', type: 'bad_request' });
          }
        } catch {

        }
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);

      const betaHeader: string | undefined = r.headers?.['exa-beta'] || r.headers?.['Exa-Beta'] || r.headers?.['x-exa-beta'];

      const fetchResponse = await fetch(targetUrl, {
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
      const responseBody = await fetchResponse.text();
      (response.status as (n:number)=>unknown)(fetchResponse.status);
      response.setHeader?.('Content-Type', fetchResponse.headers.get('content-type') || 'application/json');
      const cost = fetchResponse.headers.get('x-cost-dollars') || fetchResponse.headers.get('x-exa-cost');
      if (cost) response.setHeader?.('X-Exa-Cost', cost);
      return (response as unknown as { send: (b:string)=>unknown }).send(responseBody);
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      const isTimeout = e?.name === 'AbortError' || e?.message?.includes('timeout') || e?.message?.includes('aborted');
      return (response.status as (n:number)=>{json:(o:unknown)=>unknown})(isTimeout ? 504 : 500).json({
        error: isTimeout ? 'Exa request timed out after 25s' : (e?.message || 'Exa proxy error'),
        type: isTimeout ? 'timeout_error' : 'proxy_error',
      });
    }
  }
  return handleWebProxy(req as Request);
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
        const parsed = JSON.parse(body) as Record<string, unknown>;
        if (!parsed.query || typeof parsed.query !== 'string' || !parsed.query.trim()) {
          return new Response(JSON.stringify({ error: 'query is required (string)', type: 'bad_request' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }
      } catch {  }
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
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string };
    const isTimeout = e?.name === 'AbortError';
    return new Response(JSON.stringify({ error: isTimeout ? 'Exa request timed out' : (e?.message || 'Proxy error'), type: isTimeout ? 'timeout_error' : 'proxy_error' }), {
      status: isTimeout ? 504 : 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}

