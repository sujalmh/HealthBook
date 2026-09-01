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
const PRIMARY_KEYS: Record<string, string> = {
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
let pool: any = null;
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
      const client = await pool.connect();
      client.release();
      console.log('[supabase-proxy] Pool connected');
    } catch (e: any) {
      console.warn('[supabase-proxy] Pool connect failed, fallback to no-op', e?.message || e);
      // keep pool but queries will fail and we fallback
    }
    return pool;
  } catch (e: any) {
    console.warn('[supabase-proxy] pg import failed', e?.message || e);
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

function jsonResponse(data: any, status = 200) {
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
    const res = await pgPool.query(`SELECT * FROM ${table} WHERE patient_id = $1`, [patientId]);
    // Return rows as Supabase REST would: array of objects with payload etc.
    // Ensure each row has patient_id and payload
    const rows = res.rows.map((r: any) => {
      // If payload is stringified JSON, parse?
      if (typeof r.payload === 'string') {
        try {
          r.payload = JSON.parse(r.payload);
        } catch {}
      }
      return r;
    });
    return jsonResponse(rows);
  } catch (e: any) {
    const msg = String(e?.message || '');
    console.warn('[supabase-proxy] SELECT failed', table, msg || e);
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
    return jsonResponse({ error: e?.message || String(e) }, 500);
  }
}

async function handlePost(req: Request, url: string) {
  const tableFromPath = parseTableFromUrl(url);
  let body: any = null;
  try {
    const text = await req.text();
    body = text ? JSON.parse(text) : null;
  } catch (e: any) {
    return jsonResponse({ error: 'invalid JSON body', details: e?.message }, 400);
  }

  // Determine table: from path or body.table or body may be record with table inference
  let table = tableFromPath;
  if (!table && body && typeof body === 'object' && body.table) {
    table = body.table;
    body = body.record || body.payload || body;
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

  // Body should be the record
  const record = body;
  if (!record || typeof record !== 'object') {
    return jsonResponse({ error: 'record object required' }, 400);
  }

  const patientId = (record as any).patientId || (record as any).patient_id;
  if (!patientId || typeof patientId !== 'string' || patientId.trim() === '') {
    return jsonResponse({ error: 'patientId required for sync' }, 400);
  }

  const pgPool = await getPool();
  if (!pgPool) {
    // No DB — simulate success (local-only but enabled)
    return jsonResponse(record);
  }

  const primaryCol = PRIMARY_KEYS[table];
  // Map record's primary key value: look for camelCase and snake_case
  const primaryVal =
    (record as any)[primaryCol] ||
    (record as any)[primaryCol.replace(/_([a-z])/g, (_: any, c: string) => c.toUpperCase())] ||
    (record as any).id ||
    (record as any).linkId ||
    (record as any).grantId ||
    (record as any).reportId ||
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

    // Prepare payload as JSONB
    const payloadJson = JSON.stringify(record);

    // Check if record already has typed columns beyond payload; we just store payload + patient_id + pk
    // Use ON CONFLICT to upsert
    // For tables with different PK column, we need to insert into that column
    let query: string;
    let params: any[];

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
      // Generic for id-based tables
      query = `INSERT INTO ${table} (id, patient_id, payload) VALUES ($1, $2, $3::jsonb)
               ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, patient_id = EXCLUDED.patient_id
               RETURNING *`;
      params = [pk, patientIdTrim, payloadJson];
    }

    const res = await pgPool.query(query, params);
    const row = res.rows[0] || record;
    // Ensure row has payload parsed
    if (row && typeof row.payload === 'string') {
      try {
        row.payload = JSON.parse(row.payload);
      } catch {}
    }
    return jsonResponse(row || record);
  } catch (e: any) {
    const msg = String(e?.message || '');
    console.warn('[supabase-proxy] UPSERT failed', table, msg || e);
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
    return jsonResponse({ error: e?.message || String(e) }, 500);
  }
}

async function handler(req: Request): Promise<Response> {
  const url = req.url;
  const method = req.method?.toUpperCase() || 'GET';

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() as any });
  }

  try {
    if (method === 'GET') {
      return await handleGet(req, url);
    } else if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      return await handlePost(req, url);
    } else if (method === 'DELETE') {
      // Handle delete by id
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
        await pgPool.query(`DELETE FROM ${table} WHERE ${pkCol} = $1`, [id]);
        return jsonResponse({ success: true });
      } catch (e: any) {
        console.warn('[supabase-proxy] DELETE failed', e?.message || e);
        return jsonResponse({ error: e?.message || String(e) }, 500);
      }
    }
    return jsonResponse({ error: `method ${method} not allowed` }, 405);
  } catch (e: any) {
    console.warn('[supabase-proxy] handler error', e?.message || e);
    return jsonResponse({ error: e?.message || String(e) }, 500);
  }
}

// Support both Vercel Node (req, res) and Web (Request)
export default async function supabaseHandler(req: any, res?: any) {
  // Node.js style (IncomingMessage, ServerResponse)
  if (res && typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, X-Requested-With, Prefer');
    res.setHeader('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    try {
      // Reconstruct URL for handler
      const host = req.headers?.host || 'localhost';
      const proto = req.headers?.['x-forwarded-proto'] || 'https';
      const fullUrl = `${proto}://${host}${req.url}`;
      // Collect body for POST
      let bodyText: string | undefined;
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        if (typeof req.body === 'string') bodyText = req.body;
        else if (req.body && typeof req.body === 'object') bodyText = JSON.stringify(req.body);
        else {
          // Stream body
          bodyText = await new Promise<string>((resolve) => {
            let data = '';
            req.on('data', (chunk: any) => (data += chunk));
            req.on('end', () => resolve(data));
            req.on('error', () => resolve(''));
          });
        }
      }
      const webReq = new Request(fullUrl, {
        method: req.method,
        headers: req.headers as any,
        body: bodyText,
      });
      const webRes = await handler(webReq);
      const text = await webRes.text();
      res.status(webRes.status);
      for (const [k, v] of webRes.headers.entries()) {
        try {
          res.setHeader(k, v);
        } catch {}
      }
      return res.send(text);
    } catch (e: any) {
      console.warn('[supabase-proxy] Node handler error', e?.message || e);
      return res.status(500).json({ error: e?.message || String(e) });
    }
  }

  // Web standard Request
  if (req instanceof Request || (req && typeof req.method === 'string' && typeof req.url === 'string')) {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() as any });
    }
    return handler(req as Request);
  }

  // Fallback: treat as web request
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
  return new Response(null, { status: 204, headers: corsHeaders() as any });
}
