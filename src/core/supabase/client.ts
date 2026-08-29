/**
 * CareCanvas Supabase Client — Env-only persistence layer (M1)
 *
 * Domain: Supabase Postgres persistence for CareCanvas single-patient vault.
 * Host (comment-only, never with password): db.vcgnjsxmigcaboayemmj.supabase.co
 * Connection is via DATABASE_URL env only — never hard-coded password literal.
 *
 * Env resolution (priority order, env-only, local fallback):
 *   1. import.meta.env.VITE_SUPABASE_DB_URL
 *   2. process.env.DATABASE_URL
 *   3. process.env.SUPABASE_DB_URL
 *   4. import.meta.env.VITE_SUPABASE_URL (Supabase REST URL pattern)
 *   5. process.env.SUPABASE_URL / VITE_SUPABASE_URL
 *
 * When no URL is present, all helpers gracefully degrade to local-only
 * (isSupabaseEnabled() === false, clients return null, sync helpers no-op).
 *
 * This module uses a lightweight fetch-based stub — it does NOT require
 * @supabase/supabase-js. The stub can be mocked in tests and downstream
 * sync/hydration (ws-02-01) will call these helpers non-blockingly.
 *
 * Ownership: ws-01-01 (src/core/supabase/*)
 * Follows single-patient cohesion: patientId === CANONICAL_PATIENT_ID scoping
 * where applicable; helpers validate patientId presence and isolate by exact ===.
 */

import type { Fact, DocumentRecord, MedicationRecord, LabRecord, AllergyRecord, ConditionRecord, ProposalRecord, CalendarEventRecord, QuestionBankItem, DueCardRecord } from '../../types/vault.ts';
import type { LinkedCareProfile, DoctorAccessGrant } from '../../types/carecircle.ts';
import type { DangerSignReport } from '../../types/safety.ts';

// Re-export canonical id for convenience (single source is src/core/vault/seed.ts)
export const CANONICAL_PATIENT_ID = 'patient-s-devi';

// ------------------------------------------------------------------
// Env resolution — never throws, never logs password
// ------------------------------------------------------------------

function readViteEnv(key: string): string | null {
  try {
    // Access import.meta.env safely — Vite provides it, Node/tests may not
    const meta: any = typeof import.meta !== 'undefined' ? (import.meta as any) : undefined;
    const env = meta?.env;
    if (env && typeof env[key] === 'string' && env[key].trim() !== '') {
      return env[key].trim();
    }
  } catch {
    // ignore — env not available in this runtime
  }
  return null;
}

