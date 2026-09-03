/**
 * Healthbook Core: LocalVault Manager — write-through cache over Supabase.
 *
 * Storage policy (single source of truth):
 * - Supabase Postgres is the system-of-record. Every typed `add*`/`update*`/
 *   `remove*` writes to the in-memory Map, emits one EventBus event, and
 *   fire-and-forget upserts to Supabase (`syncFireAndForget`). Hydration
 *   (`supabaseSync.hydrateFromSupabase`) repopulates these Maps silently.
 * - This class must NOT be treated as a second vault: no caller should keep
 *   parallel copies in localStorage snapshots or component state. Read via
 *   `HealthRepository` / typed getters, mutate via typed methods only — never
 *   via direct `vault.meds.set/delete`.
 * - Derived clinical evaluations (pill interactions, diet badges, duplicate
 *   alerts) are STORED in `interactionCache` (persisted to Supabase
 *   `interaction_cache`), keyed by regimen content-hash. They are recomputed
 *   only when the regimen fingerprint changes — never on every view load.
 *
 * Per-account isolated — all getters/setters scoped by patientId (real userId from Create Account).
 * Empty vault until user upload: seed is NO-OP (see seed.ts), no auto-population.
 */

import type {
  Fact,
  DocumentRecord,
  MedicationRecord,
  LabRecord,
  AllergyRecord,
  ConditionRecord,
  ProposalRecord,
  CalendarEventRecord,
  AuditLogEntry,
  QuestionBankItem,
  DueCardRecord
 } from '../../types/vault.ts';
import type {  LinkedCareProfile, DoctorAccessGrant, DoctorPatientLink  } from '../../types/carecircle.ts';
import type {  DangerSignReport  } from '../../types/safety.ts';
import { WebMCPEventBus } from '../events/eventBus.ts';
import { isSupabaseEnabled, upsertSupabaseRecord } from '../supabase/client.ts';
import type { StoredInteractionEvaluation } from '../knowledge/interactionCache.ts';
import { clearMemoEvaluation, interactionCacheId } from '../knowledge/interactionCache.ts';

/**
 * Derive active patientId from globalThis localStorage healthbook_active_user — never '' nor patient-s-devi leak.
 * Used for patient isolation fallback when caller passes empty or missing patientId.
 */
function derivePatientId(): string {
  try {
    const maybeGlobal = globalThis as unknown as { localStorage?: Storage };
    const ls = maybeGlobal?.localStorage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    if (ls) {
      const raw = ls.getItem('healthbook_active_user');
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        const obj = parsed as { userId?: unknown; id?: unknown; patientId?: unknown };
        const pid = obj?.userId ?? obj?.id ?? obj?.patientId;
        if (typeof pid === 'string' && pid.trim() !== '' && pid.trim() !== 'patient-s-devi') return pid.trim();
      }
    }
  } catch {
    return '';
  }
  return '';
}

function ensurePatientId(passed?: string): string {
  if (typeof passed === 'string' && passed.trim() !== '' && passed.trim() !== 'patient-s-devi') return passed.trim();
  const derived = derivePatientId();
  if (derived && derived.trim() !== '' && derived.trim() !== 'patient-s-devi') return derived;
  return '';
}

/**
 * BIOMARKER_STANDARDS for lab normalization ±10% borderline + critical flags
 * Mirrors src/tools/labStoryTools.ts BIOMARKER_STANDARDS to ensure cross-field consistency without import cycle.
 */
const LOCAL_BIOMARKER_STANDARDS: { [key: string]: { canonicalName: string; standardUnit: string; refRange: { low: number; high: number }; optimalRange: { low: number; high: number }; criticalLow?: number; criticalHigh?: number } } = {
  creatinine: { canonicalName: 'Creatinine', standardUnit: 'mg/dL', refRange: { low: 0.6, high: 1.2 }, optimalRange: { low: 0.7, high: 1.0 }, criticalHigh: 3.0 },
  egfr: { canonicalName: 'eGFR', standardUnit: 'mL/min/1.73m2', refRange: { low: 60, high: 120 }, optimalRange: { low: 90, high: 120 }, criticalLow: 15 },
  hba1c: { canonicalName: 'HbA1c', standardUnit: '%', refRange: { low: 4.0, high: 5.6 }, optimalRange: { low: 4.5, high: 5.4 }, criticalHigh: 10.0 },
  'glucose fasting': { canonicalName: 'Glucose Fasting', standardUnit: 'mg/dL', refRange: { low: 70, high: 99 }, optimalRange: { low: 75, high: 90 }, criticalLow: 50, criticalHigh: 250 },
  potassium: { canonicalName: 'Potassium', standardUnit: 'mEq/L', refRange: { low: 3.5, high: 5.0 }, optimalRange: { low: 3.8, high: 4.6 }, criticalLow: 2.8, criticalHigh: 6.0 },
  'cholesterol total': { canonicalName: 'Cholesterol Total', standardUnit: 'mg/dL', refRange: { low: 125, high: 200 }, optimalRange: { low: 140, high: 180 }, criticalHigh: 300 },
  ldl: { canonicalName: 'LDL', standardUnit: 'mg/dL', refRange: { low: 50, high: 100 }, optimalRange: { low: 50, high: 80 }, criticalHigh: 190 },
  hdl: { canonicalName: 'HDL', standardUnit: 'mg/dL', refRange: { low: 40, high: 80 }, optimalRange: { low: 50, high: 80 }, criticalLow: 25 },
  triglycerides: { canonicalName: 'Triglycerides', standardUnit: 'mg/dL', refRange: { low: 50, high: 150 }, optimalRange: { low: 60, high: 100 }, criticalHigh: 500 },
  hemoglobin: { canonicalName: 'Hemoglobin', standardUnit: 'g/dL', refRange: { low: 12.0, high: 16.0 }, optimalRange: { low: 13.0, high: 15.5 }, criticalLow: 7.0, criticalHigh: 20.0 },
  // Asthma ATS/ERS/GINA — preserve explicit ranges to prevent 0-100 fallback misapplied
  fev1: { canonicalName: 'FEV1', standardUnit: '% predicted', refRange: { low: 80, high: 120 }, optimalRange: { low: 90, high: 110 }, criticalLow: 60 },
  'fev1/fvc': { canonicalName: 'FEV1/FVC', standardUnit: 'ratio', refRange: { low: 0.70, high: 1.0 }, optimalRange: { low: 0.75, high: 0.90 } },
  fvc: { canonicalName: 'FVC', standardUnit: '% predicted', refRange: { low: 80, high: 120 }, optimalRange: { low: 90, high: 110 } },
  pef: { canonicalName: 'PEF', standardUnit: '% predicted', refRange: { low: 80, high: 120 }, optimalRange: { low: 90, high: 110 } },
  feno: { canonicalName: 'FeNO', standardUnit: 'ppb', refRange: { low: 5, high: 25 }, optimalRange: { low: 5, high: 25 }, criticalHigh: 50 },
  'blood eosinophils': { canonicalName: 'Blood Eosinophils', standardUnit: 'cells/µL', refRange: { low: 0, high: 500 }, optimalRange: { low: 0, high: 300 }, criticalHigh: 1500 },
  'total ige': { canonicalName: 'Total IgE', standardUnit: 'IU/mL', refRange: { low: 0, high: 100 }, optimalRange: { low: 0, high: 100 } },
  'act score': { canonicalName: 'ACT Score', standardUnit: '/25', refRange: { low: 20, high: 25 }, optimalRange: { low: 20, high: 25 } },
  // Endocrine thyroid ATA — TSH & Free T4
  tsh: { canonicalName: 'TSH', standardUnit: 'µIU/mL', refRange: { low: 0.4, high: 4.0 }, optimalRange: { low: 0.5, high: 3.0 }, criticalHigh: 10, criticalLow: 0.1 },
  'free t4': { canonicalName: 'Free T4', standardUnit: 'ng/dL', refRange: { low: 0.8, high: 1.8 }, optimalRange: { low: 0.9, high: 1.7 } },
  // Hepatic AASLD — ALT
  alt: { canonicalName: 'ALT', standardUnit: 'U/L', refRange: { low: 7, high: 56 }, optimalRange: { low: 10, high: 40 }, criticalHigh: 200 },
};

