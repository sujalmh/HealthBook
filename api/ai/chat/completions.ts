export const config = { runtime: 'nodejs' };
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-api-key, x-goog-api-key');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  const targetBase = 'https://opencode.ai/zen/go/v1';
  const search = req.url && req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
  const targetUrl = `${targetBase}/chat/completions${search}`;
  try {
    const headers: Record<string, string> = {};
    if (req.headers['content-type']) headers['Content-Type'] = String(req.headers['content-type']);
    const serverKey = (
      process.env.AI_API_KEY ||
      process.env.VITE_AI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.GROQ_API_KEY ||
      ''
    ).trim();
    const authHeader = req.headers['authorization'] ? String(req.headers['authorization']).trim() : '';

    if (authHeader && authHeader.length > 7 && authHeader.toLowerCase() !== 'bearer' && authHeader !== 'Bearer ') headers['Authorization'] = authHeader;
    else if (serverKey) headers['Authorization'] = `Bearer ${serverKey}`;
    const xApi = req.headers['x-api-key'] ? String(req.headers['x-api-key']).trim() : '';
    if (xApi) headers['x-api-key'] = xApi;
    else if (serverKey) headers['x-api-key'] = serverKey;
    if (req.headers['x-goog-api-key']) headers['x-goog-api-key'] = String(req.headers['x-goog-api-key']);
    for (const [k, v] of Object.entries(req.headers)) {
      const lk = k.toLowerCase();
      if (lk.startsWith('x-') && !headers[k as string]) headers[k as string] = String(v);
    }
    if (!headers['Authorization'] && !headers['x-api-key']) {
      console.warn('[proxy chat] no API key available — set AI_API_KEY (server-only, no VITE_ prefix) in Vercel env');
    }
    let body: any = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.body !== undefined && req.body !== null) body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      else { const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(chunk as Buffer); if (chunks.length) body = Buffer.concat(chunks); }
      if (body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    }
    const upstream = await fetch(targetUrl, { method: req.method, headers, body });
    res.status(upstream.status);
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('content-type', ct);
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (e:any){ console.error('[proxy chat]',e); res.status(502).json({error:'proxy_error',message:String(e?.message||e)});}
}

