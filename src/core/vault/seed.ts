/**
 * CareCanvas Core: Vault Seeder — CLEAN (M1 Mock Removal)
 * CANONICAL_PATIENT_ID retained ONLY as legacy migration fallback for existing Supabase rows.
 * NOT used as default activeProfile — Create Account (M2) supplies real patientId.
 * Seeding is now NO-OP for new patients: seedVault/seedIfEmpty return empty counts and insert nothing.
 * Keeps signatures for backward compat (isSeeded, seedIfEmpty, seedVault, hydrateOrSeed) but
 * does NOT auto-populate vault with mock profile or labs. Empty vault is the clean foundation.
 */

import type { LocalVaultManager } from './LocalVault.ts';

// Legacy migration fallback — documented not to be used as default activeProfile.
// Real patientId comes from authenticated session (localStorage carecanvas_active_user, Supabase auth).
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

/**
 * Check if vault is already seeded for given patient.
 * Uses LocalVault.isSeeded if available, otherwise direct counts.
 */
export function isSeeded(vault: LocalVaultManager, patientId: string = CANONICAL_PATIENT_ID): boolean {
  const v = vault as unknown as { isSeeded?: (p: string) => boolean };
  if (typeof v.isSeeded === 'function') {
    try {
      return v.isSeeded(patientId);
    } catch {
      // fallback
    }
  }
  const meds = vault.getMedications(patientId);
  const labs = vault.getLabs(patientId);
  return meds.length > 0 && labs.length > 0;
}

/**
 * Seed only if vault is empty for patient. Idempotent entry point for main.tsx.
 * CLEAN M1: no longer seeds mock data — returns no-op for new patients (empty vault).
 * Keeps signature for backward compat; real account vault stays empty until user upload.
 */
export function seedIfEmpty(vault: LocalVaultManager, patientId: string = CANONICAL_PATIENT_ID): SeedResult {
  // For clean foundation, never auto-seed mock data for new patients.
  // If vault already has data (legacy migration), report as already_seeded.
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
  // Clean path: do not insert mock data; return empty (real Create Account will own data)
  return seedVault(vault, patientId);
}

/**
 * Idempotent vault seeding — CLEAN M1: no-op (no mock insertion).
 * Retains signature and returns inserted:0 for real patients.
 * Legacy callers expecting mock population will receive empty; tests must use real fixtures.
 * Comment: seeding is legacy; Create Account will use empty vault (see M2).
 */
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

  // CLEAN: No mock insertion. Vault stays empty for new accounts.
  // This ensures cold start shows empty states (No records here yet) per M1 AC.

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

/**
 * Hydrate-or-seed helper (M3) — CLEAN M1: hydration only, no mock seed fallback.
 * - If Supabase is enabled, attempts hydrateFromSupabase(patientId, vault) first.
 * - If hydrated>0 returns with skippedSeed=true (seed skipped, idempotent).
 * - Else (skipped / 0 / error / offline) returns empty (no mock seed) — real account owns data.
 * - If Supabase not enabled, directly returns empty (no seed) — clean empty vault.
 * - Never throws; async errors return empty.
 */
export async function hydrateOrSeed(
  vault: LocalVaultManager,
  patientId: string = CANONICAL_PATIENT_ID
): Promise<SeedResult & { hydrated: number; hydratedCounts?: { [key: string]: number }; skippedHydration?: boolean; hydrationError?: string }> {
  // Dynamic imports avoid static cycle and keep seed.ts deployable without supabase bundle when disabled
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
    // isSupabaseEnabled import/check failed — treat as local-only
  }
  // Local-only path or hydration empty/error => empty vault (no mock seed)
  const seedRes = seedIfEmpty(vault, patientId);
  return { ...seedRes, hydrated: 0, skippedHydration: true };
}

// Default export for convenient bootstrap import
export default {
  CANONICAL_PATIENT_ID,
  isSeeded,
  seedIfEmpty,
  seedVault,
  hydrateOrSeed,
};