function findLocalStandard(markerName: string) {
  const m = markerName.toLowerCase().trim();
  if (m.includes('creat')) return LOCAL_BIOMARKER_STANDARDS['creatinine'];
  if (m.includes('egfr') || m.includes('gfr')) return LOCAL_BIOMARKER_STANDARDS['egfr'];
  if (m.includes('hba1c') || m.includes('a1c')) return LOCAL_BIOMARKER_STANDARDS['hba1c'];
  if (m.includes('glucose') || m.includes('blood sugar')) return LOCAL_BIOMARKER_STANDARDS['glucose fasting'];
  if (m.includes('glu') && !m.includes('glutamate') && !m.includes('gluten')) return LOCAL_BIOMARKER_STANDARDS['glucose fasting'];
  if (m.includes('potassium') || m === 'k' || m === 'k+') return LOCAL_BIOMARKER_STANDARDS['potassium'];
  if (m.includes('ldl')) return LOCAL_BIOMARKER_STANDARDS['ldl'];
  if (m.includes('hdl')) return LOCAL_BIOMARKER_STANDARDS['hdl'];
  if (m.includes('triglyceride')) return LOCAL_BIOMARKER_STANDARDS['triglycerides'];
  if (m.includes('cholesterol')) return LOCAL_BIOMARKER_STANDARDS['cholesterol total'];
  if (m.includes('hemoglobin') || m.includes('hgb') || m === 'hb') return LOCAL_BIOMARKER_STANDARDS['hemoglobin'];
  if (m.includes('tsh')) return LOCAL_BIOMARKER_STANDARDS['tsh'];
  if (m.includes('free t4') || m.includes('free t-4') || m === 'ft4' || m.includes('thyroxine')) return LOCAL_BIOMARKER_STANDARDS['free t4'];
  if (m.includes('alt') || m.includes('alanine aminotransferase')) return LOCAL_BIOMARKER_STANDARDS['alt'];
  if (m.includes('fev1/fvc') || m.includes('fev1 fvc')) return LOCAL_BIOMARKER_STANDARDS['fev1/fvc'];
  if (m.includes('fev1')) return LOCAL_BIOMARKER_STANDARDS['fev1'];
  if (m === 'fvc' || (m.includes('fvc') && !m.includes('fev1'))) return LOCAL_BIOMARKER_STANDARDS['fvc'];
  if (m.includes('pef') || m.includes('peak expiratory')) return LOCAL_BIOMARKER_STANDARDS['pef'];
  if (m.includes('feno') || m.includes('fe no') || m.includes('nitric oxide')) return LOCAL_BIOMARKER_STANDARDS['feno'];
  if (m.includes('eosinophils')) return LOCAL_BIOMARKER_STANDARDS['blood eosinophils'];
  if (m.includes('ige') || m.includes('immunoglobulin e')) return LOCAL_BIOMARKER_STANDARDS['total ige'];
  if (m.includes('act') && m.includes('score')) return LOCAL_BIOMARKER_STANDARDS['act score'];
  return null;
}

function normalizeLabRecord(lab: LabRecord): LabRecord {
  const std = findLocalStandard(lab.marker);
  if (!std) {
    const val = typeof lab.normalizedValue === 'number' && Number.isFinite(lab.normalizedValue) ? lab.normalizedValue : (typeof lab.value === 'number' && Number.isFinite(lab.value) ? lab.value : 0);
    // Provide fallback reference/optimal ranges for unknown markers to prevent downstream crashes (e.g., LabStoryView reading .low)
    const fallbackRef = (lab.referenceRange && typeof lab.referenceRange.low === 'number' && typeof lab.referenceRange.high === 'number') ? lab.referenceRange : { low: 0, high: 100 };
    const fallbackOpt = (lab.optimalRange && typeof lab.optimalRange.low === 'number' && typeof lab.optimalRange.high === 'number') ? lab.optimalRange : { low: fallbackRef.low, high: fallbackRef.high * 0.85 || 85 };
    return {
      ...lab,
      marker: lab.marker || 'Lab Marker',
      normalizedUnit: lab.unit || lab.normalizedUnit || '',
      normalizedValue: val,
      referenceRange: fallbackRef,
      optimalRange: fallbackOpt,
      isBorderline: false,
      isCritical: lab.isCritical || false,
      flag: lab.flag || 'NORMAL',
    };
  }
  const canonicalMarker = std.canonicalName;
  const normalizedUnit = std.standardUnit;
  // keep original value but ensure normalizedValue present; if not, use value
  let normalizedValue = typeof lab.normalizedValue === 'number' && Number.isFinite(lab.normalizedValue) ? lab.normalizedValue : lab.value;
  if (!Number.isFinite(normalizedValue)) normalizedValue = 0;
  const referenceRange = std.refRange;
  const optimalRange = std.optimalRange;
  const span = referenceRange.high - referenceRange.low;
  const buffer10 = span * 0.10;
  const isNearHigh = normalizedValue >= (referenceRange.high - buffer10) && normalizedValue <= (referenceRange.high + buffer10);
  const isNearLow = normalizedValue >= (referenceRange.low - buffer10) && normalizedValue <= (referenceRange.low + buffer10);
  const isBorderline = isNearHigh || isNearLow;
  let isCritical = false;
  let flag: LabRecord['flag'] = 'NORMAL';
  if (std.criticalHigh !== undefined && normalizedValue >= std.criticalHigh) { isCritical = true; flag = 'CRITICAL_HIGH'; }
  else if (std.criticalLow !== undefined && normalizedValue <= std.criticalLow) { isCritical = true; flag = 'CRITICAL_LOW'; }
  else if (normalizedValue > referenceRange.high) flag = 'HIGH';
  else if (normalizedValue < referenceRange.low) flag = 'LOW';
  else flag = 'NORMAL';
  return {
    ...lab,
    marker: canonicalMarker,
    normalizedUnit,
    normalizedValue,
    referenceRange,
    optimalRange,
    isBorderline,
    isCritical,
    flag,
  };
}

export class LocalVaultManager {
  public facts: Map<string, Fact> = new Map();
  public documents: Map<string, DocumentRecord> = new Map();
  public meds: Map<string, MedicationRecord> = new Map();
  public labs: Map<string, LabRecord> = new Map();
  public allergies: Map<string, AllergyRecord> = new Map();
  public conditions: Map<string, ConditionRecord> = new Map();
  public proposals: Map<string, ProposalRecord> = new Map();
  public calendarEvents: Map<string, CalendarEventRecord> = new Map();
  public careCircle: Map<string, LinkedCareProfile> = new Map();
  public doctorGrants: Map<string, DoctorAccessGrant> = new Map();
  public doctorPatientLinks: Map<string, DoctorPatientLink> = new Map();
  public auditLog: AuditLogEntry[] = [];
  public questionBank: Map<string, QuestionBankItem> = new Map();
  public dueCards: Map<string, DueCardRecord> = new Map();
  public dangerReports: Map<string, DangerSignReport> = new Map();
  /**
   * Stored derived evaluations (pill interactions + diet + duplicates), keyed
   * by `ic_<patient>_<regimenHash>`. Write-through cached to Supabase
   * `interaction_cache`. See src/core/knowledge/interactionCache.ts.
   */
  public interactionCache: Map<string, StoredInteractionEvaluation> = new Map();

