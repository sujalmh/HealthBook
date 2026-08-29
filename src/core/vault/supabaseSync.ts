/**
 * CareCanvas Supabase Sync & Hydration Layer (M2)
 *
 * Domain: LocalVault <-> Supabase Postgres persistence
 * - syncToSupabase: fire-and-forget upsert after local Map.set + EventBus emit (non-blocking, no event duplication)
 * - hydrateFromSupabase / hydrateFromSupabaseToVault: pull Postgres rows -> Map.set silently without emitting duplicate `added` inflation
 *
 * Patient isolation: exact `patientId === CANONICAL_PATIENT_ID` (never includes, never prefix)
 * Offline graceful: missing URL or Supabase down => {hydrated:0, skipped:true} without throw, no throw to bootstrap
 * EventBus relevance matrix: hydration does NOT emit added/updated events; only optional silent meta, no spurious rerender
 *
 * Ownership: ws-02-01 (src/core/vault/supabaseSync.ts)
 * DependsOn: ws-01-01 (src/core/supabase/client.ts)
 */

import type { LocalVaultManager } from './LocalVault.ts';
import {
  isSupabaseEnabled,
  getSupabaseClient,
  fetchSupabaseTable,
  upsertSupabaseRecord,
  CANONICAL_PATIENT_ID as CANONICAL_FROM_CLIENT,
} from '../supabase/client.ts';

// Re-export canonical for convenience (single source is src/core/vault/seed.ts but client also exports)
export const CANONICAL_PATIENT_ID = CANONICAL_FROM_CLIENT;

export interface HydrationResult {
  hydrated: number;
  skipped: boolean;
  error?: string;
  counts?: Record<string, number>;
}

export interface SyncResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

// ------------------------------------------------------------------
// Sync helper — non-blocking upsert, no EventBus re-emit
// ------------------------------------------------------------------

/**
 * Non-blocking sync of a single record to Supabase.
 * - Checks isSupabaseEnabled() first (env-gated, local-only fallback)
 * - Validates patientId presence (exact string, not empty)
 * - Calls upsertSupabaseRecord (generic) which does patientId === check and Supabase upsert
 * - Never emits EventBus events (no duplication); caller handles toast fallback via .catch
 * - Never throws; returns {ok, skipped, error}
 */
