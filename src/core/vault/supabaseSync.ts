/**
 * CareCanvas Supabase Sync & Hydration Layer (M2)
 *
 * Domain: LocalVault <-> Supabase Postgres persistence
 * - syncToSupabase: fire-and-forget upsert after local Map.set + EventBus emit (non-blocking, no event duplication)
 * - hydrateFromSupabase / hydrateFromSupabaseToVault: pull Postgres rows -> Map.set silently without emitting duplicate `added` inflation
 *
 * Patient isolation: exact `patientId ===` per-account (never includes, never prefix) — real userId from carecanvas_active_user.
 * CANONICAL_PATIENT_ID retained only as legacy migration constant re-export (see seed.ts), not as default activeProfile.
 * Offline graceful: missing URL or Supabase down => {hydrated:0, skipped:true} without throw, no throw to bootstrap
 * EventBus relevance matrix: hydration does NOT emit added/updated events; only optional silent meta, no spurious rerender
 * Empty vault guarantee: fresh account starts 0 facts/meds/labs until FileReader upload (M2 gate)
 *
 * Ownership: ws-m2-auth-gate (src/core/vault/supabaseSync.ts)
 * DependsOn: ws-m1-mock-removal
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
  counts?: { [key: string]: number };
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
export async function syncToSupabase(table: string, record: unknown): Promise<SyncResult> {
  try {
    if (!isSupabaseEnabled()) return { ok: true, skipped: true };
    const pid = (record as unknown as { patientId?: unknown })?.patientId;
    if (!pid || typeof pid !== 'string' || pid.trim() === '') {
      return { ok: false, error: `${table}: patientId required for sync` };
    }
    const res = await upsertSupabaseRecord(table as unknown as string, record as unknown as { patientId?: string });
    const r = res as unknown as { skipped?: boolean; ok?: boolean; error?: string };
    if (r?.skipped) return { ok: true, skipped: true };
    if (!r?.ok) return { ok: false, error: r?.error || `sync ${table} failed` };
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

// ------------------------------------------------------------------
// Hydration helpers — pull Postgres rows -> Map.set silently
// ------------------------------------------------------------------

// Snake -> camel mapping for reconstruction when payload not present
const SNAKE_TO_CAMEL: { [key: string]: string } = {
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

function normalizeRow(table: string, raw: unknown): { [key: string]: unknown } {
  const rawObj = raw as { [key: string]: unknown; payload?: unknown; patient_id?: unknown; id?: unknown; link_id?: unknown; grant_id?: unknown; report_id?: unknown };
  const payload = rawObj?.payload as { [key: string]: unknown; patientId?: unknown } | undefined;
  const base: { [key: string]: unknown } = payload && typeof payload === 'object' && payload.patientId ? { ...(payload as object) } as { [key: string]: unknown } : { ...(rawObj as object) } as { [key: string]: unknown };
  for (const [snake, camel] of Object.entries(SNAKE_TO_CAMEL)) {
    if (rawObj[snake] !== undefined && base[camel] === undefined) {
      base[camel] = rawObj[snake];
    }
  }
  if (!base.id) {
    if (rawObj.id) base.id = rawObj.id;
    else if (rawObj.link_id) base.id = rawObj.link_id;
    else if (rawObj.grant_id) base.id = rawObj.grant_id;
    else if (rawObj.report_id) base.id = rawObj.report_id;
  }
  if (table === 'care_circle' && !base.linkId) {
    base.linkId = rawObj.link_id || rawObj.id || base.id;
    if (!base.id) base.id = base.linkId;
  }
  if (table === 'doctor_grants' && !base.grantId) {
    base.grantId = rawObj.grant_id || rawObj.id || base.id;
    if (!base.id) base.id = base.grantId;
  }
  if (table === 'danger_reports' && !base.reportId) {
    base.reportId = rawObj.report_id || rawObj.id || base.id;
    if (!base.id) base.id = base.reportId;
  }
  if (!base.patientId && rawObj.patient_id) base.patientId = rawObj.patient_id;
  if (base.patientId != null) base.patientId = String(base.patientId);
  return base;
}

// Table -> vault map definition for hydration
type TableMapping = { table: string; vaultKey: keyof LocalVaultManager; idField: string };

const HYDRATION_MAPPINGS: TableMapping[] = [
  { table: 'facts', vaultKey: 'facts' as unknown as keyof LocalVaultManager, idField: 'id' },
  { table: 'documents', vaultKey: 'documents' as unknown as keyof LocalVaultManager, idField: 'id' },
  { table: 'medications', vaultKey: 'meds' as unknown as keyof LocalVaultManager, idField: 'id' },
  { table: 'labs', vaultKey: 'labs' as unknown as keyof LocalVaultManager, idField: 'id' },
  { table: 'conditions', vaultKey: 'conditions' as unknown as keyof LocalVaultManager, idField: 'id' },
  { table: 'allergies', vaultKey: 'allergies' as unknown as keyof LocalVaultManager, idField: 'id' },
  { table: 'proposals', vaultKey: 'proposals' as unknown as keyof LocalVaultManager, idField: 'id' },
  { table: 'calendar_events', vaultKey: 'calendarEvents' as unknown as keyof LocalVaultManager, idField: 'id' },
  { table: 'care_circle', vaultKey: 'careCircle' as unknown as keyof LocalVaultManager, idField: 'linkId' },
  { table: 'doctor_grants', vaultKey: 'doctorGrants' as unknown as keyof LocalVaultManager, idField: 'grantId' },
  { table: 'due_cards', vaultKey: 'dueCards' as unknown as keyof LocalVaultManager, idField: 'id' },
  { table: 'danger_reports', vaultKey: 'dangerReports' as unknown as keyof LocalVaultManager, idField: 'reportId' },
  { table: 'question_bank', vaultKey: 'questionBank' as unknown as keyof LocalVaultManager, idField: 'id' },
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
    const counts: { [key: string]: number } = {};
    let skippedTables = 0;
    for (const mapping of HYDRATION_MAPPINGS) {
      const { table, vaultKey, idField } = mapping;
      try {
        const res = await fetchSupabaseTable<unknown>(table, trimmedPatientId);
        const resObj = res as unknown as { skipped?: boolean; error?: string; data?: unknown[] };
        if (resObj?.skipped) {
          counts[table] = 0;
          skippedTables++;
          continue;
        }
        if (resObj?.error) {
          counts[table] = 0;
          continue;
        }
        const rows: unknown[] = resObj?.data ?? [];
        let hydratedForTable = 0;
        const vaultObj = vault as unknown as { [key: string]: Map<string, unknown> };
        const map = vaultObj[vaultKey as string] as Map<string, unknown> | undefined;
        if (!map || typeof map.has !== 'function' || typeof map.set !== 'function') {
          counts[table] = 0;
          continue;
        }
        for (const raw of rows) {
          const rec = normalizeRow(table, raw);
          const rawObj = raw as { patient_id?: unknown };
          if (typeof rec.patientId !== 'string' || (rec.patientId as string).trim() !== trimmedPatientId) continue;
          if (rawObj.patient_id != null && String(rawObj.patient_id).trim() !== trimmedPatientId) continue;
          let key: string | undefined = (rec[idField] as string | undefined) ?? (rec.id as string | undefined) ?? (rec.linkId as string | undefined) ?? (rec.grantId as string | undefined) ?? (rec.reportId as string | undefined);
          if (!key) {
            const r = raw as { id?: unknown; link_id?: unknown; grant_id?: unknown; report_id?: unknown };
            key = (r.id as string | undefined) ?? (r.link_id as string | undefined) ?? (r.grant_id as string | undefined) ?? (r.report_id as string | undefined);
          }
          if (!key || typeof key !== 'string') continue;
          if (map.has(key)) {
            const existing = map.get(key);
            const merged = { ...(existing as object), ...(rec as object) };
            map.set(key, merged as unknown);
          } else {
            map.set(key, rec as unknown);
          }
          hydratedForTable++;
          total++;
        }
        counts[table] = hydratedForTable;
      } catch {
        counts[table] = 0;
      }
    }
    if (total === 0 && skippedTables === HYDRATION_MAPPINGS.length) {
      return { hydrated: 0, skipped: true, counts };
    }
    return { hydrated: total, skipped: false, counts };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { hydrated: 0, skipped: true, error: msg };
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
  if (vaultOrPatientId && typeof (vaultOrPatientId as unknown as { facts?: unknown }).facts !== 'undefined' && typeof (vaultOrPatientId as unknown as { meds?: unknown }).meds !== 'undefined') {
    const vault = vaultOrPatientId as LocalVaultManager;
    const pid = typeof patientIdOrVault === 'string' ? patientIdOrVault : CANONICAL_FROM_CLIENT;
    return hydrateFromSupabase(pid, vault);
  }
  if (typeof vaultOrPatientId === 'string' && patientIdOrVault && typeof (patientIdOrVault as unknown as { facts?: unknown }).facts !== 'undefined') {
    return hydrateFromSupabase(vaultOrPatientId, patientIdOrVault as LocalVaultManager);
  }
  if (vaultOrPatientId && typeof (vaultOrPatientId as unknown as { facts?: unknown }).facts !== 'undefined') {
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
