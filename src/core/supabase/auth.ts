export interface AuthUser {
  id: string;
  email: string;
  user_metadata?: { display_name?: string; role?: string };
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: AuthUser;
}

export interface UserProfile {
  authUserId: string;
  patientId: string;
  email: string;
  name: string;
  role: 'patient' | 'doctor';
}

export interface CompletedAuth {
  userId: string;
  name: string;
  email?: string;
  role: 'patient' | 'doctor';
  isProxy: false;
  permissionLevel?: 'view_only' | 'manage' | 'full';
  createdAt: string;
}

const SESSION_KEY = 'healthbook_session';
const ACTIVE_KEY = 'healthbook_active_user';

const DEMO_IDS: Record<string, { patientId: string; name: string; role: 'patient' | 'doctor' }> = {
  'meera.krishnan@health.book': { patientId: 'patient-meera-krishnan', name: 'Meera Krishnan', role: 'patient' },
  'robert.dsouza@health.book': { patientId: 'patient-robert-dsouza', name: "Robert D'Souza", role: 'patient' },
  'meera.nair@health.book': { patientId: 'doctor-meera-nair', name: 'Dr. Meera Nair', role: 'doctor' },
};

function baseUrl(): string | null {
  try {
    const env = import.meta.env;
    const v = env && env.VITE_SUPABASE_URL;
    if (typeof v === 'string' && v) return v.replace(/\/$/, '');
  } catch { /* ignore */ }
  return null;
}

function anonKey(): string | null {
  try {
    const env = import.meta.env;
    const v = env && env.VITE_SUPABASE_ANON_KEY;
    if (typeof v === 'string' && v) return v;
  } catch { /* ignore */ }
  return null;
}

export function isAuthConfigured(): boolean {
  return !!baseUrl() && !!anonKey();
}

interface AuthError {
  code: string;
  message: string;
}

