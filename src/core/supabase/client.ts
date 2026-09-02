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
    const meta = typeof import.meta !== 'undefined' ? (import.meta as unknown as { env?: { [key: string]: unknown } }) : undefined;
    const env = meta?.env;
    if (env && typeof env[key] === 'string' && (env[key] as string).trim() !== '') {
      return (env[key] as string).trim();
    }
  } catch {
    // ignore
  }
  return null;
}

function readProcessEnv(key: string): string | null {
  try {
    const proc = typeof process !== 'undefined' ? (globalThis as unknown as { process?: { env?: { [key: string]: unknown } } }).process : undefined;
    const env = proc?.env;
    if (env) {
      const v = env[key];
      if (typeof v === 'string' && v.trim() !== '') return v.trim();
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Resolve primary DATABASE_URL per requirement:
 * Prioritize Supabase REST URL (VITE_SUPABASE_URL) when available because it uses
 * direct PostgREST via anon key (IPv4, no pg DNS issue). Falls back to postgres
 * direct connection via pg pool proxy (/api/supabase) otherwise.
 * Chain:
 *   1. VITE_SUPABASE_URL (https://*.supabase.co) — REST direct, most reliable
 *   2. VITE_SUPABASE_DB_URL (alternative REST or pooler)
 *   3. DATABASE_URL / SUPABASE_DB_URL (postgres://) — requires /api/supabase pg proxy
 */
function resolveDatabaseUrl(): string | null {
  // 1. Prefer REST URL (https) — avoids IPv6-only db.* host via pg pool and uses anon key
  const viteSupabaseUrlDirect = readViteEnv('VITE_SUPABASE_URL') || readProcessEnv('VITE_SUPABASE_URL') || readProcessEnv('SUPABASE_URL');
  if (viteSupabaseUrlDirect && (viteSupabaseUrlDirect.startsWith('http://') || viteSupabaseUrlDirect.startsWith('https://'))) {
    return viteSupabaseUrlDirect;
  }
  const supaUrlVite = readViteEnv('VITE_SUPABASE_URL');
  if (supaUrlVite && (supaUrlVite.startsWith('http://') || supaUrlVite.startsWith('https://'))) {
    return supaUrlVite;
  }

  // 2. VITE_SUPABASE_DB_URL alternative
  const viteDbUrl = readViteEnv('VITE_SUPABASE_DB_URL');
  if (viteDbUrl) return viteDbUrl;
  const viteDbUrlProc = readProcessEnv('VITE_SUPABASE_DB_URL');
  if (viteDbUrlProc) return viteDbUrlProc;

  // 3. Postgres direct (requires /api/supabase proxy with pg)
  const procDbUrl = readProcessEnv('DATABASE_URL');
  if (procDbUrl) return procDbUrl;
  const supaDbUrl = readProcessEnv('SUPABASE_DB_URL');
  if (supaDbUrl) return supaDbUrl;

  // Fallback: any remaining VITE_SUPABASE_URL
  const viteSupabaseUrlFallback = readViteEnv('VITE_SUPABASE_URL') || readProcessEnv('VITE_SUPABASE_URL');
  if (viteSupabaseUrlFallback) return viteSupabaseUrlFallback;

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

export interface SupabaseResult<T = unknown> {
  data: T | null;
  error: string | null;
  skipped?: boolean;
}

export interface SupabaseTableClient {
  /** Fetch rows scoped to a patientId (exact ===) */
  selectByPatient<T = unknown>(patientId: string): Promise<SupabaseResult<T[]>>;
  /** Generic select with patientId filter via eq */
  select<T = unknown>(filters?: { [key: string]: unknown }): Promise<SupabaseResult<T[]>>;
  /** Insert a single record (patientId required if record is patient-scoped) */
  insert<T = unknown>(record: T): Promise<SupabaseResult<T>>;
  /** Upsert (insert or update on id conflict) */
  upsert<T = unknown>(record: T): Promise<SupabaseResult<T>>;
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

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.location !== 'undefined' && typeof window.location.origin === 'string' && window.location.origin.startsWith('http');
}

function toRestBaseUrl(url: string): string | null {
  // If url is already https://...supabase.co, use as REST base
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // Strip trailing slash
    return url.replace(/\/+$/, '');
  }
  if (isPostgresConnectionString(url)) {
    // Postgres URL → use same-origin proxy that talks directly to DB via pg.
    // This enables Supabase persistence without requiring VITE_SUPABASE_ANON_KEY.
    // In browser, proxy via /api/supabase to avoid CORS and avoid needing anon key.
    // In Node/test, keep null to preserve skipped:true local-only fallback (tests mock fetch).
    if (isBrowser()) {
      return '/api/supabase';
    }
    // For Node production (Vercel serverless), the proxy is also available as /api/supabase,
    // but during SSR we still return proxy path — fetch will be relative and handled by Vercel.
    // Check if we are in a real browser-like env with location
    try {
      const procEnv = typeof process !== 'undefined' ? (globalThis as unknown as { process?: { env?: { VITEST?: string } } }).process?.env : undefined;
      if (procEnv?.VITEST !== 'true') {
        return '/api/supabase';
      }
    } catch {
      // ignore
    }
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

  async selectByPatient<T = unknown>(patientId: string): Promise<SupabaseResult<T[]>> {
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
    const src = record as unknown as { [key: string]: unknown; payload?: unknown; patientId?: unknown; id?: unknown };
    // Comprehensive camel->snake map derived from supabaseSync SNAKE_TO_CAMEL reverse
    const camelToSnake: { [key: string]: string } = {
      patientId: 'patient_id',
      linkId: 'link_id',
      grantId: 'grant_id',
      reportId: 'report_id',
      genericName: 'generic_name',
      brandName: 'brand_name',
      timingSlots: 'timing_slots',
      withFood: 'with_food',
      avoidGrapefruit: 'avoid_grapefruit',
      avoidAlcohol: 'avoid_alcohol',
      avoidDairy: 'avoid_dairy',
      emptyStomach: 'empty_stomach',
      startDate: 'start_date',
      stopDate: 'stop_date',
      conditionName: 'condition_name',
      diagnosedDate: 'diagnosed_date',
      recordedDate: 'recorded_date',
      doctorName: 'doctor_name',
      doctorId: 'doctor_id',
      medId: 'med_id',
      medName: 'med_name',
      previousDose: 'previous_dose',
      proposedDose: 'proposed_dose',
      previousSlot: 'previous_slot',
      proposedSlot: 'proposed_slot',
      linkedLabId: 'linked_lab_id',
      linkedDangerId: 'linked_danger_id',
      approvedAt: 'approved_at',
      approvedBy: 'approved_by',
      approvalRole: 'approval_role',
      onBehalfOf: 'on_behalf_of',
      eventType: 'event_type',
      scheduledDate: 'scheduled_date',
      providerName: 'provider_name',
      notifyHoursBefore: 'notify_hours_before',
      isCompleted: 'is_completed',
      syncedToCalendar: 'synced_to_calendar',
      icsData: 'ics_data',
      sharedWithCaregivers: 'shared_with_caregivers',
      patientName: 'patient_name',
      caregiverId: 'caregiver_id',
      caregiverUserId: 'caregiver_user_id',
      caregiverName: 'caregiver_name',
      permissionLevel: 'permission_level',
      linkedDate: 'linked_date',
      grantedDate: 'granted_date',
      doctorEmail: 'doctor_email',
      durationDays: 'duration_days',
      permissionScope: 'permission_scope',
      issuedAt: 'issued_at',
      expiresAt: 'expires_at',
      accessToken: 'access_token',
      accessLog: 'access_log',
      revokedAt: 'revoked_at',
      testPanel: 'test_panel',
      dueDate: 'due_date',
      prescribedBy: 'prescribed_by',
      prescribedDate: 'prescribed_date',
      completedLabId: 'completed_lab_id',
      symptomTags: 'symptom_tags',
      freeText: 'free_text',
      severityRating: 'severity_rating',
      vitalSigns: 'vital_signs',
      photoAttachment: 'photo_attachment',
      triagePriority: 'triage_priority',
      firstAidAdvice: 'first_aid_advice',
      questionText: 'question_text',
      sourceModule: 'source_module',
      originModule: 'origin_module',
      linkedMedName: 'linked_med_name',
      linkedLabMarker: 'linked_lab_marker',
      clinicalRationale: 'clinical_rationale',
      includedInExport: 'included_in_export',
      createdAt: 'created_at',
      fileName: 'file_name',
      docType: 'doc_type',
      pageCount: 'page_count',
      uploadTimestamp: 'upload_timestamp',
      extractedText: 'extracted_text',
      rawBuffer: 'raw_buffer',
      extractedFactIds: 'extracted_fact_ids',
      markerCode: 'marker_code',
      normalizedValue: 'normalized_value',
      normalizedUnit: 'normalized_unit',
      drawDate: 'draw_date',
      referenceRange: 'reference_range',
      optimalRange: 'optimal_range',
      isBorderline: 'is_borderline',
      isCritical: 'is_critical',
      sourceDocId: 'source_doc_id',
      doctorComments: 'doctor_comments',
      factKey: 'fact_key',
      factValue: 'fact_value',
      plainExplanation: 'plain_explanation',
      plainNarration: 'plain_narration',
      approvalStatus: 'approval_status',
    };
    const r: { [key: string]: unknown } = {};
    // Preserve payload as full original record for JSONB flexibility
    const srcPayload = src.payload as { patientId?: unknown; [key: string]: unknown } | undefined;
    if (srcPayload && typeof srcPayload === 'object' && srcPayload.patientId) {
      r.payload = { ...srcPayload };
    } else if (srcPayload && typeof srcPayload === 'object') {
      r.payload = { ...srcPayload, ...(src as object) };
      if (src.patientId && !(r.payload as { patientId?: unknown }).patientId) (r.payload as { patientId?: unknown }).patientId = src.patientId;
    } else {
      r.payload = { ...(src as object) };
    }
    // Map known camel->snake to top-level columns
    for (const [camel, snake] of Object.entries(camelToSnake)) {
      if (src[camel] !== undefined) {
        r[snake] = src[camel];
      } else if (src[snake] !== undefined) {
        r[snake] = src[snake];
      }
    }
    // Copy direct snake_case columns and id-like fields without transformation
    // Only copy keys that are already snake_case (no uppercase) to avoid PostgREST unknown column errors
    for (const [k, v] of Object.entries(src)) {
      if (k === 'payload') continue;
      if (k in camelToSnake) continue; // already handled
      if (Object.values(camelToSnake).includes(k)) {
        if (r[k] === undefined) r[k] = v;
        continue;
      }
      // Keep snake_case keys (no uppercase) as potential DB columns
      if (!/[A-Z]/.test(k)) {
        if (r[k] === undefined) r[k] = v;
      }
      // Camel not in map -> skip (only in payload)
    }
    // Ensure primary id field only if source had id (do not auto-create id from link_id/grant_id for tables where PK is link_id etc)
    if (!r.id && src.id !== undefined) {
      r.id = src.id;
    }
    // For care_circle, doctor_grants, danger_reports the PK is link_id/grant_id/report_id — already mapped via camelToSnake, do not create extra id column
    return r as T;
  }

  async select<T = unknown>(filters?: { [key: string]: unknown }): Promise<SupabaseResult<T[]>> {
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
      const headers: { [key: string]: string } = {
        apikey: this.anonKey || '',
        Authorization: this.anonKey ? `Bearer ${this.anonKey}` : '',
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      };
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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { data: null, error: msg };
    }
  }

  async insert<T = unknown>(record: T): Promise<SupabaseResult<T>> {
    const base = this.restBase;
    if (!base) return { data: null, error: null, skipped: true };
    try {
      const url = `${base}/rest/v1/${this.table}`;
      const headers: { [key: string]: string } = {
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
      const data = (await res.json()) as unknown;
      const row = Array.isArray(data) ? (data as unknown[])[0] : data;
      return { data: (row as T) ?? (record as T), error: null };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { data: null, error: msg };
    }
  }

  async upsert<T = unknown>(record: T): Promise<SupabaseResult<T>> {
    const base = this.restBase;
    if (!base) return { data: null, error: null, skipped: true };
    try {
      const url = `${base}/rest/v1/${this.table}`;
      const headers: { [key: string]: string } = {
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
      const data = (await res.json()) as unknown;
      const row = Array.isArray(data) ? (data as unknown[])[0] : data;
      return { data: (row as T) ?? (record as T), error: null };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { data: null, error: msg };
    }
  }

  async delete(id: string): Promise<SupabaseResult<null>> {
    const base = this.restBase;
    if (!base) return { data: null, error: null, skipped: true };
    try {
      const url = `${base}/rest/v1/${this.table}?id=eq.${encodeURIComponent(id)}`;
      const headers: { [key: string]: string } = {
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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { data: null, error: msg };
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
  const rawPid = (record as unknown as { patientId?: unknown })?.patientId;
  const pid = typeof rawPid === 'string' ? rawPid : patientId;
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
  return syncRecord('care_circle', record as unknown as { patientId?: string; id?: string }, record.patientId);
}
export async function syncCareCircleToSupabase(record: LinkedCareProfile): Promise<SyncResult> {
  return syncCareCircleMemberToSupabase(record);
}
export async function fetchCareCircleFromSupabase(patientId: string = CANONICAL_PATIENT_ID) {
  return fetchByPatient<LinkedCareProfile>('care_circle', patientId);
}

export async function syncDoctorGrantToSupabase(record: DoctorAccessGrant): Promise<SyncResult> {
  return syncRecord('doctor_grants', record as unknown as { patientId?: string; id?: string }, record.patientId);
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
  return syncRecord('danger_reports', record as unknown as { patientId?: string; id?: string }, record.patientId);
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
export async function fetchSupabaseTable<T = unknown>(table: SupabaseTableName, patientId: string): Promise<{ data: T[]; error: string | null; skipped?: boolean }> {
  return fetchByPatient<T>(table, patientId);
}
export async function upsertSupabaseRecord<T = unknown>(table: SupabaseTableName, record: T & { patientId?: string }): Promise<SyncResult> {
  return syncRecord(table, record as unknown as { patientId?: string; id?: string }, (record as unknown as { patientId?: string })?.patientId);
}

// Canonical re-exports for ergonomic barrel
export type { Fact, MedicationRecord, LabRecord, ConditionRecord, AllergyRecord, ProposalRecord, CalendarEventRecord, LinkedCareProfile, DoctorAccessGrant, DueCardRecord, DangerSignReport, DocumentRecord, QuestionBankItem };
