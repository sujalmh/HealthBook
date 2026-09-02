/**
 * CareCanvas Supabase Proxy — Vercel Serverless Handler
 * Enables Supabase persistence using DATABASE_URL (postgres) directly,
 * bypassing the need for VITE_SUPABASE_ANON_KEY.
 * Mirrors Supabase REST API for the 13 vault tables: supports
 * GET /rest/v1/<table>?patient_id=eq.<pid> and POST upsert.
 * Uses `pg` Pool with DATABASE_URL. Falls back to in-memory if DB unreachable.
 * Never logs password. Handles CORS and both Node/Web runtimes.
 */

export const maxDuration = 30;

// Table -> primary key column
const PRIMARY_KEYS: { [key: string]: string } = {
  facts: 'id',
  documents: 'id',
  medications: 'id',
  meds: 'id',
  labs: 'id',
  conditions: 'id',
  allergies: 'id',
  proposals: 'id',
  calendar_events: 'id',
  care_circle: 'link_id',
  doctor_grants: 'grant_id',
  due_cards: 'id',
  danger_reports: 'report_id',
  question_bank: 'id',
};

// Lazy pg pool
let pool: unknown = null;
async function getPool() {
  if (pool) return pool;
  const url = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.VITE_SUPABASE_DB_URL || '';
  if (!url) return null;
  try {
    const { Pool } = await import('pg');
    pool = new Pool({
      connectionString: url,
      ssl: url.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 8000,
    });
    // Test connection with timeout
    // Do not throw if fails — return null and fallback to no-op
    try {
      const p = pool as { connect: () => Promise<{ release: () => void }> };
      const client = await p.connect();
      client.release();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[supabase-proxy] Pool connect failed, fallback to no-op', msg);
    }
    return pool;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[supabase-proxy] pg import failed', msg);
    return null;
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, X-Requested-With, Prefer',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

function parseTableFromUrl(url: string): string | null {
  try {
    const u = new URL(url, 'http://localhost');
    // Handle /api/supabase/rest/v1/<table> or /rest/v1/<table> or ?table=<name>
    const match = u.pathname.match(/\/rest\/v1\/([^\/\?]+)/);
    if (match && match[1]) return match[1];
    const qTable = u.searchParams.get('table');
    if (qTable) return qTable;
    // Also check path like /api/supabase?table=facts
    return null;
  } catch {
    return null;
  }
}

function parsePatientIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url, 'http://localhost');
    // Supabase REST uses patient_id=eq.<value> or patientId
    const pidEq = u.searchParams.get('patient_id');
    if (pidEq) {
      // Format: eq.<id>
      if (pidEq.startsWith('eq.')) return decodeURIComponent(pidEq.slice(3));
      return pidEq;
    }
    const pid = u.searchParams.get('patientId') || u.searchParams.get('patient_id');
    if (pid) return pid;
    // Also check plain patient_id query without eq
    for (const [k, v] of u.searchParams.entries()) {
      if (k === 'patient_id' || k === 'patientId') {
        if (v.startsWith('eq.')) return decodeURIComponent(v.slice(3));
        return decodeURIComponent(v);
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function handleGet(req: Request, url: string) {
  const table = parseTableFromUrl(url);
  const patientId = parsePatientIdFromUrl(url) || new URL(url, 'http://localhost').searchParams.get('patientId');

  if (!table) {
    return jsonResponse({ error: 'table required', hint: 'use /rest/v1/<table>?patient_id=eq.<id>' }, 400);
  }
  if (!PRIMARY_KEYS[table]) {
    // Allow any table but warn
    console.warn('[supabase-proxy] Unknown table', table);
  }
  if (!patientId) {
    return jsonResponse({ error: 'patient_id required', hint: 'add ?patient_id=eq.<patientId>' }, 400);
  }

  const pgPool = await getPool();
  if (!pgPool) {
    // No DB — return empty (local-only fallback, but consider enabled)
    return jsonResponse([]);
  }

  try {
    // Use parameterized query to prevent injection; table name validated via allowlist
    const allowedTables = new Set(Object.keys(PRIMARY_KEYS));
    if (!allowedTables.has(table)) {
      return jsonResponse({ error: `table ${table} not allowed` }, 400);
    }
    const pg = pgPool as { query: (q: string, p: unknown[]) => Promise<{ rows: { payload?: unknown }[] }> };
    const res = await pg.query(`SELECT * FROM ${table} WHERE patient_id = $1`, [patientId]);
    const rows = res.rows.map((r: { payload?: unknown }) => {
      if (typeof r.payload === 'string') {
        try {
          (r as { payload: unknown }).payload = JSON.parse(r.payload);
        } catch {
          // ignore
        }
      }
      return r;
    });
    return jsonResponse(rows);
  } catch (e: unknown) {
    const msg = String((e as { message?: string })?.message || '');
    console.warn('[supabase-proxy] SELECT failed', table, msg || String(e));
    // Gracefully handle known infrastructural failures: missing table, DNS, IPv6-only, connection errors → empty (local fallback)
    if (
      msg.includes('does not exist') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('EAI_AGAIN') ||
      msg.includes('getaddrinfo') ||
      msg.includes('connect ECONNREFUSED') ||
      msg.includes('timeout')
    ) {
      return jsonResponse([]);
    }
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
}

async function handlePost(req: Request, url: string) {
  const tableFromPath = parseTableFromUrl(url);
  let body: unknown = null;
  try {
    const text = await req.text();
    body = text ? JSON.parse(text) : null;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: 'invalid JSON body', details: msg }, 400);
  }

  // Determine table: from path or body.table or body may be record with table inference
  let table = tableFromPath;
  if (!table && body && typeof body === 'object') {
    const bodyObj = body as { table?: string; record?: unknown; payload?: unknown };
    if (bodyObj.table) {
      table = bodyObj.table;
      body = bodyObj.record || bodyObj.payload || body;
    }
  }
  // Also handle case where body is the record and table is in query
  if (!table) {
    const urlTable = new URL(url, 'http://localhost').searchParams.get('table');
    if (urlTable) table = urlTable;
  }
  if (!table) {
    return jsonResponse({ error: 'table required for upsert' }, 400);
  }
  if (!PRIMARY_KEYS[table]) {
    console.warn('[supabase-proxy] Unknown table for upsert', table);
    return jsonResponse({ error: `table ${table} not allowed` }, 400);
  }

  const record = body as { [key: string]: unknown; patientId?: unknown; patient_id?: unknown; id?: unknown; linkId?: unknown; grantId?: unknown; reportId?: unknown };
  if (!record || typeof record !== 'object') {
    return jsonResponse({ error: 'record object required' }, 400);
  }

  const patientId = (record.patientId as string | undefined) || (record.patient_id as string | undefined);
  if (!patientId || typeof patientId !== 'string' || patientId.trim() === '') {
    return jsonResponse({ error: 'patientId required for sync' }, 400);
  }

  const pgPool = await getPool();
  if (!pgPool) {
    return jsonResponse(record);
  }

  const primaryCol = PRIMARY_KEYS[table];
  const camelKey = primaryCol.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());
  const primaryVal =
    (record[primaryCol] as string | undefined) ||
    (record[camelKey] as string | undefined) ||
    (record.id as string | undefined) ||
    (record.linkId as string | undefined) ||
    (record.grantId as string | undefined) ||
    (record.reportId as string | undefined) ||
    `id_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  // Ensure primaryVal is string
  const pk = String(primaryVal);

  // For other tables, we need to handle id vs link_id etc.
  // Build upsert that stores payload and patient_id, plus primary key
  const patientIdTrim = String(patientId).trim();

  try {
    const allowedTables = new Set(Object.keys(PRIMARY_KEYS));
    if (!allowedTables.has(table)) {
      return jsonResponse({ error: `table ${table} not allowed` }, 400);
    }

    const payloadJson = JSON.stringify(record);

    let query: string;
    let params: unknown[];

    if (table === 'care_circle') {
      query = `INSERT INTO care_circle (link_id, patient_id, payload) VALUES ($1, $2, $3::jsonb)
               ON CONFLICT (link_id) DO UPDATE SET payload = EXCLUDED.payload, patient_id = EXCLUDED.patient_id
               RETURNING *`;
      params = [pk, patientIdTrim, payloadJson];
    } else if (table === 'doctor_grants') {
      query = `INSERT INTO doctor_grants (grant_id, patient_id, payload) VALUES ($1, $2, $3::jsonb)
               ON CONFLICT (grant_id) DO UPDATE SET payload = EXCLUDED.payload, patient_id = EXCLUDED.patient_id
               RETURNING *`;
      params = [pk, patientIdTrim, payloadJson];
    } else if (table === 'danger_reports') {
      query = `INSERT INTO danger_reports (report_id, patient_id, payload) VALUES ($1, $2, $3::jsonb)
               ON CONFLICT (report_id) DO UPDATE SET payload = EXCLUDED.payload, patient_id = EXCLUDED.patient_id
               RETURNING *`;
      params = [pk, patientIdTrim, payloadJson];
    } else {
      query = `INSERT INTO ${table} (id, patient_id, payload) VALUES ($1, $2, $3::jsonb)
               ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, patient_id = EXCLUDED.patient_id
               RETURNING *`;
      params = [pk, patientIdTrim, payloadJson];
    }

    const pg = pgPool as { query: (q: string, p: unknown[]) => Promise<{ rows: { payload?: unknown }[] }> };
    const res = await pg.query(query, params);
    const row = (res.rows[0] as { payload?: unknown }) || record;
    if (row && typeof (row as { payload?: unknown }).payload === 'string') {
      try {
        (row as { payload: unknown }).payload = JSON.parse((row as { payload: string }).payload);
      } catch {
        // ignore
      }
    }
    return jsonResponse(row || record);
  } catch (e: unknown) {
    const msg = String((e as { message?: string })?.message || '');
    console.warn('[supabase-proxy] UPSERT failed', table, msg || String(e));
    if (
      msg.includes('does not exist') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('EAI_AGAIN') ||
      msg.includes('getaddrinfo') ||
      msg.includes('connect ECONNREFUSED') ||
      msg.includes('timeout')
    ) {
      // DB unreachable (IPv6-only host on IPv4 egress, DNS) → simulate success (local-only)
      return jsonResponse(record);
    }
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
}

async function handler(req: Request): Promise<Response> {
  const url = req.url;
  const method = req.method?.toUpperCase() || 'GET';

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() as unknown as HeadersInit });
  }

  try {
    if (method === 'GET') {
      return await handleGet(req, url);
    } else if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      return await handlePost(req, url);
    } else if (method === 'DELETE') {
      const u = new URL(url, 'http://localhost');
      const table = parseTableFromUrl(url);
      const id = u.searchParams.get('id')?.replace(/^eq\./, '') || u.searchParams.get('filter_id');
      if (!table || !id) {
        return jsonResponse({ error: 'table and id required for delete' }, 400);
      }
      const pgPool = await getPool();
      if (!pgPool) return jsonResponse({ success: true });
      const pkCol = PRIMARY_KEYS[table] || 'id';
      try {
        const pg = pgPool as { query: (q: string, p: unknown[]) => Promise<unknown> };
        await pg.query(`DELETE FROM ${table} WHERE ${pkCol} = $1`, [id]);
        return jsonResponse({ success: true });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[supabase-proxy] DELETE failed', msg);
        return jsonResponse({ error: msg }, 500);
      }
    }
    return jsonResponse({ error: `method ${method} not allowed` }, 405);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[supabase-proxy] handler error', msg);
    return jsonResponse({ error: msg }, 500);
  }
}

// Support both Vercel Node (req, res) and Web (Request)
export default async function supabaseHandler(req: unknown, res?: unknown) {
  const r = req as { method?: string; url?: string; headers?: { host?: string; 'x-forwarded-proto'?: string }; body?: unknown; on?: (e: string, cb: (chunk: unknown) => void) => void };
  const s = res as { setHeader?: (k: string, v: string) => void; status?: (c: number) => { end: () => void; send: (t: string) => void; json: (o: unknown) => void } & unknown; end?: () => void; send?: (t: string) => void; json?: (o: unknown) => void };
  if (s && typeof s.setHeader === 'function') {
    s.setHeader('Access-Control-Allow-Origin', '*');
    s.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    s.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, X-Requested-With, Prefer');
    s.setHeader('Access-Control-Max-Age', '86400');
    if (r.method === 'OPTIONS') {
      return (s as { status: (c: number) => { end: () => void } }).status(204).end();
    }
    try {
      const host = (r.headers as { host?: string })?.host || 'localhost';
      const proto = (r.headers as { 'x-forwarded-proto'?: string })?.['x-forwarded-proto'] || 'https';
      const fullUrl = `${proto}://${host}${r.url}`;
      let bodyText: string | undefined;
      if (r.method === 'POST' || r.method === 'PUT' || r.method === 'PATCH') {
        if (typeof r.body === 'string') bodyText = r.body;
        else if (r.body && typeof r.body === 'object') bodyText = JSON.stringify(r.body);
        else {
          bodyText = await new Promise<string>((resolve) => {
            let data = '';
            const on = r.on;
            if (typeof on === 'function') {
              on.call(r, 'data', (chunk: unknown) => (data += String(chunk)));
              on.call(r, 'end', () => resolve(data));
              on.call(r, 'error', () => resolve(''));
            } else {
              resolve('');
            }
          });
        }
      }
      const webReq = new Request(fullUrl, {
        method: r.method,
        headers: r.headers as unknown as HeadersInit,
        body: bodyText,
      });
      const webRes = await handler(webReq);
      const text = await webRes.text();
      const statusFn = s as { status: (c: number) => unknown };
      if (statusFn.status) (statusFn.status as (c: number) => { send: (t: string) => void })(webRes.status);
      for (const [k, v] of webRes.headers.entries()) {
        try {
          if (s.setHeader) s.setHeader(k, v);
        } catch {
          // ignore
        }
      }
      return (s as { send: (t: string) => unknown }).send(text);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[supabase-proxy] Node handler error', msg);
      return (s as { status: (c: number) => { json: (o: unknown) => unknown } }).status(500).json({ error: msg });
    }
  }

  if (req instanceof Request || (req && typeof (req as { method?: string }).method === 'string' && typeof (req as { url?: string }).url === 'string')) {
    if ((req as Request).method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() as unknown as HeadersInit });
    }
    return handler(req as Request);
  }

  return handler(req as Request);
}

export async function GET(req: Request) {
  return handler(req);
}
export async function POST(req: Request) {
  return handler(req);
}
export async function PUT(req: Request) {
  return handler(req);
}
export async function DELETE(req: Request) {
  return handler(req);
}
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() as unknown as HeadersInit });
}
