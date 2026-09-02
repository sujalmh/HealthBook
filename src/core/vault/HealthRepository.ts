/**
 * CareCanvas Core: HealthRepository — single access façade over persistence.
 *
 * Why this exists (addresses "unnecessary local vault" + "recalculated on
 * each load"):
 * - Before: components imported the `localVault` singleton directly, mutated
 *   `vault.meds` Maps bypassing audit/sync/events (e.g. `meds.delete`), kept
 *   parallel copies in localStorage snapshots, and recomputed pill
 *   interactions on every render.
 * - After: Supabase Postgres is the system-of-record. `LocalVaultManager` is
 *   the write-through cache (in-memory Maps + fire-and-forget Supabase
 *   upserts + silent hydration). This repository is the ONLY recommended
 *   entry point for medication reads/writes and for derived interaction
 *   evaluations. Direct `localVault.meds.set/delete` is deprecated.
 *
 * - Derived data policy: `evaluateInteractions()` is cache-first. It builds
 *   the regimen content-hash, serves the STORED evaluation when fresh, and
 *   only invokes `ClinicalInteractionEngine` on a cache miss — then stores
 *   the result (vault + Supabase) for the next load.
 *
 * Backward compat: this wraps the existing `localVault` singleton, so legacy
 * callers keep working while new code migrates here.
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

  // --- Derived interaction evaluations (STORED, cache-first) ---

  /**
   * Cache-first evaluation. On hit returns the stored row (no engine call).
   * On miss computes via ClinicalInteractionEngine, stores, and returns.
   * Pure + deterministic: same regimen + diet flags => same regimenHash and
   * same result IDs across loads.
   */
  public evaluateInteractions(
    patientId: string,
    meds: MedicationRecord[],
    dietFlags: DietFlags = DEFAULT_DIET_FLAGS,
  ): InteractionEvaluationResult {
    const inputs = toRegimenInputs(meds);
    const regimenHash = buildRegimenHash(inputs, dietFlags);

    // 1) In-process memo (same-session fast path)
    const memoized = getMemoEvaluation(patientId, regimenHash);
    if (memoized && isEvaluationFresh(memoized, inputs, dietFlags)) {
      return { ...memoized, fromCache: true };
    }

    // 2) Stored evaluation in write-through cache (vault + Supabase hydrated)
    const stored = this.vault.getInteractionEvaluation(patientId, regimenHash);
    if (stored && isEvaluationFresh(stored, inputs, dietFlags)) {
      return { ...stored, fromCache: true };
    }

    // 3) Cache miss — compute once, then STORE for subsequent loads
    const medNames = meds.map((m) => m.brandName || m.genericName || m.name || '');
    const arcs = ClinicalInteractionEngine.checkDrugInteractions(medNames);
    const dietBadges = ClinicalInteractionEngine.checkDietInteractions(medNames, dietFlags);
    const duplicateAlerts = ClinicalInteractionEngine.checkDuplicateIngredients(
      meds.map((m) => ({ name: m.brandName || m.genericName || m.name || '', dose: m.dosage || '' })),
    );
    const entry = buildStoredEvaluation({
      patientId,
      meds: inputs,
      dietFlags,
      arcs,
      dietBadges,
      duplicateAlerts,
    });
    this.vault.storeInteractionEvaluation(entry);
    return { ...entry, fromCache: false };
  }

  /** Async variant that prefers AI-grounded engine output when available. */
  public async evaluateInteractionsAI(
    patientId: string,
    meds: MedicationRecord[],
    dietFlags: DietFlags = DEFAULT_DIET_FLAGS,
    useAI = false,
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
    let arcs: InteractionEvaluationResult['arcs'];
    let dietBadges: InteractionEvaluationResult['dietBadges'];
    let duplicateAlerts: InteractionEvaluationResult['duplicateAlerts'];
    if (useAI) {
      const engineAI = ClinicalInteractionEngine as unknown as {
        checkDrugInteractionsAI?: (names: string[]) => Promise<InteractionEvaluationResult['arcs']>;
        checkDietInteractionsAI?: (names: string[], flags: DietFlags) => Promise<InteractionEvaluationResult['dietBadges']>;
        checkDuplicateIngredientsAI?: (
          meds: { name: string; dose: string }[],
        ) => Promise<InteractionEvaluationResult['duplicateAlerts']>;
      };
      try {
        arcs =
          typeof engineAI.checkDrugInteractionsAI === 'function'
            ? await engineAI.checkDrugInteractionsAI(medNames)
            : ClinicalInteractionEngine.checkDrugInteractions(medNames);
        dietBadges =
          typeof engineAI.checkDietInteractionsAI === 'function'
            ? await engineAI.checkDietInteractionsAI(medNames, dietFlags)
            : ClinicalInteractionEngine.checkDietInteractions(medNames, dietFlags);
        const dupInput = meds.map((m) => ({
          name: m.brandName || m.genericName || m.name || '',
          dose: m.dosage || '',
        }));
        duplicateAlerts =
          typeof engineAI.checkDuplicateIngredientsAI === 'function'
            ? await engineAI.checkDuplicateIngredientsAI(dupInput)
            : ClinicalInteractionEngine.checkDuplicateIngredients(dupInput);
      } catch {
        arcs = ClinicalInteractionEngine.checkDrugInteractions(medNames);
        dietBadges = ClinicalInteractionEngine.checkDietInteractions(medNames, dietFlags);
        duplicateAlerts = ClinicalInteractionEngine.checkDuplicateIngredients(
          meds.map((m) => ({ name: m.brandName || m.genericName || m.name || '', dose: m.dosage || '' })),
        );
      }
    } else {
      arcs = ClinicalInteractionEngine.checkDrugInteractions(medNames);
      dietBadges = ClinicalInteractionEngine.checkDietInteractions(medNames, dietFlags);
      duplicateAlerts = ClinicalInteractionEngine.checkDuplicateIngredients(
        meds.map((m) => ({ name: m.brandName || m.genericName || m.name || '', dose: m.dosage || '' })),
      );
    }
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
