
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

  public get cache(): LocalVaultManager {
    return this.vault;
  }

  public getActiveMedications(patientId: string): MedicationRecord[] {
    return this.vault.getActiveMedications(patientId);
  }

  public getMedications(patientId: string, status?: MedicationRecord['status']): MedicationRecord[] {
    return this.vault.getMedications(patientId, status);
  }

  public async addMedication(med: MedicationRecord, performedBy?: AuditLogEntry['performedBy']): Promise<MedicationRecord> {
    return this.vault.addMedication(med, performedBy);
  }

  public async updateMedication(
    medId: string,
    updates: Partial<MedicationRecord>,
    performedBy?: AuditLogEntry['performedBy'],
  ): Promise<MedicationRecord | undefined> {
    return this.vault.updateMedication(medId, updates, performedBy);
  }

  public async removeMedication(medId: string, performedBy?: AuditLogEntry['performedBy']): Promise<boolean> {
    return this.vault.removeMedication(medId, performedBy);
  }

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

    const [arcs, dietBadges, duplicateAlerts] = await Promise.all([
      ClinicalInteractionEngine.checkDrugInteractions(medNames),
      ClinicalInteractionEngine.checkDietInteractions(medNames, dietFlags),
      ClinicalInteractionEngine.checkDuplicateIngredients(dupInput),
    ]);
    const entry = buildStoredEvaluation({ patientId, meds: inputs, dietFlags, arcs, dietBadges, duplicateAlerts });
    await this.vault.storeInteractionEvaluation(entry);
    return { ...entry, fromCache: false };
  }

  public invalidateInteractions(patientId: string): void {
    this.vault.invalidateInteractionCache(patientId);
  }
}

export const healthRepository = new HealthRepository(localVault);

