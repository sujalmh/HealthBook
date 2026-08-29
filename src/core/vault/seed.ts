/**
 * CareCanvas Core: Vault Seeder — CLEAN (M1 Mock Removal)
 * CANONICAL_PATIENT_ID retained ONLY as legacy migration fallback for existing Supabase rows.
 * NOT used as default activeProfile — Create Account (M2) supplies real patientId.
 * Seeding is now NO-OP for new patients: seedVault/seedIfEmpty return empty counts and insert nothing.
 * Keeps signatures for backward compat (isSeeded, seedIfEmpty, seedVault, hydrateOrSeed) but
 * does NOT auto-populate vault with mock profile or labs. Empty vault is the clean foundation.
 */

import type { LocalVaultManager } from './LocalVault.ts';
import type { DueCardRecord, ProposalRecord, CalendarEventRecord } from '../../types/vault.ts';
import type { DangerSignReport } from '../../types/safety.ts';

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

// Baseline helpers retained for potential legacy caller but NOT auto-invoked in seedVault.
// They are unused in clean path; keep for backward compat if legacy test explicitly constructs records.
function getBaselineDueCard(patientId: string): DueCardRecord {
  return {
    id: 'due_card_kidney_001',
    patientId,
    testPanel: 'Creatinine & eGFR Blood Test',
    biomarkers: ['Serum Creatinine', 'eGFR', 'Serum Potassium'],
    dueDate: new Date(Date.now() + 3 * 86400000).toISOString(),
    prescribedBy: 'Your doctor',
    prescribedDate: new Date(Date.now() - 11 * 86400000).toISOString(),
    instructions: 'Monitor kidney function post-discharge. Upload smartphone photo of result slip.',
    status: 'due_soon',
  };
}

function getBaselineProposal(patientId: string): ProposalRecord {
  return {
    id: 'prop_metformin_titration_001',
    patientId,
    doctorName: 'Your doctor',
    doctorId: 'clinician',
    type: 'dose_change',
    medName: 'Metformin',
    previousDose: '1000 mg BID (Morning & Evening)',
    proposedDose: '500 mg PO Daily (Morning Only)',
    reason: 'Kidney filtration decreased to 28 mL/min on remote lab slip. Dose reduction avoids lactic acidosis risk while keeping glucose stable.',
    plainNarration: 'Your doctor recommends halving your Metformin dose to 500mg daily because your kidney numbers require a lower dose for safety.',
    linkedLabId: 'fact_homelab_egfr_28',
    status: 'pending',
    timestamp: new Date().toISOString(),
  };
}

function getBaselineDangerReport(patientId: string): DangerSignReport {
  return {
    reportId: 'danger_edema_001',
    patientId,
    symptomTags: ['edema_feet', 'dyspnea'],
    freeText: 'Sudden bilateral ankle swelling and shortness of breath climbing stairs.',
    severityRating: 'severe',
    vitalSigns: { systolicBP: 185, diastolicBP: 105, heartRate: 92 },
    timestamp: new Date().toISOString(),
    triagePriority: 'URGENT',
    firstAidAdvice: "Report dispatched to your care team's triage queue. If chest pain occurs, call 911 immediately.",
  };
}

function getBaselineCalendarEvents(patientId: string): CalendarEventRecord[] {
  return [
    {
      id: 'cal_followup_001',
      patientId,
      title: '🏥 Clinic Follow-Up',
      eventType: 'doctor_followup',
      scheduledDate: new Date(Date.now() + 3 * 86400000).toISOString(),
      reason: 'Urgent in-person clinical evaluation for ankle swelling and blood pressure control',
      providerName: 'Healthcare provider',
      notifyHoursBefore: [24, 2],
      isCompleted: false,
      syncedToCalendar: true,
      sharedWithCaregivers: ['user_family'],
    },
    {
      id: 'cal_lab_002',
      patientId,
      title: '🧪 Repeat eGFR & Serum Creatinine Lab',
      eventType: 'lab_due',
      scheduledDate: new Date(Date.now() + 28 * 86400000).toISOString(),
      reason: 'Doctor prescribed renal function monitoring',
      providerName: 'Healthcare provider',
      notifyHoursBefore: [24, 2],
      isCompleted: false,
      syncedToCalendar: true,
    },
  ];
}

