/**
 * CareCanvas Core: Supabase Auth over GoTrue REST (no new dependencies).
 * Server is the source of truth for identity. Passwords NEVER touch localStorage,
 * tools, or AI context — human types them into <input type="password"> and they go
 * straight to Supabase Auth. Only opaque session tokens are stored client-side.
 */

export interface AuthUser {
  id: string;
  email: string;
  user_metadata?: { display_name?: string; role?: string };
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  token_type: string;
  user: AuthUser;
}

export interface UserProfile {
  authUserId: string;
  patientId: string;
  email: string;
  name: string;
  role: 'patient' | 'doctor';
}

export interface ActiveSessionProfile {
  session: AuthSession;
  authUser: AuthUser;
  profile: UserProfile;
}

const SESSION_KEY = 'healthbook_session';
const ACTIVE_KEY = 'healthbook_active_user';

/** Demo bootstrap mapping — server-created demo accounts resolve to seeded vault IDs. */
const DEMO_PATIENT_IDS: Record<string, { patientId: string; name: string; role: 'patient' | 'doctor' }> = {
  'meera.krishnan@health.book': { patientId: 'patient-meera-krishnan', name: 'Meera Krishnan', role: 'patient' },
  'robert.dsouza@health.book': { patientId: 'patient-robert-dsouza', name: "Robert D'Souza", role: 'patient' },
  'meera.nair@health.book': { patientId: 'doctor-meera-nair', name: 'Dr. Meera Nair', role: 'doctor' },
};

function readEnv(key: string): string | null {
  try {
    const vite = (import.meta as unknown as { env?: Record<string, string> })?.env;
    if (vite && vite[key]) return vite[key];
  } catch { /* ignore */ }
  try {
    const proc = (globalThis as unknown as { process?: { env?: Record<string, string> } })?.process;
    if (proc?.env && proc.env[key]) return proc.env[key] as string;
  } catch { /* ignore */ }
  const mapped: Record<string, string> = {
    VITE_SUPABASE_URL: 'SUPABASE_URL',
    VITE_SUPABASE_ANON_KEY: 'SUPABASE_ANON_KEY',
  };
  try {
    const proc = (globalThis as unknown as { process?: { env?: Record<string, string> } })?.process;
    const alt = mapped[key];
    if (proc?.env && alt && proc.env[alt]) return proc.env[alt] as string;
  } catch { /* ignore */ }
  return null;
}

export function getAuthBaseUrl(): string | null {
  const url = readEnv('VITE_SUPABASE_URL');
  if (!url) return null;
  return url.replace(/\/$/, '') + '/auth/v1';
}

export function getRestBaseUrl(): string | null {
  const url = readEnv('VITE_SUPABASE_URL');
  if (!url) return null;
  return url.replace(/\/$/, '') + '/rest/v1';
}

function getAnonKey(): string | null {
  return readEnv('VITE_SUPABASE_ANON_KEY');
}

export function isAuthConfigured(): boolean {
  return !!getAuthBaseUrl() && !!getAnonKey();
}

interface GoTrueError {
  msg?: string;
  message?: string;
  error?: string;
  error_description?: string;
  code?: string;
}