function readProcessEnv(key: string): string | null {
  try {
    if (typeof process !== 'undefined' && (process as any).env) {
      const v = (process as any).env[key];
      if (typeof v === 'string' && v.trim() !== '') return v.trim();
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Resolve primary DATABASE_URL per requirement:
 * import.meta.env.VITE_SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
 * Also supports VITE_SUPABASE_URL + ANON_KEY pattern as fallback.
 */
function resolveDatabaseUrl(): string | null {
  // Primary chain per spec
  const viteDbUrl = readViteEnv('VITE_SUPABASE_DB_URL');
  if (viteDbUrl) return viteDbUrl;

  const procDbUrl = readProcessEnv('DATABASE_URL');
  if (procDbUrl) return procDbUrl;

  const supaDbUrl = readProcessEnv('SUPABASE_DB_URL');
  if (supaDbUrl) return supaDbUrl;

  // Also support VITE_* via process.env in Node/test harnesses
  const viteDbUrlProc = readProcessEnv('VITE_SUPABASE_DB_URL');
  if (viteDbUrlProc) return viteDbUrlProc;

  // Fallback: Supabase REST URL pattern (VITE_SUPABASE_URL + ANON_KEY)
  // This is secondary; if present we treat as enabled (client will use REST)
  const viteSupabaseUrl = readViteEnv('VITE_SUPABASE_URL') || readProcessEnv('VITE_SUPABASE_URL') || readProcessEnv('SUPABASE_URL');
  if (viteSupabaseUrl) return viteSupabaseUrl;

  // Also check generic VITE_SUPABASE_URL via Vite env without DB suffix
  const supaUrlVite = readViteEnv('VITE_SUPABASE_URL');
  if (supaUrlVite) return supaUrlVite;

  return null;
}

function resolveAnonKey(): string | null {
  return (
    readViteEnv('VITE_SUPABASE_ANON_KEY') ||
    readProcessEnv('VITE_SUPABASE_ANON_KEY') ||
    readProcessEnv('SUPABASE_ANON_KEY') ||
    readProcessEnv('SUPABASE_KEY') ||
    null
  );
}

export interface SupabaseConfig {
  url: string | null;
  anonKey: string | null;
  enabled: boolean;
}

/**
 * Returns env-derived config without throwing. Safe to call at module load.
 */
export function getSupabaseConfig(): SupabaseConfig {
  const url = resolveDatabaseUrl();
  const anonKey = resolveAnonKey();
  return {
    url,
    anonKey,
    enabled: !!url && url.length > 0,
  };
}

/**
 * True iff a DATABASE_URL / SUPABASE_URL is present in env.
 * Never throws; missing URL => false (local-only fallback).
 */
export function isSupabaseEnabled(): boolean {
  try {
    return getSupabaseConfig().enabled;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------
// Lightweight fetch/pg stub client
// ------------------------------------------------------------------

/**
 * All tables mirroring LocalVault's 13 persistent stores.
 * Names align with src/core/supabase/schema.sql (snake_case).
 */
export const SUPABASE_TABLES = [
  'facts',
  'documents',
  'meds', // Back-compat alias for medications
  'medications',
  'labs',
  'conditions',
  'allergies',
  'proposals',
  'calendar_events',
  'care_circle',
  'doctor_grants',
  'due_cards',
  'danger_reports',
  'question_bank',
] as const;

export type SupabaseTableName = (typeof SUPABASE_TABLES)[number] | string;

export interface SupabaseResult<T = any> {
  data: T | null;
  error: string | null;
  skipped?: boolean;
}

export interface SupabaseTableClient {
  /** Fetch rows scoped to a patientId (exact ===) */
  selectByPatient<T = any>(patientId: string): Promise<SupabaseResult<T[]>>;
  /** Generic select with patientId filter via eq */
  select<T = any>(filters?: Record<string, any>): Promise<SupabaseResult<T[]>>;
  /** Insert a single record (patientId required if record is patient-scoped) */
  insert<T = any>(record: T): Promise<SupabaseResult<T>>;
  /** Upsert (insert or update on id conflict) */
  upsert<T = any>(record: T): Promise<SupabaseResult<T>>;
  /** Delete by id (and patientId for safety where applicable) */
  delete(id: string): Promise<SupabaseResult<null>>;
}

export interface SupabaseClient {
  readonly config: SupabaseConfig;
  /** Table-scoped query builder */
  from(table: SupabaseTableName): SupabaseTableClient;
  /** Raw health check — returns enabled flag without network */
  isEnabled(): boolean;
  /** Exposed url for diagnostics (never includes password in logs — url itself may contain password from env, caller must not log raw) */
  getUrl(): string | null;
}

// Internal helpers for the stub fetch layer

function isPostgresConnectionString(url: string): boolean {
  return url.startsWith('postgresql://') || url.startsWith('postgres://');
}

function toRestBaseUrl(url: string): string | null {
  // If url is already https://...supabase.co, use as REST base
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // Strip trailing slash
    return url.replace(/\/+$/, '');
  }
  if (isPostgresConnectionString(url)) {
    // Postgres connection string cannot be used as HTTP REST base directly.
    // Return null to indicate stub/no-op fetch path. Real deployments would
    // translate host db.vcgnjsxmigcaboayemmj.supabase.co to https REST endpoint,
    // but we never attempt that without explicit REST env — stub returns no-op.
    return null;
  }
  return null;
}

class LightweightTableClient implements SupabaseTableClient {
  constructor(private baseUrl: string | null, private table: string, private anonKey: string | null) {}

  private get restBase(): string | null {
    if (!this.baseUrl) return null;
    return toRestBaseUrl(this.baseUrl);
  }

  async selectByPatient<T = any>(patientId: string): Promise<SupabaseResult<T[]>> {
    if (!patientId) return { data: [], error: 'patientId required' };
    return this.select<T>({ patient_id: patientId });
  }

  /** Map TypeScript patientId -> SQL patient_id for PostgREST */
  private mapFilterKey(k: string): string {
    if (k === 'patientId') return 'patient_id';
    if (k === 'linkId') return 'link_id';
    if (k === 'grantId') return 'grant_id';
    if (k === 'reportId') return 'report_id';
    return k;
  }

  private toDbRecord<T>(record: T): T {
    const r: any = { ...(record as any) };
    // Map camelCase -> snake_case for DB columns while preserving original for payload
    if (r.patientId && !r.patient_id) r.patient_id = r.patientId;
    if (r.linkId && !r.link_id) r.link_id = r.linkId;
    if (r.grantId && !r.grant_id) r.grant_id = r.grantId;
    if (r.reportId && !r.report_id) r.report_id = r.reportId;
    // Also ensure payload JSONB mirrors full record if caller expects it
    if (!r.payload) r.payload = { ...(record as any) };
    return r as T;
  }

  async select<T = any>(filters?: Record<string, any>): Promise<SupabaseResult<T[]>> {
    const base = this.restBase;
    if (!base) {
      // Postgres URL or missing REST base -> stub no-op (local fallback).
      // Return empty without error so caller treats as "no remote data"
      return { data: [], error: null, skipped: true };
    }
    try {
      const params = new URLSearchParams();
      if (filters) {
        for (const [k, v] of Object.entries(filters)) {
          if (v !== undefined && v !== null) params.set(this.mapFilterKey(k), `eq.${String(v)}`);
        }
      }
      const url = `${base}/rest/v1/${this.table}${params.toString() ? `?${params.toString()}` : ''}`;
      const headers: Record<string, string> = {
        apikey: this.anonKey || '',
        Authorization: this.anonKey ? `Bearer ${this.anonKey}` : '',
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      };
      // Remove empty auth headers if no anon key
      if (!this.anonKey) {
        delete headers.apikey;
        delete headers.Authorization;
      }
      const res = await fetch(url, { headers, method: 'GET' });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        return { data: null, error: `select ${this.table} failed: ${res.status} ${text}` };
      }
      const data = (await res.json()) as T[];
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e?.message || String(e) };
    }
  }

  async insert<T = any>(record: T): Promise<SupabaseResult<T>> {
    const base = this.restBase;
    if (!base) return { data: null, error: null, skipped: true };
    try {
      const url = `${base}/rest/v1/${this.table}`;
      const headers: Record<string, string> = {
        apikey: this.anonKey || '',
        Authorization: this.anonKey ? `Bearer ${this.anonKey}` : '',
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      };
      if (!this.anonKey) {
        delete headers.apikey;
        delete headers.Authorization;
      }
      const dbRecord = this.toDbRecord(record);
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(dbRecord) });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        return { data: null, error: `insert ${this.table} failed: ${res.status} ${text}` };
      }
      const data = (await res.json()) as any;
      const row = Array.isArray(data) ? data[0] : data;
      return { data: (row as T) ?? (record as T), error: null };
    } catch (e: any) {
      return { data: null, error: e?.message || String(e) };
    }
  }

  async upsert<T = any>(record: T): Promise<SupabaseResult<T>> {
    const base = this.restBase;
    if (!base) return { data: null, error: null, skipped: true };
    try {
      const url = `${base}/rest/v1/${this.table}`;
      const headers: Record<string, string> = {
        apikey: this.anonKey || '',
        Authorization: this.anonKey ? `Bearer ${this.anonKey}` : '',
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      };
      if (!this.anonKey) {
        delete headers.apikey;
        delete headers.Authorization;
      }
      const dbRecord = this.toDbRecord(record);
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(dbRecord) });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        return { data: null, error: `upsert ${this.table} failed: ${res.status} ${text}` };
      }
      const data = (await res.json()) as any;
      const row = Array.isArray(data) ? data[0] : data;
      return { data: (row as T) ?? (record as T), error: null };
    } catch (e: any) {
      return { data: null, error: e?.message || String(e) };
    }
  }

  async delete(id: string): Promise<SupabaseResult<null>> {
    const base = this.restBase;
    if (!base) return { data: null, error: null, skipped: true };
    try {
      const url = `${base}/rest/v1/${this.table}?id=eq.${encodeURIComponent(id)}`;
      const headers: Record<string, string> = {
        apikey: this.anonKey || '',
        Authorization: this.anonKey ? `Bearer ${this.anonKey}` : '',
        'Content-Type': 'application/json',
      };
      if (!this.anonKey) {
        delete headers.apikey;
        delete headers.Authorization;
      }
      const res = await fetch(url, { method: 'DELETE', headers });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        return { data: null, error: `delete ${this.table} failed: ${res.status} ${text}` };
      }
      return { data: null, error: null };
    } catch (e: any) {
      return { data: null, error: e?.message || String(e) };
    }
  }
}