export async function syncToSupabase(table: string, record: any): Promise<SyncResult> {
  try {
    if (!isSupabaseEnabled()) return { ok: true, skipped: true };
    // Patient isolation: require patientId exact string (care_circle/doctor_grants/danger_reports also have patientId)
    const pid = (record as any)?.patientId;
    if (!pid || typeof pid !== 'string' || pid.trim() === '') {
      return { ok: false, error: `${table}: patientId required for sync` };
    }
    const res = await upsertSupabaseRecord(table as any, record as any);
    if ((res as any)?.skipped) return { ok: true, skipped: true };
    if (!(res as any)?.ok) return { ok: false, error: (res as any)?.error || `sync ${table} failed` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

// ------------------------------------------------------------------
// Hydration helpers — pull Postgres rows -> Map.set silently
// ------------------------------------------------------------------

// Snake -> camel mapping for reconstruction when payload not present
const SNAKE_TO_CAMEL: Record<string, string> = {
  patient_id: 'patientId',
  link_id: 'linkId',
  grant_id: 'grantId',
  report_id: 'reportId',
  generic_name: 'genericName',
  brand_name: 'brandName',
  timing_slots: 'timingSlots',
  with_food: 'withFood',
  avoid_grapefruit: 'avoidGrapefruit',
  avoid_alcohol: 'avoidAlcohol',
  avoid_dairy: 'avoidDairy',
  empty_stomach: 'emptyStomach',
  start_date: 'startDate',
  stop_date: 'stopDate',
  condition_name: 'conditionName',
  diagnosed_date: 'diagnosedDate',
  recorded_date: 'recordedDate',
  doctor_name: 'doctorName',
  doctor_id: 'doctorId',
  med_id: 'medId',
  med_name: 'medName',
  previous_dose: 'previousDose',
  proposed_dose: 'proposedDose',
  previous_slot: 'previousSlot',
  proposed_slot: 'proposedSlot',
  linked_lab_id: 'linkedLabId',
  linked_danger_id: 'linkedDangerId',
  approved_at: 'approvedAt',
  approved_by: 'approvedBy',
  approval_role: 'approvalRole',
  on_behalf_of: 'onBehalfOf',
  event_type: 'eventType',
  scheduled_date: 'scheduledDate',
  provider_name: 'providerName',
  notify_hours_before: 'notifyHoursBefore',
  is_completed: 'isCompleted',
  synced_to_calendar: 'syncedToCalendar',
  ics_data: 'icsData',
  shared_with_caregivers: 'sharedWithCaregivers',
  patient_name: 'patientName',
  caregiver_id: 'caregiverId',
  caregiver_user_id: 'caregiverUserId',
  caregiver_name: 'caregiverName',
  permission_level: 'permissionLevel',
  linked_date: 'linkedDate',
  granted_date: 'grantedDate',
  doctor_email: 'doctorEmail',
  duration_days: 'durationDays',
  permission_scope: 'permissionScope',
  issued_at: 'issuedAt',
  expires_at: 'expiresAt',
  access_token: 'accessToken',
  access_log: 'accessLog',
  revoked_at: 'revokedAt',
  test_panel: 'testPanel',
  due_date: 'dueDate',
  prescribed_by: 'prescribedBy',
  prescribed_date: 'prescribedDate',
  completed_lab_id: 'completedLabId',
  symptom_tags: 'symptomTags',
  free_text: 'freeText',
  severity_rating: 'severityRating',
  vital_signs: 'vitalSigns',
  photo_attachment: 'photoAttachment',
  triage_priority: 'triagePriority',
  first_aid_advice: 'firstAidAdvice',
  question_text: 'questionText',
  source_module: 'sourceModule',
  origin_module: 'originModule',
  linked_med_name: 'linkedMedName',
  linked_lab_marker: 'linkedLabMarker',
  clinical_rationale: 'clinicalRationale',
  included_in_export: 'includedInExport',
  created_at: 'createdAt',
  file_name: 'fileName',
  doc_type: 'docType',
  page_count: 'pageCount',
  upload_timestamp: 'uploadTimestamp',
  extracted_text: 'extractedText',
  raw_buffer: 'rawBuffer',
  extracted_fact_ids: 'extractedFactIds',
  marker_code: 'markerCode',
  normalized_value: 'normalizedValue',
  normalized_unit: 'normalizedUnit',
  draw_date: 'drawDate',
  reference_range: 'referenceRange',
  optimal_range: 'optimalRange',
  is_borderline: 'isBorderline',
  is_critical: 'isCritical',
  source_doc_id: 'sourceDocId',
  doctor_comments: 'doctorComments',
  fact_key: 'factKey',
  fact_value: 'factValue',
  plain_explanation: 'plainExplanation',
  plain_narration: 'plainNarration',
  approval_status: 'approvalStatus',
};

function normalizeRow(table: string, raw: any): any {
  // Prefer payload column if it contains a coherent record (has patientId)
  const base: any = raw?.payload && typeof raw.payload === 'object' && (raw.payload as any).patientId ? { ...(raw.payload as any) } : { ...(raw as any) };
  // Also merge snake columns where camel missing (payload may lack server-generated snake fields)
  for (const [snake, camel] of Object.entries(SNAKE_TO_CAMEL)) {
    if (raw[snake] !== undefined && base[camel] === undefined) {
      base[camel] = raw[snake];
    }
  }
  // Ensure id fields fallback from raw
  if (!base.id) {
    if (raw.id) base.id = raw.id;
    else if (raw.link_id) base.id = raw.link_id;
    else if (raw.grant_id) base.id = raw.grant_id;
    else if (raw.report_id) base.id = raw.report_id;
  }
  // Table-specific id aliases
  if (table === 'care_circle' && !base.linkId) {
    base.linkId = raw.link_id || raw.id || base.id;
    if (!base.id) base.id = base.linkId;
  }
  if (table === 'doctor_grants' && !base.grantId) {
    base.grantId = raw.grant_id || raw.id || base.id;
    if (!base.id) base.id = base.grantId;
  }
  if (table === 'danger_reports' && !base.reportId) {
    base.reportId = raw.report_id || raw.id || base.id;
    if (!base.id) base.id = base.reportId;
  }
  // If raw outer has patient_id but base missing, fill
  if (!base.patientId && raw.patient_id) base.patientId = raw.patient_id;
  // Ensure patientId is string exact
  if (base.patientId != null) base.patientId = String(base.patientId);
  return base;
}

// Table -> vault map definition for hydration
type TableMapping = { table: string; vaultKey: keyof LocalVaultManager; idField: string };

const HYDRATION_MAPPINGS: TableMapping[] = [
  { table: 'facts', vaultKey: 'facts' as any, idField: 'id' },
  { table: 'documents', vaultKey: 'documents' as any, idField: 'id' },
  { table: 'medications', vaultKey: 'meds' as any, idField: 'id' },
  { table: 'meds', vaultKey: 'meds' as any, idField: 'id' },
  { table: 'labs', vaultKey: 'labs' as any, idField: 'id' },
  { table: 'conditions', vaultKey: 'conditions' as any, idField: 'id' },
  { table: 'allergies', vaultKey: 'allergies' as any, idField: 'id' },
  { table: 'proposals', vaultKey: 'proposals' as any, idField: 'id' },
  { table: 'calendar_events', vaultKey: 'calendarEvents' as any, idField: 'id' },
  { table: 'care_circle', vaultKey: 'careCircle' as any, idField: 'linkId' },
  { table: 'doctor_grants', vaultKey: 'doctorGrants' as any, idField: 'grantId' },
  { table: 'due_cards', vaultKey: 'dueCards' as any, idField: 'id' },
  { table: 'danger_reports', vaultKey: 'dangerReports' as any, idField: 'reportId' },
  { table: 'question_bank', vaultKey: 'questionBank' as any, idField: 'id' },
];

/**
 * Core hydration: pulls each table's rows for patientId via fetchSupabaseTable (exact ===)
 * then silently Map.set without emitting duplicate `added` inflation.
 * has-check: if exists -> merged set without emitting added; if not -> set without emitting.
 * Patient isolation exact === on patientId string (skip mismatched rows even if server misfilters).
 * Never throws; Supabase down/offline => {hydrated:0, skipped:true}
 */
export async function hydrateFromSupabase(patientId: string, vault: LocalVaultManager): Promise<HydrationResult> {
  if (!patientId || typeof patientId !== 'string' || patientId.trim() === '') {
    return { hydrated: 0, skipped: true, error: 'patientId required' };
  }
  const trimmedPatientId = patientId.trim();
  // Env-gated: if not enabled, local-only fallback without network
  if (!isSupabaseEnabled()) {
    return { hydrated: 0, skipped: true };
  }
  const client = getSupabaseClient();
  if (!client) {
    return { hydrated: 0, skipped: true };
  }

  try {
    let total = 0;
    const counts: Record<string, number> = {};
    let skippedTables = 0;
    for (const mapping of HYDRATION_MAPPINGS) {
      const { table, vaultKey, idField } = mapping;
      try {
        const res = await fetchSupabaseTable<any>(table, trimmedPatientId);
        if ((res as any)?.skipped) {
          counts[table] = 0;
          skippedTables++;
          continue;
        }
        if ((res as any)?.error) {
          counts[table] = 0;
          continue;
        }
        const rows: any[] = (res as any)?.data ?? [];
        let hydratedForTable = 0;
        const map = (vault as any)[vaultKey] as Map<string, any> | undefined;
        if (!map || typeof map.has !== 'function' || typeof map.set !== 'function') {
          counts[table] = 0;
          continue;
        }
        for (const raw of rows) {
          const rec = normalizeRow(table, raw);
          // Patient isolation: validate BOTH sources exact === trimmedPatientId (PHI hard invariant)
          // Must reject if payload patientId mismatches or raw.patient_id mismatches (server misfilter defense)
          if (typeof rec.patientId !== 'string' || rec.patientId.trim() !== trimmedPatientId) continue;
          if (raw.patient_id != null && String(raw.patient_id).trim() !== trimmedPatientId) continue;
          // Resolve key via idField, fallback to id
          let key: string | undefined = rec[idField] ?? rec.id ?? rec.linkId ?? rec.grantId ?? rec.reportId;
          if (!key) {
            key = (raw as any).id ?? (raw as any).link_id ?? (raw as any).grant_id ?? (raw as any).report_id;
          }
          if (!key || typeof key !== 'string') continue;
          // Silent Map.set without EventBus emit (no duplication)
          // Distinguish has vs not-has but in both cases just set without emit
          if (map.has(key)) {
            const existing = map.get(key);
            // Merge shallow — incoming rec wins, but preserve existing fields not in rec
            const merged = { ...(existing as any), ...(rec as any) };
            map.set(key, merged);
          } else {
            map.set(key, rec);
          }
          hydratedForTable++;
          total++;
        }
        counts[table] = hydratedForTable;
      } catch {
        counts[table] = 0;
        // per-table error does not abort whole hydration — graceful fallback
      }
    }
    // Skipped semantics: if all tables reported skipped (e.g., postgresql:// without REST base), hydrate is skipped for bootstrap fallback
    if (total === 0 && skippedTables === HYDRATION_MAPPINGS.length) {
      return { hydrated: 0, skipped: true, counts };
    }
    return { hydrated: total, skipped: false, counts };
  } catch (e: any) {
    // Top-level failure (network, etc.) => graceful fallback, no throw
    return { hydrated: 0, skipped: true, error: e?.message || String(e) };
  }
}

/**
 * Alias with vault-first signature for bootstrap convenience:
 * hydrateFromSupabaseToVault(vault, patientId?) — patientId defaults to CANONICAL
 * Also supports hydrateFromSupabaseToVault(patientId, vault) legacy check via argument types.
 */
export async function hydrateFromSupabaseToVault(
  vaultOrPatientId: LocalVaultManager | string,
  patientIdOrVault?: string | LocalVaultManager
): Promise<HydrationResult> {
  // Detect overload: (vault, patientId?) vs (patientId, vault)
  // Preferred: (vault, patientId?)
  if (vaultOrPatientId && typeof (vaultOrPatientId as any).facts !== 'undefined' && typeof (vaultOrPatientId as any).meds !== 'undefined') {
    const vault = vaultOrPatientId as LocalVaultManager;
    const pid = typeof patientIdOrVault === 'string' ? patientIdOrVault : CANONICAL_FROM_CLIENT;
    return hydrateFromSupabase(pid, vault);
  }
  // Legacy: (patientId, vault)
  if (typeof vaultOrPatientId === 'string' && patientIdOrVault && typeof (patientIdOrVault as any).facts !== 'undefined') {
    return hydrateFromSupabase(vaultOrPatientId, patientIdOrVault as LocalVaultManager);
  }
  // Fallback: treat first arg as vault with default pid
  if (vaultOrPatientId && typeof (vaultOrPatientId as any).facts !== 'undefined') {
    return hydrateFromSupabase(CANONICAL_FROM_CLIENT, vaultOrPatientId as LocalVaultManager);
  }
  return { hydrated: 0, skipped: true, error: 'invalid arguments to hydrateFromSupabaseToVault' };
}

// Legacy alias for orchestrator docs that mention hydrateFromSupabase(patientId) returning helper bound to singleton
// Not used in tests but provided for spec completeness
export async function hydrateSupabaseToVault(vault: LocalVaultManager, patientId: string = CANONICAL_FROM_CLIENT): Promise<HydrationResult> {
  return hydrateFromSupabase(patientId, vault);
}

export default {
  syncToSupabase,
  hydrateFromSupabase,
  hydrateFromSupabaseToVault,
  hydrateSupabaseToVault,
};
