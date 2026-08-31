export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: any, res: any) {
  // CORS headers - allow any origin for proxied AI provider
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-api-key, x-goog-api-key');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const targetBase = 'https://opencode.ai/zen/go/v1';
  // req.query.path is array from [...path], or string
  const pathParts = req.query.path;
  let subPath = '';
  if (Array.isArray(pathParts)) subPath = pathParts.join('/');
  else if (typeof pathParts === 'string') subPath = pathParts;
  // Fallback: parse from url if query not populated
  if (!subPath) {
    const url = req.url || '';
    const m = url.match(/\/api\/ai\/(.*?)(\?|$)/);
    if (m) subPath = m[1];
  }
  const search = req.url && req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
  const targetUrl = `${targetBase}/${subPath}${search}`;

  try {
    const headers: Record<string, string> = {};
    // Forward relevant headers
    if (req.headers['content-type']) headers['Content-Type'] = String(req.headers['content-type']);
    if (req.headers['authorization']) headers['Authorization'] = String(req.headers['authorization']);
    if (req.headers['x-api-key']) headers['x-api-key'] = String(req.headers['x-api-key']);
    if (req.headers['x-goog-api-key']) headers['x-goog-api-key'] = String(req.headers['x-goog-api-key']);
    // Add any extra headers forwarded
    for (const [k, v] of Object.entries(req.headers)) {
      const lk = k.toLowerCase();
      if (lk.startsWith('x-') && !headers[k]) headers[k] = String(v);
    }

    let body: any = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.body) {
        body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      } else {
        // Fallback raw body read
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        if (chunks.length) body = Buffer.concat(chunks);
      }
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
    }

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    // Forward status and headers
    res.status(upstream.status);
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('content-type', ct);
    // Copy other useful headers
    for (const [k, v] of upstream.headers.entries()) {
      const lk = k.toLowerCase();
      if (['content-type', 'content-length', 'cache-control'].includes(lk)) continue;
      if (lk.startsWith('access-control-')) continue;
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (e: any) {
    console.error('[ai proxy] error', e);
    res.status(502).json({ error: 'proxy_error', message: String(e?.message || e) });
  }
}
