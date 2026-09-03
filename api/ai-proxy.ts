export const maxDuration = 120;

export default async function handler(req: any, res?: any) {

  if (res && typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, baggage, sentry-trace');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    try {
      const forwardUri = req.headers?.['x-forwarded-uri'] || req.headers?.['x-matched-path'] || req.url || '';
      let targetPath = typeof forwardUri === 'string' ? forwardUri.replace(/^\/api\/ai-proxy/, '') : '';
      if (!targetPath || targetPath === '/' || targetPath === '') {
        if (req.query && req.query.path) {
          targetPath = req.query.path;
        }
      }
      if (!targetPath.startsWith('/')) {
        targetPath = '/' + targetPath;
      }

      const targetBase = (process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://opencode.ai').replace(/\/+$/, '');
      const targetUrl = `${targetBase}${targetPath}`;
      const authHeader = req.headers?.['authorization'] || '';

      const serverKey = (
        process.env.AI_API_KEY ||
        process.env.VITE_AI_API_KEY ||
        process.env.OPENAI_API_KEY ||
        process.env.GEMINI_API_KEY ||
        process.env.ANTHROPIC_API_KEY ||
        process.env.GROQ_API_KEY ||
        ''
      ).trim();
      const effectiveAuth = authHeader && authHeader.trim().toLowerCase() !== 'bearer'
        ? authHeader
        : (serverKey ? `Bearer ${serverKey}` : '');
      if (!effectiveAuth) {
        console.warn('[ai-proxy] no API key available — set AI_API_KEY (server-only, no VITE_ prefix) in Vercel env');
      }

      let bodyStr: string | undefined = undefined;
      if (req.method === 'POST' || req.method === 'PUT') {
        if (typeof req.body === 'string') {
          bodyStr = req.body;
        } else if (req.body && typeof req.body === 'object') {
          bodyStr = JSON.stringify(req.body);
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
        body: bodyStr,
        signal: controller.signal,
      });

      clearTimeout(timer);

      const responseText = await response.text();
      res.status(response.status);
      res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
      return res.send(responseText);
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError' || err?.message?.includes('timeout') || err?.message?.includes('aborted');
      return res.status(isTimeout ? 504 : 500).json({
        error: isTimeout ? 'AI Provider request timed out after 115s' : (err?.message || 'Proxy error'),
        type: isTimeout ? 'timeout_error' : 'proxy_error',
      });
    }
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, baggage, sentry-trace',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  try {
    const url = new URL(req.url);
    const forwardUri = req.headers.get('x-forwarded-uri') || req.headers.get('x-matched-path') || '';
    let targetPath = url.pathname.replace(/^\/api\/ai-proxy/, '');

    if (!targetPath || targetPath === '/' || targetPath === '') {
      if (forwardUri.startsWith('/api/ai-proxy')) {
        targetPath = forwardUri.replace(/^\/api\/ai-proxy/, '');
      } else if (url.searchParams.has('path')) {
        targetPath = url.searchParams.get('path') || '';
      }
    }

    if (!targetPath.startsWith('/')) {
      targetPath = '/' + targetPath;
    }

    const targetBase = (process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://opencode.ai').replace(/\/+$/, '');
    const targetUrl = `${targetBase}${targetPath}${url.search}`;
    const authHeader = req.headers.get('authorization') || '';

    const serverKey = (
      process.env.AI_API_KEY ||
      process.env.VITE_AI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.GROQ_API_KEY ||
      ''
    ).trim();
    const effectiveAuth = authHeader && authHeader.trim().toLowerCase() !== 'bearer'
      ? authHeader
      : (serverKey ? `Bearer ${serverKey}` : '');
    if (!effectiveAuth) {
      console.warn('[ai-proxy] no API key available — set AI_API_KEY (server-only, no VITE_ prefix) in Vercel env');
    }
    const body = req.method === 'POST' || req.method === 'PUT' ? await req.text() : undefined;

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
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError' || err?.message?.includes('timeout') || err?.message?.includes('aborted');
    return new Response(
      JSON.stringify({
        error: isTimeout ? 'AI Provider request timed out after 115s' : (err?.message || 'Proxy error'),
        type: isTimeout ? 'timeout_error' : 'proxy_error',
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

