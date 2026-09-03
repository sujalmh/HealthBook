/**
 * CareCanvas Core: HealthRepository — single access façade over persistence.
 *
 * Storage policy: Supabase Postgres is the system-of-record.
 * `LocalVaultManager` is the write-through cache (in-memory Maps +
 * fire-and-forget Supabase upserts + silent hydration).
 *
 * Derived-data policy: interaction evaluations are AI-native and cache-first.
 * `evaluateInteractions()` serves the STORED AI evaluation when fresh and only
 * invokes `ClinicalInteractionEngine` (AI pipeline, no bundled drug tables) on
 * a cache miss — then stores the result (vault + Supabase) for the next load.
 * Engine failures propagate as AIUnavailableError; callers surface honest
 * loading/error states instead of fabricated content.
 */

import { localVault, type LocalVaultManager } from './LocalVault.ts';
import { ClinicalInteractionEngine } from '../knowledge/interactionEngine.ts';
import {
  buildRegimenHash,
  buildStoredEvaluation,
  getMemoEvaluation,
  isEvaluationFresh,
  type DietFlags,
  type RegimenMedInput,
  type StoredInteractionEvaluation,
} from '../knowledge/interactionCache.ts';
import type { MedicationRecord } from '../../types/vault.ts';
import type { AuditLogEntry } from '../../types/vault.ts';

export const DEFAULT_DIET_FLAGS: DietFlags = {
  drinksGrapefruitDaily: true,
  frequentHighVitKGreens: true,
  dairyBreakfast: true,
  usesPotassiumSaltSubstitute: true,
};

export interface InteractionEvaluationResult extends StoredInteractionEvaluation {
  /** True when served from stored cache without recomputation. */
  fromCache: boolean;
}

function toRegimenInputs(meds: MedicationRecord[]): RegimenMedInput[] {
  return meds.map((m) => ({
    name: m.brandName || m.genericName || m.name || '',
    dose: m.dosage || '',
    genericName: m.genericName || '',
  }));
}

export class HealthRepository {
  constructor(private readonly vault: LocalVaultManager = localVault) {}

  /** Direct access to the underlying write-through cache (escape hatch). */
  public get cache(): LocalVaultManager {
    return this.vault;
  }

  // --- Medications (pass-through with cache-invalidation guarantees) ---

  public getActiveMedications(patientId: string): MedicationRecord[] {
    return this.vault.getActiveMedications(patientId);
  }

  public getMedications(patientId: string, status?: MedicationRecord['status']): MedicationRecord[] {
    return this.vault.getMedications(patientId, status);
  }

  public addMedication(med: MedicationRecord, performedBy?: AuditLogEntry['performedBy']): MedicationRecord {
    return this.vault.addMedication(med, performedBy);
  }

  public updateMedication(
    medId: string,
    updates: Partial<MedicationRecord>,
    performedBy?: AuditLogEntry['performedBy'],
  ): MedicationRecord | undefined {
    return this.vault.updateMedication(medId, updates, performedBy);
  }

  /**
   * Canonical removal — audits, emits, syncs to Supabase, and invalidates
   * stored interaction evaluations. Prefer over `vault.meds.delete`.
   */
  public removeMedication(medId: string, performedBy?: AuditLogEntry['performedBy']): boolean {
    return this.vault.removeMedication(medId, performedBy);
  }

  // --- Derived interaction evaluations (AI-native, STORED, cache-first) ---

  /**
   * Non-computing freshness probe — tells callers whether a stored AI
   * evaluation exists, so spinners only show on real cache misses.
   */
  public hasFreshEvaluation(
    patientId: string,
    meds: MedicationRecord[],
    dietFlags: DietFlags = DEFAULT_DIET_FLAGS,
  ): boolean {
    try {
      const inputs = toRegimenInputs(meds);
      const regimenHash = buildRegimenHash(inputs, dietFlags);
      const memoized = getMemoEvaluation(patientId, regimenHash);
      if (memoized && isEvaluationFresh(memoized, inputs, dietFlags)) return true;
      const stored = this.vault.getInteractionEvaluation(patientId, regimenHash);
      return !!stored && isEvaluationFresh(stored, inputs, dietFlags);
    } catch {
      return false;
    }
  }

  /**
   * Cache-first AI evaluation. On hit returns the stored row (no engine call).
   * On miss runs the three AI analyses concurrently, stores, and returns.
   * Pure + deterministic IDs: same regimen + diet flags => same regimenHash
   * and same result IDs across loads. Throws AIUnavailableError when the
   * pipeline cannot produce an evaluation.
   */
  public async evaluateInteractions(
    patientId: string,
    meds: MedicationRecord[],
    dietFlags: DietFlags = DEFAULT_DIET_FLAGS,
  ): Promise<InteractionEvaluationResult> {
    const inputs = toRegimenInputs(meds);
    const regimenHash = buildRegimenHash(inputs, dietFlags);
    const memoized = getMemoEvaluation(patientId, regimenHash);
    if (memoized && isEvaluationFresh(memoized, inputs, dietFlags)) {
      return { ...memoized, fromCache: true };
    }
    const stored = this.vault.getInteractionEvaluation(patientId, regimenHash);
    if (stored && isEvaluationFresh(stored, inputs, dietFlags)) {
      return { ...stored, fromCache: true };
    }
    const medNames = meds.map((m) => m.brandName || m.genericName || m.name || '');
    const dupInput = meds.map((m) => ({
      name: m.brandName || m.genericName || m.name || '',
      dose: m.dosage || '',
    }));
    // The three AI analyses are independent — run concurrently, not sequentially.
    const [arcs, dietBadges, duplicateAlerts] = await Promise.all([
      ClinicalInteractionEngine.checkDrugInteractions(medNames),
      ClinicalInteractionEngine.checkDietInteractions(medNames, dietFlags),
      ClinicalInteractionEngine.checkDuplicateIngredients(dupInput),
    ]);
    const entry = buildStoredEvaluation({ patientId, meds: inputs, dietFlags, arcs, dietBadges, duplicateAlerts });
    this.vault.storeInteractionEvaluation(entry);
    return { ...entry, fromCache: false };
  }

  /** Explicit invalidation (med mutations already auto-invalidate). */
  public invalidateInteractions(patientId: string): void {
    this.vault.invalidateInteractionCache(patientId);
  }
}

/** App-wide singleton — backed by the existing localVault write-through cache. */
export const healthRepository = new HealthRepository(localVault);