class LightweightSupabaseClientImpl implements SupabaseClient {
  public readonly config: SupabaseConfig;

  constructor(config: SupabaseConfig) {
    this.config = config;
  }

  from(table: SupabaseTableName): SupabaseTableClient {
    return new LightweightTableClient(this.config.url, String(table), this.config.anonKey);
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getUrl(): string | null {
    return this.config.url;
  }
}

// Singleton holder — lazily created, respects env changes in tests via reset helper
let singleton: SupabaseClient | null = null;
let singletonUrl: string | null = null;

function createClientOrNull(): SupabaseClient | null {
  const cfg = getSupabaseConfig();
  if (!cfg.enabled || !cfg.url) return null;
  // Memoize; if URL changed (test harness), recreate
  if (singleton && singletonUrl === cfg.url) return singleton;
  singleton = new LightweightSupabaseClientImpl(cfg);
  singletonUrl = cfg.url;
  return singleton;
}

/**
 * Returns a lightweight Supabase client when env is configured, otherwise null.
 * Never throws; local-only fallback when missing URL.
 */
export function getSupabaseClient(): SupabaseClient | null {
  try {
    return createClientOrNull();
  } catch {
    return null;
  }
}

/** Alias for getSupabaseClient — used by vault sync layer */
export function getDbClient(): SupabaseClient | null {
  return getSupabaseClient();
}

/** Test helper: reset singleton (used in ws-04 integration tests) */
export function _resetSupabaseClientForTests(): void {
  singleton = null;
  singletonUrl = null;
}

// ------------------------------------------------------------------
// Typed helpers for LocalVault stores (patientId === CANONICAL_PATIENT_ID scoping)
// ------------------------------------------------------------------

export type SyncResult = { ok: boolean; skipped?: boolean; error?: string };

function requirePatientId(patientId: string | undefined, context: string): string | null {
  if (!patientId || patientId.trim() === '') return `${context}: patientId required`;
  return null;
}

function isDisabledResult(): SyncResult {
  return { ok: true, skipped: true };
}

/** Generic scoped sync — validates patientId, checks enabled, then upserts */
async function syncRecord<T extends { id?: string; reportId?: string; grantId?: string; linkId?: string; patientId?: string }>(
  table: SupabaseTableName,
  record: T,
  patientId: string | undefined
): Promise<SyncResult> {
  const pid = (record as any)?.patientId ?? patientId;
  const validationError = requirePatientId(pid, `sync ${table}`);
  if (validationError) return { ok: false, error: validationError };

  const client = getSupabaseClient();
  if (!client) return isDisabledResult();

  const res = await client.from(table).upsert(record);
  if (res.skipped) return { ok: true, skipped: true };
  if (res.error) return { ok: false, error: res.error };
  return { ok: true };
}

/** Generic scoped fetch — exact patientId === isolation */
async function fetchByPatient<T>(table: SupabaseTableName, patientId: string): Promise<{ data: T[]; error: string | null; skipped?: boolean }> {
  const err = requirePatientId(patientId, `fetch ${table}`);
  if (err) return { data: [], error: err };
  const client = getSupabaseClient();
  if (!client) return { data: [], error: null, skipped: true };
  const res = await client.from(table).selectByPatient<T>(patientId);
  if (res.skipped) return { data: [], error: null, skipped: true };
  return { data: (res.data as T[]) ?? [], error: res.error ?? null };
}

// ---- Per-store typed sync/fetch helpers ----
// All helpers enforce patientId presence (== canonical scoping where applicable)
// and are no-ops when Supabase is not enabled.

export async function syncFactToSupabase(record: Fact): Promise<SyncResult> {
  return syncRecord('facts', record, record.patientId);
}
export async function fetchFactsFromSupabase(patientId: string = CANONICAL_PATIENT_ID) {
  return fetchByPatient<Fact>('facts', patientId);
}

export async function syncMedicationToSupabase(record: MedicationRecord): Promise<SyncResult> {
  return syncRecord('medications', record, record.patientId);
}
export async function syncMedToSupabase(record: MedicationRecord): Promise<SyncResult> {
  return syncMedicationToSupabase(record);
}
export async function fetchMedicationsFromSupabase(patientId: string = CANONICAL_PATIENT_ID) {
  // Try canonical table name first, fallback to meds alias for hydration compatibility
  const primary = await fetchByPatient<MedicationRecord>('medications', patientId);
  if (!primary.skipped && primary.data.length > 0) return primary;
  if (primary.skipped) {
    const alias = await fetchByPatient<MedicationRecord>('meds', patientId);
    return alias.data.length > 0 ? alias : primary;
  }
  return primary;
}

export async function syncLabToSupabase(record: LabRecord): Promise<SyncResult> {
  return syncRecord('labs', record, record.patientId);
}
export async function fetchLabsFromSupabase(patientId: string = CANONICAL_PATIENT_ID) {
  return fetchByPatient<LabRecord>('labs', patientId);
}

export async function syncConditionToSupabase(record: ConditionRecord): Promise<SyncResult> {
  return syncRecord('conditions', record, record.patientId);
}
export async function fetchConditionsFromSupabase(patientId: string = CANONICAL_PATIENT_ID) {
  return fetchByPatient<ConditionRecord>('conditions', patientId);
}

export async function syncAllergyToSupabase(record: AllergyRecord): Promise<SyncResult> {
  return syncRecord('allergies', record, record.patientId);
}
export async function fetchAllergiesFromSupabase(patientId: string = CANONICAL_PATIENT_ID) {
  return fetchByPatient<AllergyRecord>('allergies', patientId);
}

export async function syncProposalToSupabase(record: ProposalRecord): Promise<SyncResult> {
  return syncRecord('proposals', record, record.patientId);
}
export async function fetchProposalsFromSupabase(patientId: string = CANONICAL_PATIENT_ID) {
  return fetchByPatient<ProposalRecord>('proposals', patientId);
}

export async function syncCalendarEventToSupabase(record: CalendarEventRecord): Promise<SyncResult> {
  return syncRecord('calendar_events', record, record.patientId);
}
export async function fetchCalendarEventsFromSupabase(patientId: string = CANONICAL_PATIENT_ID) {
  return fetchByPatient<CalendarEventRecord>('calendar_events', patientId);
}

export async function syncCareCircleMemberToSupabase(record: LinkedCareProfile): Promise<SyncResult> {
  return syncRecord('care_circle', record as any, record.patientId);
}
export async function syncCareCircleToSupabase(record: LinkedCareProfile): Promise<SyncResult> {
  return syncCareCircleMemberToSupabase(record);
}
export async function fetchCareCircleFromSupabase(patientId: string = CANONICAL_PATIENT_ID) {
  return fetchByPatient<LinkedCareProfile>('care_circle', patientId);
}

export async function syncDoctorGrantToSupabase(record: DoctorAccessGrant): Promise<SyncResult> {
  return syncRecord('doctor_grants', record as any, record.patientId);
}
export async function fetchDoctorGrantsFromSupabase(patientId: string = CANONICAL_PATIENT_ID) {
  return fetchByPatient<DoctorAccessGrant>('doctor_grants', patientId);
}

export async function syncDueCardToSupabase(record: DueCardRecord): Promise<SyncResult> {
  return syncRecord('due_cards', record, record.patientId);
}
export async function fetchDueCardsFromSupabase(patientId: string = CANONICAL_PATIENT_ID) {
  return fetchByPatient<DueCardRecord>('due_cards', patientId);
}

export async function syncDangerReportToSupabase(record: DangerSignReport): Promise<SyncResult> {
  return syncRecord('danger_reports', record as any, record.patientId);
}
export async function fetchDangerReportsFromSupabase(patientId: string = CANONICAL_PATIENT_ID) {
  return fetchByPatient<DangerSignReport>('danger_reports', patientId);
}

export async function syncDocumentToSupabase(record: DocumentRecord): Promise<SyncResult> {
  return syncRecord('documents', record, record.patientId);
}
export async function fetchDocumentsFromSupabase(patientId: string = CANONICAL_PATIENT_ID) {
  return fetchByPatient<DocumentRecord>('documents', patientId);
}

export async function syncQuestionBankItemToSupabase(record: QuestionBankItem): Promise<SyncResult> {
  return syncRecord('question_bank', record, record.patientId);
}
export async function syncQuestionToSupabase(record: QuestionBankItem): Promise<SyncResult> {
  return syncQuestionBankItemToSupabase(record);
}
export async function fetchQuestionBankFromSupabase(patientId: string = CANONICAL_PATIENT_ID) {
  return fetchByPatient<QuestionBankItem>('question_bank', patientId);
}

// Generic helpers for hydration layer (ws-02-01 will use patient-isolated fetch)
export async function fetchSupabaseTable<T = any>(table: SupabaseTableName, patientId: string): Promise<{ data: T[]; error: string | null; skipped?: boolean }> {
  return fetchByPatient<T>(table, patientId);
}
export async function upsertSupabaseRecord<T = any>(table: SupabaseTableName, record: T & { patientId?: string }): Promise<SyncResult> {
  return syncRecord(table, record as any, (record as any)?.patientId);
}

// Canonical re-exports for ergonomic barrel
export type { Fact, MedicationRecord, LabRecord, ConditionRecord, AllergyRecord, ProposalRecord, CalendarEventRecord, LinkedCareProfile, DoctorAccessGrant, DueCardRecord, DangerSignReport, DocumentRecord, QuestionBankItem };
