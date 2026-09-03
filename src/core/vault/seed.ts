
import type { LocalVaultManager } from './LocalVault.ts';

export const CANONICAL_PATIENT_ID = 'patient-s-devi';

export interface SeedResult {
  seeded: boolean;
  skipped: boolean;
  reason?: string;
  counts: {
    conditions: number;
    allergies: number;
    medications: number;
    labs: number;
    caregivers: number;
    dueCards: number;
    proposals: number;
    dangerReports: number;
    calendarEvents: number;
  };
  inserted: {
    conditions: number;
    allergies: number;
    medications: number;
    labs: number;
    caregivers: number;
    dueCards: number;
    proposals: number;
    dangerReports: number;
    calendarEvents: number;
  };
}

export function isSeeded(vault: LocalVaultManager, patientId: string = CANONICAL_PATIENT_ID): boolean {
  const v = vault as unknown as { isSeeded?: (p: string) => boolean };
  if (typeof v.isSeeded === 'function') {
    try {
      return v.isSeeded(patientId);
    } catch {

    }
  }
  const meds = vault.getMedications(patientId);
  const labs = vault.getLabs(patientId);
  return meds.length > 0 && labs.length > 0;
}

export function seedIfEmpty(vault: LocalVaultManager, patientId: string = CANONICAL_PATIENT_ID): SeedResult {

  if (isSeeded(vault, patientId)) {
    const counts = vault.getSeedCounts
      ? vault.getSeedCounts(patientId)
      : {
          meds: vault.getMedications(patientId).length,
          labs: vault.getLabs(patientId).length,
          conditions: vault.getConditions(patientId).length,
          allergies: vault.getAllergies(patientId).length,
          dueCards: vault.getDueCards(patientId).length,
          proposals: vault.getProposals(patientId).length,
          dangerReports: vault.getDangerReports(patientId).length,
          calendarEvents: vault.getCalendarEvents(patientId).length,
        };
    const c = counts as unknown as { conditions?: number; allergies?: number; meds?: number; medications?: number; labs?: number; dueCards?: number; proposals?: number; dangerReports?: number; calendarEvents?: number };
    return {
      seeded: false,
      skipped: true,
      reason: 'already_seeded',
      counts: {
        conditions: c.conditions ?? 0,
        allergies: c.allergies ?? 0,
        medications: c.meds ?? c.medications ?? 0,
        labs: c.labs ?? 0,
        caregivers: vault.getCaregiverLinks(patientId).length,
        dueCards: c.dueCards ?? 0,
        proposals: c.proposals ?? 0,
        dangerReports: c.dangerReports ?? 0,
        calendarEvents: c.calendarEvents ?? 0,
      },
      inserted: {
        conditions: 0,
        allergies: 0,
        medications: 0,
        labs: 0,
        caregivers: 0,
        dueCards: 0,
        proposals: 0,
        dangerReports: 0,
        calendarEvents: 0,
      },
    };
  }

  return seedVault(vault, patientId);
}

export function seedVault(vault: LocalVaultManager, patientId: string = CANONICAL_PATIENT_ID): SeedResult {
  const inserted = {
    conditions: 0,
    allergies: 0,
    medications: 0,
    labs: 0,
    caregivers: 0,
    dueCards: 0,
    proposals: 0,
    dangerReports: 0,
    calendarEvents: 0,
  };

  const counts = vault.getSeedCounts
    ? vault.getSeedCounts(patientId)
    : {
        meds: vault.getMedications(patientId).length,
        labs: vault.getLabs(patientId).length,
        conditions: vault.getConditions(patientId).length,
        allergies: vault.getAllergies(patientId).length,
        dueCards: vault.getDueCards(patientId).length,
        proposals: vault.getProposals(patientId).length,
        dangerReports: vault.getDangerReports(patientId).length,
        calendarEvents: vault.getCalendarEvents(patientId).length,
      };
  const c = counts as unknown as { conditions?: number; allergies?: number; meds?: number; medications?: number; labs?: number; dueCards?: number; proposals?: number; dangerReports?: number; calendarEvents?: number };

  return {
    seeded: false,
    skipped: true,
    reason: 'mock_seeding_removed_empty_vault',
    counts: {
      conditions: c.conditions ?? c.meds ?? 0,
      allergies: c.allergies ?? 0,
      medications: c.meds ?? c.medications ?? 0,
      labs: c.labs ?? 0,
      caregivers: vault.getCaregiverLinks(patientId).length,
      dueCards: c.dueCards ?? 0,
      proposals: c.proposals ?? 0,
      dangerReports: c.dangerReports ?? 0,
      calendarEvents: c.calendarEvents ?? 0,
    },
    inserted,
  };
}

