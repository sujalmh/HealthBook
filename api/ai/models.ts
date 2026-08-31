export const config = { runtime: 'nodejs' };
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-api-key, x-goog-api-key');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  const targetBase = 'https://opencode.ai/zen/go/v1';
  const search = req.url && req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
  const targetUrl = `${targetBase}/models${search}`;
  try {
    const headers: Record<string, string> = {};
    const serverKey = process.env.AI_API_KEY;
    if (req.headers['authorization']) headers['Authorization'] = String(req.headers['authorization']);
    else if (serverKey) headers['Authorization'] = `Bearer ${serverKey}`;
    const upstream = await fetch(targetUrl, { method: req.method, headers });
    res.status(upstream.status);
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('content-type', ct);
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (e:any){ console.error('[proxy models]',e); res.status(502).json({error:'proxy_error',message:String(e?.message||e)});}
}