/**
 * Check if vault is already seeded for given patient.
 * Uses LocalVault.isSeeded if available, otherwise direct counts.
 */
export function isSeeded(vault: LocalVaultManager, patientId: string = CANONICAL_PATIENT_ID): boolean {
  if (typeof (vault as any).isSeeded === 'function') {
    try {
      return (vault as any).isSeeded(patientId);
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
    return {
      seeded: false,
      skipped: true,
      reason: 'already_seeded',
      counts: {
        conditions: (counts as any).conditions ?? 0,
        allergies: (counts as any).allergies ?? 0,
        medications: (counts as any).meds ?? 0,
        labs: (counts as any).labs ?? 0,
        caregivers: vault.getCaregiverLinks(patientId).length,
        dueCards: (counts as any).dueCards ?? 0,
        proposals: (counts as any).proposals ?? 0,
        dangerReports: (counts as any).dangerReports ?? 0,
        calendarEvents: (counts as any).calendarEvents ?? 0,
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
  // Baseline dueCard/proposal/danger/calendar helpers are retained but NOT invoked here.
  // This ensures cold start shows empty states (No records here yet) per M1 AC.

  const counts = vault.getSeedCounts
    ? vault.getSeedCounts(patientId) as any
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

  return {
    seeded: false,
    skipped: true,
    reason: 'mock_seeding_removed_empty_vault',
    counts: {
      conditions: (counts as any).conditions ?? (counts as any).meds ?? 0,
      allergies: (counts as any).allergies ?? 0,
      medications: (counts as any).meds ?? (counts as any).medications ?? 0,
      labs: (counts as any).labs ?? 0,
      caregivers: vault.getCaregiverLinks(patientId).length,
      dueCards: (counts as any).dueCards ?? 0,
      proposals: (counts as any).proposals ?? 0,
      dangerReports: (counts as any).dangerReports ?? 0,
      calendarEvents: (counts as any).calendarEvents ?? 0,
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
): Promise<SeedResult & { hydrated: number; hydratedCounts?: Record<string, number>; skippedHydration?: boolean; hydrationError?: string }> {
  // Dynamic imports avoid static cycle and keep seed.ts deployable without supabase bundle when disabled
  try {
    const { isSupabaseEnabled } = await import('../supabase/client.ts');
    if (isSupabaseEnabled()) {
      try {
        const { hydrateFromSupabase } = await import('./supabaseSync.ts');
        const h = await hydrateFromSupabase(patientId, vault);
        if (h.hydrated > 0) {
          // Remote data present — skip seed to preserve idempotency and avoid duplicate baseline
          const counts = vault.getSeedCounts
            ? vault.getSeedCounts(patientId) as any
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
          return {
            seeded: false,
            skipped: true,
            reason: 'hydrated_from_supabase',
            counts: {
              conditions: (counts as any).conditions ?? 0,
              allergies: (counts as any).allergies ?? 0,
              medications: (counts as any).meds ?? (counts as any).medications ?? 0,
              labs: (counts as any).labs ?? 0,
              caregivers: vault.getCaregiverLinks(patientId).length,
              dueCards: (counts as any).dueCards ?? 0,
              proposals: (counts as any).proposals ?? 0,
              dangerReports: (counts as any).dangerReports ?? 0,
              calendarEvents: (counts as any).calendarEvents ?? 0,
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
            hydratedCounts: h.counts as Record<string, number> | undefined,
            skippedHydration: !!h.skipped,
            hydrationError: h.error,
          };
        }
        // hydrated===0 or skipped => return empty (no mock seed)
        const seedRes = seedIfEmpty(vault, patientId);
        return {
          ...seedRes,
          hydrated: h.hydrated,
          hydratedCounts: h.counts as Record<string, number> | undefined,
          skippedHydration: !!h.skipped,
          hydrationError: h.error,
        };
      } catch (e: any) {
        // Hydration threw — return empty, never block mount
        const seedRes = seedIfEmpty(vault, patientId);
        return {
          ...seedRes,
          hydrated: 0,
          skippedHydration: true,
          hydrationError: e?.message || String(e),
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
