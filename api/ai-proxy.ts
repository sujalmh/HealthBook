export const maxDuration = 120; // 120 seconds execution limit on Vercel Serverless

export async function OPTIONS() {
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
  if (req.method === 'OPTIONS') {
    return OPTIONS();
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

    const targetUrl = `https://opencode.ai${targetPath}${url.search}`;

    const authHeader = req.headers.get('authorization') || '';
    const body = req.method === 'POST' || req.method === 'PUT' ? await req.text() : undefined;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 115000);

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
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