function toAuthError(status: number, body: GoTrueError, fallback: string): { code: string; message: string } {
  const msg = body?.msg || body?.message || body?.error_description || body?.error || fallback;
  const low = `${status} ${msg}`.toLowerCase();
  if (status === 400 && (low.includes('already registered') || low.includes('already exists') || low.includes('duplicate'))) {
    return { code: 'ACCOUNT_EXISTS', message: 'An account with this email already exists. Please sign in.' };
  }
  if (status === 400 && (low.includes('invalid login') || low.includes('invalid_grant'))) {
    return { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' };
  }
  if (low.includes('email not confirmed') || low.includes('email_not_confirmed')) {
    return { code: 'EMAIL_NOT_CONFIRMED', message: 'Please confirm your email, then sign in.' };
  }
  if (status === 422 && low.includes('password')) {
    return { code: 'WEAK_PASSWORD', message: 'Password does not meet requirements (min 6 characters).' };
  }
  if (status === 429 || low.includes('rate limit') || low.includes('over_email')) {
    return { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a minute and try again.' };
  }
  return { code: `AUTH_${status}`, message: msg };
}

async function goTrue<T>(path: string, opts: { method?: string; body?: unknown; token?: string }): Promise<{ data: T | null; error: { code: string; message: string } | null }> {
  const base = getAuthBaseUrl();
  const anon = getAnonKey();
  if (!base || !anon) return { data: null, error: { code: 'AUTH_NOT_CONFIGURED', message: 'Supabase Auth is not configured.' } };
  try {
    const res = await fetch(`${base}${path}`, {
      method: opts.method || 'GET',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${opts.token || anon}`,
        'Content-Type': 'application/json',
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as T & GoTrueError;
    if (!res.ok) return { data: null, error: toAuthError(res.status, json, res.statusText) };
    return { data: json as T, error: null };
  } catch (e: unknown) {
    return { data: null, error: { code: 'NETWORK_ERROR', message: e instanceof Error ? e.message : 'Network request failed' } };
  }
}

export async function supabaseSignUp(
  email: string,
  password: string,
  meta: { name: string; role: 'patient' | 'doctor' }
): Promise<{ session: AuthSession | null; user: AuthUser | null; error: { code: string; message: string } | null }> {
  const { data, error } = await goTrue<{ user: AuthUser; session: AuthSession | null }>('/signup', {
    method: 'POST',
    body: { email, password, data: { display_name: meta.name, role: meta.role } },
  });
  if (error) return { session: null, user: null, error };
  return { session: data?.session || null, user: data?.user || null, error: null };
}

export async function supabaseSignIn(
  email: string,
  password: string
): Promise<{ session: AuthSession | null; user: AuthUser | null; error: { code: string; message: string } | null }> {
  const { data, error } = await goTrue<{ user: AuthUser; session: AuthSession }>('/token?grant_type=password', {
    method: 'POST',
    body: { email, password },
  });
  if (error) return { session: null, user: null, error };
  const session = data?.session || null;
  const user = (data as unknown as { user?: AuthUser })?.user || session?.user || null;
  return { session, user, error: null };
}

export async function supabaseRefreshSession(
  refreshToken: string
): Promise<{ session: AuthSession | null; error: { code: string; message: string } | null }> {
  const { data, error } = await goTrue<AuthSession>('/token?grant_type=refresh_token', {
    method: 'POST',
    body: { refresh_token: refreshToken },
  });
  if (error) return { session: null, error };
  return { session: data, error: null };
}

export async function supabaseGetUser(accessToken: string): Promise<{ user: AuthUser | null; error: { code: string; message: string } | null }> {
  const { data, error } = await goTrue<AuthUser>('/user', { token: accessToken });
  if (error) return { user: null, error };
  return { user: data, error: null };
}

export async function supabaseSignOut(accessToken: string): Promise<void> {
  try {
    await goTrue('/logout', { method: 'POST', token: accessToken });
  } catch { /* ignore — local session cleared regardless */ }
  clearSession();
}

// --- Session store (opaque tokens only — never passwords) ---

export function storeSession(session: AuthSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch { /* ignore */ }
}

export function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as AuthSession;
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

function isExpiringSoon(session: AuthSession): boolean {
  const nowSec = Math.floor(Date.now() / 1000);
  return session.expires_at - nowSec < 120;
}

/** Valid session, refreshing transparently when close to expiry. Null when signed out. */
export async function getValidSession(): Promise<AuthSession | null> {
  const s = loadSession();
  if (!s) return null;
  if (!isExpiringSoon(s)) return s;
  if (!s.refresh_token) return s;
  const { session, error } = await supabaseRefreshSession(s.refresh_token);
  if (error || !session) return s.expires_at * 1000 > Date.now() ? s : null;
  storeSession(session);
  return session;
}

/** Bearer token for authenticated PostgREST calls (RLS). Null when signed out. */
export async function getAccessToken(): Promise<string | null> {
  const s = await getValidSession();
  return s?.access_token || null;
}

// --- Profiles (auth user <-> vault patientId mapping, lives in Supabase) ---

function shortId(authUserId: string): string {
  return authUserId.replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase() || 'newuser';
}

export function derivePatientId(authUserId: string, role: 'patient' | 'doctor', email: string): string {
  const demo = DEMO_PATIENT_IDS[email.trim().toLowerCase()];
  if (demo) return demo.patientId;
  return `${role === 'doctor' ? 'doctor' : 'patient'}-${shortId(authUserId)}`;
}

export function demoDefaultsForEmail(email: string): { patientId: string; name: string; role: 'patient' | 'doctor' } | null {
  return DEMO_PATIENT_IDS[email.trim().toLowerCase()] || null;
}

async function restProfiles<T>(query: string, opts?: { method?: string; body?: unknown; token?: string }): Promise<{ data: T | null; error: string | null }> {
  const base = getRestBaseUrl();
  const anon = getAnonKey();
  if (!base || !anon) return { data: null, error: 'Supabase not configured' };
  try {
    const res = await fetch(`${base}/profiles?${query}`, {
      method: opts?.method || 'GET',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${opts?.token || anon}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return { data: null, error: `${res.status} ${text.slice(0, 200)}` };
    }
    return { data: (await res.json()) as T, error: null };
  } catch (e: unknown) {
    return { data: null, error: e instanceof Error ? e.message : 'Network request failed' };
  }
}

export async function fetchProfile(authUserId: string, token: string): Promise<{ profile: UserProfile | null; error: string | null }> {
  const { data, error } = await restProfiles<UserProfile[]>(`auth_user_id=eq.${encodeURIComponent(authUserId)}&select=*`, { token });
  if (error) return { profile: null, error };
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return { profile: null, error: null };
  return {
    profile: {
      authUserId: row.authUserId || authUserId,
      patientId: row.patientId,
      email: row.email,
      name: row.name,
      role: row.role === 'doctor' ? 'doctor' : 'patient',
    },
    error: null,
  };
}

export async function ensureProfile(input: {
  token: string;
  authUserId: string;
  email: string;
  name: string;
  role: 'patient' | 'doctor';
}): Promise<{ profile: UserProfile | null; error: string | null }> {
  const existing = await fetchProfile(input.authUserId, input.token);
  if (existing.error) return { profile: null, error: existing.error };
  if (existing.profile) return { profile: existing.profile, error: null };
  const patientId = derivePatientId(input.authUserId, input.role, input.email);
  const body = {
    auth_user_id: input.authUserId,
    patient_id: patientId,
    email: input.email.trim().toLowerCase(),
    name: input.name.slice(0, 64) || 'Anonymous',
    role: input.role,
  };
  const { data, error } = await restProfiles<UserProfile[]>('', { method: 'POST', body, token: input.token });
  if (error) return { profile: null, error };
  const row = (Array.isArray(data) ? data[0] : data) as unknown as Record<string, unknown> | null;
  if (!row) return { profile: null, error: 'Profile creation returned no row' };
  const p = row as unknown as { auth_user_id?: string; patient_id?: string; email?: string; name?: string; role?: string };
  return {
    profile: {
      authUserId: (p.auth_user_id as string) || input.authUserId,
      patientId: (p.patient_id as string) || patientId,
      email: (p.email as string) || input.email,
      name: (p.name as string) || input.name,
      role: (p.role === 'doctor' ? 'doctor' : 'patient') as 'patient' | 'doctor',
    },
    error: null,
  };
}

// --- Shared completion (views + MCP bridge use this — single code path) ---

export interface CompletedAuth {
  userId: string;
  name: string;
  email: string;
  role: 'patient' | 'doctor';
  isProxy: boolean;
  permissionLevel?: 'view_only' | 'manage' | 'full';
  createdAt: string;
}

/** Persist the session pointer (profile only — no secrets) and return the app profile. */
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

/** Full boot resolution: session -> user -> profile. Null when signed out/invalid. */
export async function resolveSessionProfile(): Promise<ActiveSessionProfile | null> {
  if (!isAuthConfigured()) return null;
  const session = await getValidSession();
  if (!session) return null;
  const { user, error } = await supabaseGetUser(session.access_token);
  if (error || !user) {
    clearSession();
    return null;
  }
  const { profile, error: pErr } = await fetchProfile(user.id, session.access_token);
  if (pErr || !profile) return null;
  return { session, authUser: user, profile };
}

/** Remove legacy plaintext credential stores from this browser (one-way hygiene). */
export function purgeLegacyCredentialStores(): string[] {
  const removed: string[] = [];
  try {
    const victims: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k === 'healthbook_users' || k.startsWith('healthbook_cred_') || k === 'carecanvas_users' || k.startsWith('carecanvas_cred_')) {
        victims.push(k);
      }
    }
    for (const k of victims) {
      localStorage.removeItem(k);
      removed.push(k);
    }
  } catch { /* ignore */ }
  return removed;
}