function mapError(status: number, body: any, fallback: string): AuthError {
  const msg = body?.msg || body?.message || body?.error_description || body?.error || fallback;
  const low = `${status} ${msg}`.toLowerCase();
  if (low.includes('already registered') || low.includes('already exists') || low.includes('duplicate')) {
    return { code: 'ACCOUNT_EXISTS', message: 'An account with this email already exists. Please sign in.' };
  }
  if (low.includes('invalid login') || low.includes('invalid_grant')) {
    return { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' };
  }
  if (low.includes('email not confirmed') || low.includes('email_not_confirmed')) {
    return { code: 'EMAIL_NOT_CONFIRMED', message: 'Please confirm your email, then sign in.' };
  }
  if (status === 422) return { code: 'WEAK_PASSWORD', message: 'Password does not meet requirements (min 6 characters).' };
  if (status === 429 || low.includes('rate limit')) {
    return { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a minute and try again.' };
  }
  return { code: `AUTH_${status}`, message: msg };
}

async function call(path: string, opts: { method?: string; body?: unknown; token?: string }): Promise<{ json: any; error: AuthError | null }> {
  const base = baseUrl();
  const anon = anonKey();
  if (!base || !anon) return { json: null, error: { code: 'AUTH_NOT_CONFIGURED', message: 'Supabase Auth is not configured.' } };
  try {
    const res = await fetch(`${base}/auth/v1${path}`, {
      method: opts.method || 'GET',
      headers: { apikey: anon, Authorization: `Bearer ${opts.token || anon}`, 'Content-Type': 'application/json' },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { json: null, error: mapError(res.status, json, res.statusText) };
    return { json, error: null };
  } catch (e: unknown) {
    return { json: null, error: { code: 'NETWORK_ERROR', message: e instanceof Error ? e.message : 'Network request failed' } };
  }
}

export async function supabaseSignUp(email: string, password: string, meta: { name: string; role: 'patient' | 'doctor' }) {
  const { json, error } = await call('/signup', { method: 'POST', body: { email, password, data: { display_name: meta.name, role: meta.role } } });
  if (error) return { session: null, user: null, error };
  const session = (json?.session || null) as AuthSession | null;
  const user = (json?.user || null) as AuthUser | null;
  return { session, user, error: null };
}

export async function supabaseSignIn(email: string, password: string) {
  const { json, error } = await call('/token?grant_type=password', { method: 'POST', body: { email, password } });
  if (error) return { session: null, user: null, error };
  const session = (json?.session || json || null) as AuthSession | null;
  const user = ((json as any)?.user || session?.user || null) as AuthUser | null;
  return { session, user, error: null };
}

export async function supabaseSignOut(accessToken: string): Promise<void> {
  try {
    await call('/logout', { method: 'POST', token: accessToken });
  } catch { /* ignore */ }
  clearSession();
}

async function refreshSession(refreshToken: string): Promise<AuthSession | null> {
  const { json, error } = await call('/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: refreshToken } });
  if (error || !json) return null;
  return json as AuthSession;
}

export function storeSession(session: AuthSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch { /* ignore */ }
}

export function loadSession(): AuthSession | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as AuthSession;
    if (!s?.access_token) return null;
    return s;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ACTIVE_KEY);
  } catch { /* ignore */ }
}

async function validSession(): Promise<AuthSession | null> {
  const s = loadSession();
  if (!s) return null;
  if (s.expires_at * 1000 - Date.now() > 120000) return s;
  if (!s.refresh_token) return s.expires_at * 1000 > Date.now() ? s : null;
  const next = await refreshSession(s.refresh_token);
  if (!next) return s.expires_at * 1000 > Date.now() ? s : null;
  storeSession(next);
  return next;
}

export async function getAccessToken(): Promise<string | null> {
  const s = await validSession();
  return s?.access_token || null;
}

function restUrl(): string | null {
  const base = baseUrl();
  return base ? `${base}/rest/v1` : null;
}

async function restProfiles(query: string, opts?: { method?: string; body?: unknown; token?: string }): Promise<{ rows: any; error: string | null }> {
  const url = restUrl();
  const anon = anonKey();
  if (!url || !anon) return { rows: null, error: 'Supabase not configured' };
  try {
    const res = await fetch(`${url}/profiles?${query}`, {
      method: opts?.method || 'GET',
      headers: { apikey: anon, Authorization: `Bearer ${opts?.token || anon}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) return { rows: null, error: `${res.status} ${(await res.text()).slice(0, 160)}` };
    return { rows: await res.json(), error: null };
  } catch (e: unknown) {
    return { rows: null, error: e instanceof Error ? e.message : 'Network request failed' };
  }
}

function toProfile(row: any, authUserId: string): UserProfile {
  return {
    authUserId: row.auth_user_id || authUserId,
    patientId: row.patient_id,
    email: row.email,
    name: row.name,
    role: row.role === 'doctor' ? 'doctor' : 'patient',
  };
}

function newPatientId(authUserId: string, role: 'patient' | 'doctor', email: string): string {
  const demo = DEMO_IDS[email.trim().toLowerCase()];
  if (demo) return demo.patientId;
  const short = authUserId.replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase() || 'newuser';
  return `${role === 'doctor' ? 'doctor' : 'patient'}-${short}`;
}

export async function ensureProfile(input: { token: string; authUserId: string; email: string; name: string; role: 'patient' | 'doctor' }): Promise<{ profile: UserProfile | null; error: string | null }> {
  const found = await restProfiles(`auth_user_id=eq.${encodeURIComponent(input.authUserId)}&select=*`, { token: input.token });
  if (found.error) return { profile: null, error: found.error };
  const row = Array.isArray(found.rows) ? found.rows[0] : found.rows;
  if (row?.patient_id) return { profile: toProfile(row, input.authUserId), error: null };
  const created = await restProfiles('', {
    method: 'POST',
    token: input.token,
    body: {
      auth_user_id: input.authUserId,
      patient_id: newPatientId(input.authUserId, input.role, input.email),
      email: input.email.trim().toLowerCase(),
      name: input.name.slice(0, 64) || 'Anonymous',
      role: input.role,
    },
  });
  if (created.error) return { profile: null, error: created.error };
  const createdRow = Array.isArray(created.rows) ? created.rows[0] : created.rows;
  if (!createdRow?.patient_id) return { profile: null, error: 'Profile creation returned no row' };
  return { profile: toProfile(createdRow, input.authUserId), error: null };
}

export function persistActiveProfile(profile: UserProfile): CompletedAuth {
  const completed: CompletedAuth = {
    userId: profile.patientId,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    isProxy: false,
    permissionLevel: profile.role === 'doctor' ? 'view_only' : undefined,
    createdAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(completed));
  } catch { /* ignore */ }
  return completed;
}

export async function resolveSessionProfile(): Promise<{ session: AuthSession; authUser: AuthUser; profile: UserProfile } | null> {
  if (!isAuthConfigured()) return null;
  const session = await validSession();
  if (!session) return null;
  const { json, error } = await call('/user', { token: session.access_token });
  if (error || !json?.id) {
    clearSession();
    return null;
  }
  const authUser = json as AuthUser;
  const { rows, error: pErr } = await restProfiles(`auth_user_id=eq.${encodeURIComponent(authUser.id)}&select=*`, { token: session.access_token });
  const row = !pErr && Array.isArray(rows) ? rows[0] : null;
  if (!row?.patient_id) return null;
  return { session, authUser, profile: toProfile(row, authUser.id) };
}

export function purgeLegacyCredentialStores(): string[] {
  const removed: string[] = [];
  try {
    const victims: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k === 'healthbook_users' || k.startsWith('healthbook_cred_') || k === 'carecanvas_users' || k.startsWith('carecanvas_cred_'))) victims.push(k);
    }
    for (const k of victims) {
      localStorage.removeItem(k);
      removed.push(k);
    }
  } catch { /* ignore */ }
  return removed;
}