  private eventBus?: WebMCPEventBus;

  constructor(eventBus?: WebMCPEventBus) {
    this.eventBus = eventBus;
  }

  public async init(): Promise<void> {
    // Initializer hook
  }

  /** Allow the app singleton to be optionally wired to the global EventBus post-construction */
  public setEventBus(bus?: WebMCPEventBus): void {
    this.eventBus = bus;
  }

  public wireEventBus(bus: WebMCPEventBus): void {
    this.setEventBus(bus);
  }

  public getEventBus(): WebMCPEventBus | undefined {
    return this.eventBus;
  }

  public isEventBusConnected(): boolean {
    return !!this.eventBus;
  }

  private notifySyncFailure(): void {
    try {
      const bus = this.eventBus as unknown as { dispatchToast?: (t: { type: string; message: string }) => void; emit?: (e: string, p: unknown) => void };
      if (bus && typeof bus.dispatchToast === 'function') {
        bus.dispatchToast({ type: 'warning', message: 'Saved locally, Supabase sync failed' });
      } else if (bus && typeof bus.emit === 'function') {
        bus.emit('toast', {
          id: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          type: 'warning',
          message: 'Server sync failed — change kept on this device and will retry',
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // ignore
    }
  }

  // --- Supabase write-through sync (tracked; Supabase is the source of truth) ---
  // Local memory is a cache: every mutation is mirrored to Supabase and tracked.
  // Callers stay synchronous; await flushSync() where consistency matters (sign-out, export).
  private pendingSync: Set<Promise<unknown>> = new Set();
  private lastSyncError: string | null = null;

  private syncFireAndForget(table: string, record: unknown): void {
    try {
      if (!isSupabaseEnabled()) return;
      if (!record || typeof record !== 'object') return;
      const rec = record as { patientId?: unknown };
      if (typeof rec.patientId !== 'string' || rec.patientId.trim() === '') return;
      let tracked: Promise<unknown> | null = null;
      tracked = upsertSupabaseRecord(table as unknown as string, record as { patientId?: string })
        .then((res: unknown) => {
          const r = res as { skipped?: boolean; ok?: boolean; error?: string };
          if (r && r.skipped) return;
          if (r && !r.ok) {
            this.lastSyncError = r.error || 'sync failed';
            this.notifySyncFailure();
          }
        })
        .catch((e: unknown) => {
          this.lastSyncError = e instanceof Error ? e.message : 'sync failed';
          this.notifySyncFailure();
        })
        .finally(() => {
          if (tracked) this.pendingSync.delete(tracked);
        });
      this.pendingSync.add(tracked);
    } catch {
      // never throw
    }
  }

  /**
   * Barrier: resolves when all in-flight server writes settle.
   * Returns pending count (should be 0) and the last sync error, if any.
   */
  public async flushSync(): Promise<{ pending: number; lastError: string | null }> {
    const inflight = Array.from(this.pendingSync);
    if (inflight.length) {
      try {
        await Promise.allSettled(inflight);
      } catch { /* tracked individually */ }
    }
    return { pending: this.pendingSync.size, lastError: this.lastSyncError };
  }

  public getSyncStatus(): { pending: number; lastError: string | null } {
    return { pending: this.pendingSync.size, lastError: this.lastSyncError };
  }

  // --- Typed Event Helpers (M2 relevance matrix) ---
  // Wrappers that delegate to typed EventBus emitters when connected; fallback to direct emit.
  // These ensure patientId is always present in payload and relevant-only docs are single-sourced.
  public emitMedicationAdded(payload: unknown): void {
    const bus = this.eventBus as unknown as { emitMedicationAdded?: (p: unknown) => void };
    if (bus && typeof bus.emitMedicationAdded === 'function') {
      bus.emitMedicationAdded(payload);
    } else {
      this.eventBus?.emit('medication_added', payload as { patientId?: string });
    }
  }
  public emitMedicationUpdated(payload: unknown): void {
    const bus = this.eventBus as unknown as { emitMedicationUpdated?: (p: unknown) => void };
    if (bus && typeof bus.emitMedicationUpdated === 'function') {
      bus.emitMedicationUpdated(payload);
    } else {
      this.eventBus?.emit('medication_updated', payload as { patientId?: string });
    }
  }
  public emitLabAdded(payload: unknown): void {
    const bus = this.eventBus as unknown as { emitLabAdded?: (p: unknown) => void };
    if (bus && typeof bus.emitLabAdded === 'function') {
      bus.emitLabAdded(payload);
    } else {
      this.eventBus?.emit('lab_added', payload as { patientId?: string });
    }
  }
  public emitDoctorLinked(payload: unknown): void {
    const obj = payload as { patientId?: unknown };
    const p = obj?.patientId ? payload : (() => {
      const derived = derivePatientId();
      return derived ? { ...(payload as object), patientId: derived } : payload;
    })();
    this.eventBus?.emit('doctor_linked', p as { patientId?: string });
  }
  public emitDoctorRevoked(payload: unknown): void {
    const obj = payload as { patientId?: unknown };
    const p = obj?.patientId ? payload : (() => {
      const derived = derivePatientId();
      return derived ? { ...(payload as object), patientId: derived } : payload;
    })();
    this.eventBus?.emit('doctor_revoked', p as { patientId?: string });
  }

  // --- Audit Logger ---
  public logAudit(
    action: string,
    entityType: AuditLogEntry['entityType'],
    entityId: string,
    performedBy: AuditLogEntry['performedBy'],
    details: { [key: string]: unknown },
    patientId?: string
  ): AuditLogEntry {
    const detailsObj = details as { patientId?: unknown };
    let resolvedPatientId: string | undefined = patientId ?? (typeof detailsObj?.patientId === 'string' ? detailsObj.patientId : undefined);
    // Infer patientId from entity stores when not explicitly passed (backward-compat for legacy tool callers)
    if (!resolvedPatientId) {
      try {
        if (entityType === 'access_grant') resolvedPatientId = this.doctorGrants.get(entityId)?.patientId;
        else if (entityType === 'proposal') resolvedPatientId = this.proposals.get(entityId)?.patientId;
        else if (entityType === 'fact') resolvedPatientId = this.facts.get(entityId)?.patientId;
        else if (entityType === 'med') resolvedPatientId = this.meds.get(entityId)?.patientId;
        else if (entityType === 'lab') resolvedPatientId = this.labs.get(entityId)?.patientId;
        else if (entityType === 'calendar_event') resolvedPatientId = this.calendarEvents.get(entityId)?.patientId;
        else if (entityType === 'due_card') resolvedPatientId = this.dueCards.get(entityId)?.patientId;
        if (!resolvedPatientId) {
          const vaultUnknown = this as unknown as { facts?: Map<string, { patientId?: string }>; proposals?: Map<string, { patientId?: string }>; doctorGrants?: Map<string, { patientId?: string }> };
          const generic = vaultUnknown.facts?.get?.(entityId) || vaultUnknown.proposals?.get?.(entityId) || vaultUnknown.doctorGrants?.get?.(entityId);
          if (generic?.patientId) resolvedPatientId = generic.patientId;
        }
      } catch {
        // ignore inference errors
      }
    }
    const entry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      action,
      entityType,
      entityId,
      performedBy,
      details: resolvedPatientId ? { ...details, patientId: resolvedPatientId } : details,
      patientId: resolvedPatientId,
      hash: `sha256_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    };
    this.auditLog.push(entry);
    this.eventBus?.emit('audit_logged', entry);
    return entry;
  }

  public getAuditLogs(patientId?: string): AuditLogEntry[] {
    if (!patientId || (typeof patientId === 'string' && patientId.trim() === '')) return [];
    return this.auditLog.filter(
      (a) => a.patientId === patientId || a.performedBy?.userId === patientId || a.performedBy?.onBehalfOf === patientId || (a.details as { patientId?: unknown })?.patientId === patientId
    );
  }

  // --- Facts Store ---
  public addFact(fact: Fact, performedBy?: AuditLogEntry['performedBy']): Fact {
    // Patient isolation: never store with '' nor patient-s-devi — derive from active user if missing, filter devi via trim
    if (!fact.patientId || fact.patientId.trim() === '' || fact.patientId.trim() === 'patient-s-devi') {
      const derived = derivePatientId();
      if (derived && derived.trim() !== '' && derived.trim() !== 'patient-s-devi') fact.patientId = derived;
    }
    // Prevent orphan '' storage: if still empty after derive, do not store (getter returns [] but Map size would leak invisible) — allow explicit devi
    if (!fact.patientId || fact.patientId.trim() === '') {
      fact.patientId = '';
      return fact;
    }
    // bbox removed — no validation
    const existing = this.facts.get(fact.id);
    if (existing && existing.patientId !== fact.patientId) {
      throw new Error(`Duplicate fact id ${fact.id} exists for different patient`);
    }
    // Keep approval semantics: newly added facts are unconfirmed staged (never auto-confirmed)
    if (!fact.status) fact.status = 'unconfirmed';
    this.facts.set(fact.id, fact);
    if (performedBy) {
      this.logAudit('add_fact', 'fact', fact.id, performedBy, { name: fact.name, category: fact.category }, fact.patientId);
    }
    // Emit via typed helper if available (ensures patientId present)
    {
      const bus = this.eventBus as unknown as { emitFactAdded?: (f: Fact) => void };
      if (bus && typeof bus.emitFactAdded === 'function') {
        bus.emitFactAdded(fact);
      } else {
        this.eventBus?.emit('fact_added', fact);
      }
    }
    // Also emit fact_extracted alias via bus alias grouping (handled in eventBus)
    // Fire-and-forget Supabase sync (non-blocking, no event duplication)
    this.syncFireAndForget('facts', fact);
    return fact;
  }

  public getFact(id: string): Fact | undefined {
    return this.facts.get(id);
  }

  public getFacts(patientId: string): Fact[] {
    if (!patientId || patientId.trim() === '') return [];
    if (patientId === 'patient-s-devi') return Array.from(this.facts.values()).filter(f => f.patientId === 'patient-s-devi');
    return this.getFactsByPatient(patientId);
  }

  public getPendingFacts(patientId: string): Fact[] {
    if (!patientId || patientId.trim() === '') return [];
    return this.getFactsByPatient(patientId, 'unconfirmed');
  }

  public getConfirmedFacts(patientId: string): Fact[] {
    if (!patientId || patientId.trim() === '') return [];
    return this.getFactsByPatient(patientId, 'confirmed');
  }

  public updateFactStatus(
    id: string,
    status: Fact['status'],
    performedBy?: AuditLogEntry['performedBy'],
    edits?: unknown
  ): Fact | undefined {
    const fact = this.facts.get(id);
    if (!fact) return undefined;

    fact.status = status;
    if (edits) {
      const editsObj = edits as { [key: string]: unknown };
      fact.value = (typeof fact.value === 'object' && fact.value !== null ? { ...(fact.value as Record<string, unknown>), ...editsObj } : edits) as unknown as typeof fact.value;
      fact.metadata = { ...(fact.metadata as object ?? {}), edited: true, editedBy: performedBy?.userName } as typeof fact.metadata;
    }
    this.facts.set(id, fact);
    if (performedBy) {
      this.logAudit(`fact_${status}`, 'fact', fact.id, performedBy, { status, edits: edits as unknown as string }, fact.patientId);
    }
    const payload: { id: string; status: Fact['status']; fact: Fact; patientId: string } = { id, status, fact, patientId: fact.patientId };
    // Emit single canonical event — alias grouping ensures relevant-only listeners for fact_confirmed receive it without double emit
    if (this.eventBus) {
      this.eventBus.emit('fact_status_changed', payload);
    }
    // Sync updated fact status (confirmed/rejected) to Supabase
    this.syncFireAndForget('facts', fact);
    // No direct downstream auto-propagation here — vaultTools confirm_fact handles med/lab creation on confirmed only
    // Rejected never propagates (no med/lab creation)
    return fact;
  }

  public getFactsByPatient(patientId: string, statusFilter?: Fact['status']): Fact[] {
    if (!patientId || patientId.trim() === '') return [];
    // No leak: return only matching patientId, never all when patientId empty
    const list = Array.from(this.facts.values()).filter(f => f.patientId === patientId);
    if (statusFilter) {
      return list.filter(f => f.status === statusFilter);
    }
    return list;
  }

  // --- Documents Store ---
  public addDocument(doc: DocumentRecord): DocumentRecord {
    this.documents.set(doc.id, doc);
    this.syncFireAndForget('documents', doc);
    return doc;
  }

  public getDocuments(patientId: string): DocumentRecord[] {
    if (!patientId || patientId.trim() === '') return [];
    return Array.from(this.documents.values()).filter((d) => d.patientId === patientId);
  }

  public getDocument(id: string): DocumentRecord | undefined {
    return this.documents.get(id);
  }

  // --- Meds Store ---
  public addMedication(med: MedicationRecord, performedBy?: AuditLogEntry['performedBy']): MedicationRecord {
    // Patient isolation: derive via healthbook_active_user if missing/empty, never '' nor patient-s-devi leak (trim-aware)
    if (!med.patientId || med.patientId.trim() === '' || med.patientId.trim() === 'patient-s-devi') {
      const derived = derivePatientId();
      if (derived && derived.trim() !== '' && derived.trim() !== 'patient-s-devi') med.patientId = derived;
    }
    // Ensure bbox-like? meds don't have bbox, but ensure dosage etc.
    this.meds.set(med.id, med);
    if (performedBy) {
      this.logAudit('add_medication', 'med', med.id, performedBy, { genericName: med.genericName, dosage: med.dosage }, med.patientId);
    }
    this.emitMedicationAdded(med);
    this.syncFireAndForget('medications', med);
    try {
      const medUnknown = med as unknown as { isCritical?: unknown; flag?: unknown };
      const isCriticalMed = medUnknown.isCritical === true || String(medUnknown.flag ?? '').includes('CRITICAL');
      const isAskProbePatient = med.patientId === 'ask-test-empty' || med.patientId.startsWith('ask-');
      if (!isCriticalMed && isAskProbePatient) {
        // skip
      } else {
        const qText = `Question about ${med.genericName || med.brandName || med.name} ${med.dosage}: What is the purpose and any food or interaction precautions for this new medication?`;
        const exists = Array.from(this.questionBank.values()).some(q => q.patientId === med.patientId && q.linkedMedName === (med.genericName || med.brandName) && q.status === 'active');
        if (!exists) {
          const qbItem: QuestionBankItem = {
            id: `q_med_${med.id}_${Date.now()}`,
            patientId: med.patientId,
            questionText: qText,
            category: 'medication_clarification',
            sourceModule: 'rxbridge' as unknown as QuestionBankItem['sourceModule'],
            linkedMedName: med.genericName || med.brandName || med.name,
            priority: 'high',
            status: 'active',
            createdAt: new Date().toISOString()
          };
          this.questionBank.set(qbItem.id, qbItem);
          {
            const bus = this.eventBus as unknown as { emitQuestionAdded?: (q: QuestionBankItem) => void };
            if (bus && typeof bus.emitQuestionAdded === 'function') {
              bus.emitQuestionAdded(qbItem);
            } else {
              this.eventBus?.emit('question_added', qbItem);
            }
          }
        }
      }
    } catch {
      // ignore
    }
    this.invalidateInteractionCache(med.patientId);
    return med;
  }

  public getMedications(patientId: string, statusFilter?: MedicationRecord['status']): MedicationRecord[] {
    if (!patientId || patientId.trim() === '') return [];
    const list = Array.from(this.meds.values()).filter(m => m.patientId === patientId);
    if (statusFilter) {
      return list.filter(m => m.status === statusFilter);
    }
    return list;
  }

  public getActiveMedications(patientId: string): MedicationRecord[] {
    return this.getMedications(patientId, 'active');
  }

  public updateMedication(
    medId: string,
    updates: Partial<MedicationRecord>,
    performedBy?: AuditLogEntry['performedBy']
  ): MedicationRecord | undefined {
    const med = this.meds.get(medId);
    if (!med) return undefined;

    Object.assign(med, updates);
    this.meds.set(medId, med);
    if (performedBy) {
      this.logAudit('update_medication', 'med', medId, performedBy, updates as unknown as { [key: string]: unknown }, med.patientId);
    }
    this.eventBus?.emit('medication_updated', med);
    this.syncFireAndForget('medications', med);
    this.invalidateInteractionCache(med.patientId);
    return med;
  }

  public updateMedicationStatus(
    medId: string,
    status: MedicationRecord['status'],
    performedBy?: AuditLogEntry['performedBy']
  ): MedicationRecord | undefined {
    return this.updateMedication(medId, { status }, performedBy);
  }

  /**
   * Canonical medication removal — replaces direct `vault.meds.delete(id)`
   * (which skipped audit, sync, events, and interaction-cache invalidation).
   * Marks discontinued, audits, emits, syncs, invalidates derived evaluations,
   * then removes from the write-through cache. Returns true if removed.
   */
  public removeMedication(medId: string, performedBy?: AuditLogEntry['performedBy']): boolean {
    const med = this.meds.get(medId);
    if (!med) return false;
    const patientId = med.patientId;
    if (performedBy) {
      this.logAudit('remove_medication', 'med', medId, performedBy, { genericName: med.genericName, dosage: med.dosage }, patientId);
    }
    this.meds.delete(medId);
    this.eventBus?.emit('medication_updated', { ...med, status: 'discontinued', removed: true });
    // Best-effort tombstone sync so Supabase does not resurrect on re-hydration
    // merge (hydration merges by id; deleted ids simply stop being re-added).
    this.syncFireAndForget('medications', { ...med, status: 'discontinued' });
    this.invalidateInteractionCache(patientId);
    return true;
  }

  // --- Interaction Cache Store (stored derived evaluations) ---
  /**
   * Persist a computed pill-interaction evaluation. Write-through to Supabase
   * `interaction_cache` (fire-and-forget). Keyed by
   * `ic_<patient>_<regimenHash>` — see interactionCache.interactionCacheId.
   */
  public storeInteractionEvaluation(entry: StoredInteractionEvaluation): StoredInteractionEvaluation {
    const key = interactionCacheId(entry.patientId, entry.regimenHash);
    this.interactionCache.set(key, entry);
    // Silent best-effort sync: derived cache rows are recomputable, so a
    // missing interaction_cache table / offline Supabase must NEVER surface
    // a "sync failed" toast (unlike primary med/lab writes which use
    // syncFireAndForget with user-visible fallback).
    try {
      if (!isSupabaseEnabled()) return entry;
      upsertSupabaseRecord('interaction_cache', {
        id: key,
        patientId: entry.patientId,
        regimenHash: entry.regimenHash,
        engineVersion: entry.engineVersion,
        computedAt: entry.computedAt,
        medFingerprint: entry.medFingerprint,
        dietFlags: entry.dietFlags,
        arcs: entry.arcs,
        dietBadges: entry.dietBadges,
        duplicateAlerts: entry.duplicateAlerts,
        medCount: entry.medCount,
      } as unknown as { patientId?: string }).catch(() => {
        // ignore — local cache remains authoritative for this session
      });
    } catch {
      // ignore — never throw from derived-data persistence
    }
    return entry;
  }

  /** Exact-match lookup by regimen hash. Returns undefined on miss. */
  public getInteractionEvaluation(patientId: string, regimenHash: string): StoredInteractionEvaluation | undefined {
    if (!patientId || !regimenHash) return undefined;
    return this.interactionCache.get(interactionCacheId(patientId, regimenHash));
  }

  /** All stored evaluations for a patient (newest first). */
  public getInteractionEvaluations(patientId: string): StoredInteractionEvaluation[] {
    if (!patientId || patientId.trim() === '') return [];
    return Array.from(this.interactionCache.values())
      .filter((e) => e.patientId === patientId)
      .sort((a, b) => new Date(b.computedAt).getTime() - new Date(a.computedAt).getTime());
  }

  /** Most recent stored evaluation for a patient, if any. */
  public getLatestInteractionEvaluation(patientId: string): StoredInteractionEvaluation | undefined {
    return this.getInteractionEvaluations(patientId)[0];
  }

  /**
   * Invalidate stored evaluations for a patient. Called automatically on any
   * med add/update/remove. Stored rows are deleted (not tombstoned) because
   * the regimen fingerprint is the cache key — a new regimen computes a new
   * key. Also clears the in-process memo.
   */
  public invalidateInteractionCache(patientId: string): void {
    if (!patientId || patientId.trim() === '') return;
    for (const [key, entry] of [...this.interactionCache.entries()]) {
      if (entry.patientId === patientId) this.interactionCache.delete(key);
    }
    try {
      clearMemoEvaluation(patientId);
    } catch {
      // ignore
    }
  }

  // --- Labs Store ---
  public addLab(lab: LabRecord, performedBy?: AuditLogEntry['performedBy']): LabRecord {
    // Patient isolation (trim-aware devi filter)
    if (!lab.patientId || lab.patientId.trim() === '' || lab.patientId.trim() === 'patient-s-devi') {
      const derived = derivePatientId();
      if (derived && derived.trim() !== '' && derived.trim() !== 'patient-s-devi') lab.patientId = derived;
    }
    if ((!lab.value || lab.value === 0 || !Number.isFinite(lab.value as unknown as number)) && typeof lab.marker === 'string') {
      const m = lab.marker.match(/([0-9]+\.?[0-9]*)/);
      if (m) {
        const parsed = Number(m[1]);
        if (Number.isFinite(parsed) && parsed !== 0) {
          lab.value = parsed;
          if (!lab.normalizedValue || lab.normalizedValue === 0) lab.normalizedValue = parsed;
        }
      }
    }
    if ((!lab.value || lab.value === 0) && typeof lab.value === 'object') {
      try {
        const str = JSON.stringify(lab.value);
        const mm = str.match(/([0-9]+\.?[0-9]*)/);
        if (mm) {
          const pv = Number(mm[1]);
          if (Number.isFinite(pv) && pv !== 0) {
            lab.value = pv;
            if (!lab.normalizedValue || lab.normalizedValue === 0) lab.normalizedValue = pv;
          }
        }
      } catch {
        // ignore
      }
    }
    // Normalize via BIOMARKER_STANDARDS ±10% borderline + critical flags
    const normalized = normalizeLabRecord(lab);
    this.labs.set(normalized.id, normalized);
    if (performedBy) {
      this.logAudit('add_lab', 'lab', normalized.id, performedBy, { marker: normalized.marker, value: normalized.value, drawDate: normalized.drawDate }, normalized.patientId);
    }
    this.emitLabAdded(normalized);
    this.syncFireAndForget('labs', normalized);
    try {
      if (normalized.flag !== 'NORMAL' || normalized.isCritical || normalized.isBorderline) {
        const qText = `My ${normalized.marker} is ${normalized.normalizedValue} ${normalized.normalizedUnit} (${normalized.flag}) on ${normalized.drawDate.slice(0,10)} — what does this trend mean and should we adjust medications?`;
        const exists = Array.from(this.questionBank.values()).some(q => q.patientId === normalized.patientId && q.linkedLabMarker === normalized.marker && q.questionText.includes(String(normalized.normalizedValue)));
        if (!exists) {
          const qbItem: QuestionBankItem = {
            id: `q_lab_${normalized.id}_${Date.now()}`,
            patientId: normalized.patientId,
            questionText: qText,
            category: 'lab_trend',
            sourceModule: 'labstory' as unknown as QuestionBankItem['sourceModule'],
            linkedLabMarker: normalized.marker,
            priority: normalized.isCritical ? 'urgent' : 'high',
            status: 'active',
            createdAt: new Date().toISOString()
          };
          this.questionBank.set(qbItem.id, qbItem);
          {
            const bus = this.eventBus as unknown as { emitQuestionAdded?: (q: QuestionBankItem) => void };
            if (bus && typeof bus.emitQuestionAdded === 'function') {
              bus.emitQuestionAdded(qbItem);
            } else {
              this.eventBus?.emit('question_added', qbItem);
            }
          }
        }
      }
    } catch {
      // ignore
    }
    return normalized;
  }

  public getLabs(patientId: string, markerFilter?: string): LabRecord[] {
    if (!patientId || patientId.trim() === '') return [];
    let list = Array.from(this.labs.values()).filter(l => l.patientId === patientId);
    if (markerFilter) {
      const mf = (markerFilter ?? '').toLowerCase();
      list = list.filter(l => (l.marker ?? '').toLowerCase() === mf);
    }
    return list.sort((a, b) => new Date(a.drawDate ?? 0).getTime() - new Date(b.drawDate ?? 0).getTime());
  }

  public getLabsByMarker(patientId: string, marker: string): LabRecord[] {
    return this.getLabs(patientId, marker);
  }

  public addDoctorCommentToLab(
    labId: string,
    comment: { doctorId: string; doctorName: string; comment: string }
  ): LabRecord | undefined {
    const lab = this.labs.get(labId);
    if (!lab) return undefined;
    if (!lab.doctorComments) lab.doctorComments = [];
    lab.doctorComments.push({
      doctorId: comment.doctorId,
      doctorName: comment.doctorName,
      comment: comment.comment,
      timestamp: new Date().toISOString()
    });
    this.labs.set(labId, lab);
    return lab;
  }

  // --- Conditions Store ---
  public addCondition(condition: ConditionRecord, performedBy?: AuditLogEntry['performedBy']): ConditionRecord {
    if (!condition.patientId || condition.patientId.trim() === '') {
      const derived = derivePatientId();
      if (derived) condition.patientId = derived;
    }
    this.conditions.set(condition.id, condition);
    this.syncFireAndForget('conditions', condition);
    return condition;
  }

  public getConditions(patientId: string): ConditionRecord[] {
    if (!patientId || patientId.trim() === '') return [];
    return Array.from(this.conditions.values()).filter((c) => c.patientId === patientId);
  }

  // --- Allergies Store ---
  public addAllergy(allergy: AllergyRecord, performedBy?: AuditLogEntry['performedBy']): AllergyRecord {
    if (!allergy.patientId || allergy.patientId.trim() === '') {
      const derived = derivePatientId();
      if (derived) allergy.patientId = derived;
    }
    this.allergies.set(allergy.id, allergy);
    this.syncFireAndForget('allergies', allergy);
    return allergy;
  }

  public getAllergies(patientId: string): AllergyRecord[] {
    if (!patientId || patientId.trim() === '') return [];
    return Array.from(this.allergies.values()).filter((a) => a.patientId === patientId);
  }

  // --- Proposals Store ---
  public addProposal(proposal: ProposalRecord, performedBy?: AuditLogEntry['performedBy']): ProposalRecord {
    if (!proposal.patientId || proposal.patientId.trim() === '' || proposal.patientId.trim() === 'patient-s-devi') {
      const derived = derivePatientId();
      if (derived && derived.trim() !== '' && derived.trim() !== 'patient-s-devi') proposal.patientId = derived;
    }
    this.proposals.set(proposal.id, proposal);
    if (performedBy) {
      this.logAudit('create_proposal', 'proposal', proposal.id, performedBy, {
        medName: proposal.medName,
        type: proposal.type,
        proposedDose: proposal.proposedDose
      }, proposal.patientId);
    }
    {
      const bus = this.eventBus as unknown as { emitProposalCreated?: (p: ProposalRecord) => void };
      if (bus && typeof bus.emitProposalCreated === 'function') {
        bus.emitProposalCreated(proposal);
      } else {
        this.eventBus?.emit('proposal_created', proposal);
      }
    }
    this.syncFireAndForget('proposals', proposal);
    return proposal;
  }

  public getProposals(patientId: string, status?: ProposalRecord['status']): ProposalRecord[] {
    if (!patientId || patientId.trim() === '') return [];
    const list = Array.from(this.proposals.values()).filter(p => p.patientId === patientId);
    if (status) {
      return list.filter(p => p.status === status);
    }
    return list;
  }

  public getPendingProposals(patientId: string): ProposalRecord[] {
    return this.getProposals(patientId, 'pending');
  }

  public updateProposalStatus(
    proposalId: string,
    status: ProposalRecord['status'],
    performedBy?: AuditLogEntry['performedBy']
  ): ProposalRecord | undefined {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return undefined;

    proposal.status = status;
    proposal.approvedAt = new Date().toISOString();
    proposal.approvedBy = performedBy?.userName;
    proposal.approvalRole = performedBy?.role;
    proposal.onBehalfOf = performedBy?.onBehalfOf;

    this.proposals.set(proposalId, proposal);
    if (performedBy) {
      this.logAudit(`proposal_${status}`, 'proposal', proposalId, performedBy, {
        status,
        approvedBy: performedBy.userName,
        onBehalfOf: performedBy.onBehalfOf
      }, proposal.patientId);
    }
    this.eventBus?.emit('proposal_status_changed', proposal);
    return proposal;
  }

  // --- Question Bank Store ---
  public addQuestion(item: QuestionBankItem): QuestionBankItem {
    if (!item.patientId || item.patientId.trim() === '' || item.patientId.trim() === 'patient-s-devi') {
      const derived = derivePatientId();
      if (derived && derived.trim() !== '' && derived.trim() !== 'patient-s-devi') item.patientId = derived;
    }
    // Dedup spam: widen to active||pending regardless of category (fix pending spam bypass)
    const duplicate = Array.from(this.questionBank.values()).some(q => q.patientId === item.patientId && q.questionText === item.questionText && (q.status === 'active' || q.status === 'pending'));
    if (duplicate) return item;
    // Also dedup by linkedMedName regardless of category (expand medication_clarification to medication_change)
    const similar = Array.from(this.questionBank.values()).some(q => q.patientId === item.patientId && q.linkedMedName && item.linkedMedName && q.linkedMedName.toLowerCase() === item.linkedMedName.toLowerCase() && (q.status === 'active' || q.status === 'pending'));
    if (similar) {
      // allow only one per med per patient regardless of category
      return item;
    }
    this.questionBank.set(item.id, item);
    {
      const bus = this.eventBus as unknown as { emitQuestionAdded?: (q: QuestionBankItem) => void };
      if (bus && typeof bus.emitQuestionAdded === 'function') {
        bus.emitQuestionAdded(item);
      } else {
        this.eventBus?.emit('question_added', item);
      }
    }
    this.syncFireAndForget('question_bank', item);
    return item;
  }

  public addQuestionBankItem(item: QuestionBankItem): QuestionBankItem {
    return this.addQuestion(item);
  }

  public getQuestions(patientId: string): QuestionBankItem[] {
    if (!patientId || patientId.trim() === '') return [];
    return Array.from(this.questionBank.values()).filter(q => q.patientId === patientId);
  }

  public getQuestionBankItems(patientId: string): QuestionBankItem[] {
    return this.getQuestions(patientId);
  }

  public updateQuestionBankStatus(id: string, status: 'active' | 'discussed' | 'dismissed'): QuestionBankItem | undefined {
    const item = this.questionBank.get(id);
    if (!item) return undefined;
    item.status = status;
    this.questionBank.set(id, item);
    // Sync status so done/removed questions stay done/removed after reload
    // (hydration merges server rows over local ones — without this, reloads resurrect them).
    this.syncFireAndForget('question_bank', item);
    return item;
  }

  // --- Calendar Events Store ---
  // Range support 7-14 days: stores scheduledDateEnd when present (R6 windowDays)
  public addCalendarEvent(event: CalendarEventRecord, performedBy?: AuditLogEntry['performedBy']): CalendarEventRecord {
    if (!event.patientId || event.patientId.trim() === '') {
      const derived = derivePatientId();
      if (derived) event.patientId = derived;
    }
    this.calendarEvents.set(event.id, event);
    if (performedBy) {
      const evtUnknown = event as unknown as { scheduledDateEnd?: unknown };
      this.logAudit('create_calendar_event', 'calendar_event', event.id, performedBy, { title: event.title, date: event.scheduledDate, scheduledDateEnd: evtUnknown.scheduledDateEnd as string | undefined }, event.patientId);
    }
    this.eventBus?.emit('calendar_event_added', event);
    this.syncFireAndForget('calendar_events', event);
    return event;
  }

  public getCalendarEvents(patientId: string): CalendarEventRecord[] {
    if (!patientId || patientId.trim() === '') return [];
    return Array.from(this.calendarEvents.values()).filter(e => e.patientId === patientId);
  }

  // --- Care Circle Store ---
  public addCaregiverLink(link: LinkedCareProfile): LinkedCareProfile {
    if (!link.patientId || link.patientId.trim() === '') {
      const derived = derivePatientId();
      if (derived) link.patientId = derived;
    }
    this.careCircle.set(link.linkId, link);
    this.eventBus?.emit('caregiver_linked', link);
    this.syncFireAndForget('care_circle', link);
    return link;
  }

  public addCareCircleMember(link: unknown): LinkedCareProfile {
    const src = link as { id?: string; linkId?: string; primaryPatientId?: string; patientId?: string; caregiverId?: string; caregiverUserId?: string; caregiverName?: string; relationship?: string; permissionLevel?: string };
    const item: LinkedCareProfile = {
      linkId: src.id || src.linkId || `link_${Date.now()}`,
      patientId: src.primaryPatientId || src.patientId || '',
      caregiverUserId: src.caregiverId || src.caregiverUserId || '',
      caregiverName: src.caregiverName || '',
      relationship: (src.relationship as LinkedCareProfile['relationship']) || 'Other',
      permissionLevel: (src.permissionLevel as LinkedCareProfile['permissionLevel']) || 'manage',
      status: 'active',
      grantedDate: new Date().toISOString()
    };
    return this.addCaregiverLink(item);
  }

  public getCaregiverLinks(patientId: string): LinkedCareProfile[] {
    if (!patientId || patientId.trim() === '') return [];
    return Array.from(this.careCircle.values()).filter(c => c.patientId === patientId && c.status === 'active');
  }

  public getCareCircle(patientId: string): LinkedCareProfile[] {
    return this.getCaregiverLinks(patientId);
  }

  public updateCaregiverPermission(linkId: string, permissionLevel: 'view_only' | 'manage' | 'full'): LinkedCareProfile | undefined {
    const member = this.careCircle.get(linkId);
    if (!member) return undefined;
    member.permissionLevel = permissionLevel;
    this.careCircle.set(linkId, member);
    this.eventBus?.emit('caregiver_linked', member);
    return member;
  }

  // --- Doctor Access Grants Store ---
  public addDoctorGrant(grant: DoctorAccessGrant): DoctorAccessGrant {
    if (!grant.patientId || grant.patientId.trim() === '') {
      const derived = derivePatientId();
      if (derived) grant.patientId = derived;
    }
    this.doctorGrants.set(grant.grantId, grant);
    this.eventBus?.emit('doctor_grant_added', grant);
    this.syncFireAndForget('doctor_grants', grant);
    return grant;
  }

  public getDoctorGrant(grantId: string): DoctorAccessGrant | undefined {
    return this.doctorGrants.get(grantId);
  }

  public getDoctorGrants(patientId: string): DoctorAccessGrant[] {
    if (!patientId || patientId.trim() === '') return [];
    return Array.from(this.doctorGrants.values()).filter((g) => g.patientId === patientId);
  }

  public revokeDoctorGrant(grantId: string): DoctorAccessGrant | undefined {
    const grant = this.doctorGrants.get(grantId);
    if (!grant) return undefined;
    grant.status = 'revoked';
    this.doctorGrants.set(grantId, grant);
    this.eventBus?.emit('doctor_grant_revoked', grant);
    // alias for legacy listeners that watch grant_added with revoked status — dispatched as revoked specifically
    return grant;
  }

  // --- Doctor-Patient Persistent Links Store ---
  public addDoctorLink(link: DoctorPatientLink): DoctorPatientLink {
    if (!link.patientId || link.patientId.trim() === '') {
      const derived = derivePatientId();
      if (derived) link.patientId = derived;
    }
    const dup = Array.from(this.doctorPatientLinks.values()).find((l) => l.patientId === link.patientId && (l.doctorId === link.doctorId || l.doctorEmail === link.doctorEmail) && l.status === 'active');
    if (dup) return dup;
    this.doctorPatientLinks.set(link.linkId, link);
    this.emitDoctorLinked(link);
    this.logAudit('link_doctor', 'access_grant' as unknown as AuditLogEntry['entityType'], link.linkId, { userId: link.patientId, userName: link.patientName || link.patientId, role: 'patient' as unknown as AuditLogEntry['performedBy']['role'] }, { doctorId: link.doctorId, doctorName: link.doctorName, doctorEmail: link.doctorEmail, permissionLevel: link.permissionLevel }, link.patientId);
    this.syncFireAndForget('doctor_patient_links' as unknown as string, link as unknown as { patientId?: string });
    return link;
  }

  public getDoctorLinksForPatient(patientId: string): DoctorPatientLink[] {
    if (!patientId || patientId.trim() === '') return [];
    return Array.from(this.doctorPatientLinks.values()).filter((l) => l.patientId === patientId && l.status === 'active');
  }

  public getPatientsForDoctor(doctorId: string): DoctorPatientLink[] {
    if (!doctorId || doctorId.trim() === '') return [];
    return Array.from(this.doctorPatientLinks.values()).filter((l) => (l.doctorId === doctorId || l.doctorUserId === doctorId || l.doctorEmail === doctorId) && l.status === 'active');
  }

  public getDoctorLink(linkId: string): DoctorPatientLink | undefined {
    return this.doctorPatientLinks.get(linkId);
  }

  public revokeDoctorLink(linkId: string): DoctorPatientLink | undefined {
    const link = this.doctorPatientLinks.get(linkId);
    if (!link) return undefined;
    link.status = 'revoked';
    (link as unknown as { revokedAt?: string }).revokedAt = new Date().toISOString();
    this.doctorPatientLinks.set(linkId, link);
    this.emitDoctorRevoked(link);
    this.logAudit('revoke_doctor', 'access_grant' as unknown as AuditLogEntry['entityType'], linkId, { userId: link.patientId, userName: link.patientName || link.patientId, role: 'patient' as unknown as AuditLogEntry['performedBy']['role'] }, { doctorId: link.doctorId, doctorName: link.doctorName }, link.patientId);
    return link;
  }

  public hasDoctorAccess(patientId: string, doctorId: string): boolean {
    if (!patientId || !doctorId) return false;
    return Array.from(this.doctorPatientLinks.values()).some((l) => l.patientId === patientId && (l.doctorId === doctorId || l.doctorUserId === doctorId || l.doctorEmail === doctorId) && l.status === 'active');
  }

  public updateDoctorPermission(linkId: string, permissionLevel: DoctorPatientLink['permissionLevel']): DoctorPatientLink | undefined {
    const link = this.doctorPatientLinks.get(linkId);
    if (!link) return undefined;
    link.permissionLevel = permissionLevel;
    this.doctorPatientLinks.set(linkId, link);
    this.emitDoctorLinked(link);
    return link;
  }

  // --- Generic Put & Get Helpers ---
  public async put<T extends { id?: string; grantId?: string; linkId?: string }>(storeName: string, item: T): Promise<T> {
    if (['facts', 'proposals', 'doctorGrants', 'auditLog'].includes(storeName)) {
      throw new Error(`Use typed addFact/addProposal instead of generic put for store ${storeName}`);
    }
    const id = item.id || item.grantId || item.linkId || `item_${Date.now()}`;
    const vault = this as unknown as { [key: string]: Map<string, unknown> | unknown };
    const map = vault[storeName] as Map<string, unknown> | undefined;
    if (map && typeof map.set === 'function') {
      map.set(id, item as unknown as never);
    }
    return item;
  }

  public async get<T>(storeName: string, id: string): Promise<T | undefined> {
    const vault = this as unknown as { [key: string]: Map<string, unknown> | unknown };
    const map = vault[storeName] as Map<string, unknown> | undefined;
    if (map && typeof map.get === 'function') {
      return map.get(id) as T | undefined;
    }
    return undefined;
  }

  public async delete(storeName: string, id: string): Promise<boolean> {
    const vault = this as unknown as { [key: string]: Map<string, unknown> | unknown };
    const map = vault[storeName] as Map<string, unknown> | undefined;
    if (map && typeof map.delete === 'function') {
      return map.delete(id);
    }
    return false;
  }

  // --- Due Cards Store ---
  public addDueCard(card: DueCardRecord): DueCardRecord {
    if (!card.patientId || card.patientId.trim() === '' || card.patientId.trim() === 'patient-s-devi') {
      const derived = derivePatientId();
      if (derived && derived.trim() !== '' && derived.trim() !== 'patient-s-devi') card.patientId = derived;
    }
    // Dedup spam: prevent duplicate panel for same patient (patientId+testPanel) — return existing without growing Map
    const duplicateDue = Array.from(this.dueCards.values()).some(c => c.patientId === card.patientId && c.testPanel === card.testPanel);
    if (duplicateDue) {
      const existing = Array.from(this.dueCards.values()).find(c => c.patientId === card.patientId && c.testPanel === card.testPanel);
      if (existing) return existing;
      return card;
    }
    // Prevent orphan '' storage: do not store if still empty (getter returns [] but Map size leaks) — allow explicit devi
    if (!card.patientId || card.patientId.trim() === '') {
      card.patientId = '';
      return card;
    }
    this.dueCards.set(card.id, card);
    this.eventBus?.emit('due_card_added', card);
    this.syncFireAndForget('due_cards', card);
    return card;
  }

  public getDueCards(patientId: string): DueCardRecord[] {
    if (!patientId || patientId.trim() === '') return [];
    return Array.from(this.dueCards.values()).filter(c => c.patientId === patientId);
  }

  public updateDueCard(id: string, updates: Partial<DueCardRecord>): DueCardRecord | undefined {
    const card = this.dueCards.get(id);
    if (!card) return undefined;
    Object.assign(card, updates);
    this.dueCards.set(id, card);
    this.eventBus?.emit('due_card_updated', card);
    return card;
  }

  // --- Danger Signs Store ---
  public addDangerReport(report: DangerSignReport): DangerSignReport {
    if (!report.patientId || report.patientId.trim() === '') {
      const derived = derivePatientId();
      if (derived) (report as unknown as { patientId: string }).patientId = derived;
    }
    this.dangerReports.set(report.reportId, report);
    this.eventBus?.emit('danger_report_added', report);
    this.syncFireAndForget('danger_reports', report);
    return report;
  }

  public getDangerReports(patientId?: string): DangerSignReport[] {
    if (!patientId || (typeof patientId === 'string' && patientId.trim() === '')) return [];
    const all = Array.from(this.dangerReports.values());
    return all.filter(r => r.patientId === patientId);
  }

  // --- Seed Idempotency Helpers (M1 canonical patient) ---
  /**
   * Check if vault already contains baseline data for given patient.
   * Idempotent guard: true if at least one medication or lab exists for patient.
   * Does NOT check secondary demo patients.
   */
  public isSeeded(patientId: string): boolean {
    if (!patientId) return false;
    const hasMeds = Array.from(this.meds.values()).some((m) => m.patientId === patientId);
    const hasLabs = Array.from(this.labs.values()).some((l) => l.patientId === patientId);
    // Consider seeded if either core store has data; strict version requires both
    return hasMeds && hasLabs;
  }

  /**
   * Lightweight check: any data exists for patient across all stores.
   */
  public hasAnyData(patientId: string): boolean {
    if (!patientId) return false;
    return (
      Array.from(this.meds.values()).some((m) => m.patientId === patientId) ||
      Array.from(this.labs.values()).some((l) => l.patientId === patientId) ||
      Array.from(this.conditions.values()).some((c) => c.patientId === patientId) ||
      Array.from(this.allergies.values()).some((a) => a.patientId === patientId) ||
      Array.from(this.dueCards.values()).some((d) => d.patientId === patientId) ||
      Array.from(this.proposals.values()).some((p) => p.patientId === patientId) ||
      Array.from(this.dangerReports.values()).some((r) => r.patientId === patientId) ||
      Array.from(this.calendarEvents.values()).some((e) => e.patientId === patientId)
    );
  }

  /**
   * Return counts per store for a given patient — useful for seed verification / tests.
   */
  public getSeedCounts(patientId: string): { [key: string]: number } {
    return {
      meds: this.getMedications(patientId).length,
      labs: this.getLabs(patientId).length,
      conditions: this.getConditions(patientId).length,
      allergies: this.getAllergies(patientId).length,
      dueCards: this.getDueCards(patientId).length,
      proposals: this.getProposals(patientId).length,
      dangerReports: this.getDangerReports(patientId).length,
      calendarEvents: this.getCalendarEvents(patientId).length,
    };
  }

  // --- Reset / Seed Helper ---
  public clear(opts?: { preserveAudit?: boolean }): void {
    const preserveAudit = opts?.preserveAudit ?? true;
    this.facts.clear();
    this.documents.clear();
    this.meds.clear();
    this.labs.clear();
    this.allergies.clear();
    this.conditions.clear();
    this.proposals.clear();
    this.calendarEvents.clear();
    this.careCircle.clear();
    this.doctorGrants.clear();
    this.doctorPatientLinks.clear();
    if (!preserveAudit) {
      this.auditLog = [];
    }
    this.questionBank.clear();
    this.dueCards.clear();
    this.dangerReports.clear();
    this.interactionCache.clear();
    try {
      clearMemoEvaluation();
    } catch {
      // ignore
    }
  }

  public clearAll(opts?: { preserveAudit?: boolean }): void {
    this.clear(opts);
  }
}

export const localVault = new LocalVaultManager();

/** Optional helper to wire the app singleton to the global EventBus after init */
export function wireLocalVaultToEventBus(bus: WebMCPEventBus): void {
  localVault.setEventBus(bus);
}

export { LocalVaultManager as LocalVault };