export async function hydrateOrSeed(
  vault: LocalVaultManager,
  patientId: string = CANONICAL_PATIENT_ID
): Promise<SeedResult & { hydrated: number; hydratedCounts?: { [key: string]: number }; skippedHydration?: boolean; hydrationError?: string }> {

  try {
    const { isSupabaseEnabled } = await import('../supabase/client.ts');
    if (isSupabaseEnabled()) {
      try {
        const { hydrateFromSupabase } = await import('./supabaseSync.ts');
        const h = await hydrateFromSupabase(patientId, vault);
        if (h.hydrated > 0) {
          const counts = vault.getSeedCounts
            ? vault.getSeedCounts(patientId)
            : {
                meds: vault.getMedications(patientId).length,
                labs: vault.getLabs(patientId).length,
                conditions: vault.getConditions(patientId).length,
                allergies: vault.getAllergies(patientId).length,
                dueCards: vault.getDueCards(patientId).length,
                proposals: vault.getProposals(patientId).length,
                dangerReports: vault.getDangerReports(patientId).length,
                calendarEvents: vault.getCalendarEvents(patientId).length,
              };
          const c = counts as unknown as { conditions?: number; allergies?: number; meds?: number; medications?: number; labs?: number; dueCards?: number; proposals?: number; dangerReports?: number; calendarEvents?: number };
          return {
            seeded: false,
            skipped: true,
            reason: 'hydrated_from_supabase',
            counts: {
              conditions: c.conditions ?? 0,
              allergies: c.allergies ?? 0,
              medications: c.meds ?? c.medications ?? 0,
              labs: c.labs ?? 0,
              caregivers: vault.getCaregiverLinks(patientId).length,
              dueCards: c.dueCards ?? 0,
              proposals: c.proposals ?? 0,
              dangerReports: c.dangerReports ?? 0,
              calendarEvents: c.calendarEvents ?? 0,
            },
            inserted: {
              conditions: 0,
              allergies: 0,
              medications: 0,
              labs: 0,
              caregivers: 0,
              dueCards: 0,
              proposals: 0,
              dangerReports: 0,
              calendarEvents: 0,
            },
            hydrated: h.hydrated,
            hydratedCounts: h.counts as unknown as { [key: string]: number } | undefined,
            skippedHydration: !!h.skipped,
            hydrationError: h.error,
          };
        }
        const seedRes = seedIfEmpty(vault, patientId);
        return {
          ...seedRes,
          hydrated: h.hydrated,
          hydratedCounts: h.counts as unknown as { [key: string]: number } | undefined,
          skippedHydration: !!h.skipped,
          hydrationError: h.error,
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        const seedRes = seedIfEmpty(vault, patientId);
        return {
          ...seedRes,
          hydrated: 0,
          skippedHydration: true,
          hydrationError: msg,
        };
      }
    }
  } catch {

  }

  const seedRes = seedIfEmpty(vault, patientId);
  return { ...seedRes, hydrated: 0, skippedHydration: true };
}

export default {
  CANONICAL_PATIENT_ID,
  isSeeded,
  seedIfEmpty,
  seedVault,
  hydrateOrSeed,
};

