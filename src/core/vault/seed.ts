/**
 * CareCanvas Core: Centralized Idempotent Vault Seeder (M1)
 * Single source of truth for canonical patient patient-s-devi.
 *
 * Ownership: ws-01-01 (seed.ts, patient_profiles, longitudinal_labs transformation)
 * This module owns all baseline seeding. Per-view if(empty)seed blocks must be removed
 * in later milestones; seeding is invoked once at bootstrap (main.tsx).
 *
 * Idempotency: every record is inserted only if its id is absent in the vault.
 * Second call -> zero duplicates, counts unchanged.
 */

import type { LocalVaultManager } from './LocalVault.ts';
import { mockShantiDeviProfile } from '../../fixtures/patient_profiles.ts';
import { mockShantiDeviLongitudinalLabs, convertToLabRecords } from '../../fixtures/longitudinal_labs.ts';
import type { DueCardRecord, ProposalRecord, CalendarEventRecord } from '../../types/vault.ts';
import type { DangerSignReport } from '../../types/safety.ts';

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

// Baseline DueCard / Proposal / DangerReport / CalendarEvents mirror per-view seeds
// (HomeLabView due_card_kidney_001 + prop_metformin_titration_001, SafetyView danger_edema_001 + cal_*)
// They are centralized here so views can read-only vault.

function getBaselineDueCard(patientId: string): DueCardRecord {
  return {
    id: 'due_card_kidney_001',
    patientId,
    testPanel: 'Creatinine & eGFR Blood Test',
    biomarkers: ['Serum Creatinine', 'eGFR', 'Serum Potassium'],
    dueDate: new Date(Date.now() + 3 * 86400000).toISOString(),
    prescribedBy: 'Dr. Anita Patel, MD',
    prescribedDate: new Date(Date.now() - 11 * 86400000).toISOString(),
    instructions: 'Monitor kidney function post-discharge. Upload smartphone photo of result slip.',
    status: 'due_soon',
  };
}

function getBaselineProposal(patientId: string): ProposalRecord {
  return {
    id: 'prop_metformin_titration_001',
    patientId,
    doctorName: 'Dr. Anita Patel, MD (Nephrology)',
    doctorId: 'dr_patel_md',
    type: 'dose_change',
    medName: 'Metformin',
    previousDose: '1000 mg BID (Morning & Evening)',
    proposedDose: '500 mg PO Daily (Morning Only)',
    reason: 'Kidney filtration decreased to 28 mL/min on remote lab slip. Dose reduction avoids lactic acidosis risk while keeping glucose stable.',
    plainNarration: 'Dr. Patel recommends halving your Metformin dose to 500mg daily because your kidney numbers require a lower dose for safety.',
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
    firstAidAdvice: "Report dispatched to Dr. Patel's triage queue. If chest pain occurs, call 911 immediately.",
  };
}

function getBaselineCalendarEvents(patientId: string): CalendarEventRecord[] {
  return [
    {
      id: 'cal_followup_001',
      patientId,
      title: '🏥 Dr. Patel Clinic Follow-Up',
      eventType: 'doctor_followup',
      scheduledDate: new Date(Date.now() + 3 * 86400000).toISOString(),
      reason: 'Urgent in-person clinical evaluation for ankle swelling and blood pressure control',
      providerName: 'Dr. Anita Patel, MD',
      notifyHoursBefore: [24, 2],
      isCompleted: false,
      syncedToCalendar: true,
      sharedWithCaregivers: ['user_raj_son'],
    },
    {
      id: 'cal_lab_002',
      patientId,
      title: '🧪 Repeat eGFR & Serum Creatinine Lab',
      eventType: 'lab_due',
      scheduledDate: new Date(Date.now() + 28 * 86400000).toISOString(),
      reason: 'Doctor prescribed renal function monitoring',
      providerName: 'Metropolis Healthcare',
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
 * Returns true if seeding was performed, false if skipped.
 */
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
  return seedVault(vault, patientId);
}

/**
 * Idempotent vault seeding for canonical patient.
 * Inserts each fixture record only if its id is absent.
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

  // Use canonical profile data but override patientId if custom
  const profile = mockShantiDeviProfile;
  const effectivePatientId = patientId;

  // 1. Conditions
  for (const c of profile.conditions) {
    const record = patientId === CANONICAL_PATIENT_ID ? c : { ...c, patientId: effectivePatientId };
    if (!vault.conditions.has(record.id)) {
      vault.addCondition(record);
      inserted.conditions++;
    }
  }

  // 2. Allergies
  for (const a of profile.allergies) {
    const record = patientId === CANONICAL_PATIENT_ID ? a : { ...a, patientId: effectivePatientId };
    if (!vault.allergies.has(record.id)) {
      vault.addAllergy(record);
      inserted.allergies++;
    }
  }

  // 3. Medications
  for (const m of profile.activeMedications) {
    const record = patientId === CANONICAL_PATIENT_ID ? m : { ...m, patientId: effectivePatientId };
    if (!vault.meds.has(record.id)) {
      vault.addMedication(record);
      inserted.medications++;
    }
  }

  // 4. Caregiver links
  for (const link of profile.caregivers) {
    const record = patientId === CANONICAL_PATIENT_ID ? link : { ...link, patientId: effectivePatientId };
    const linkId = (record as any).linkId;
    if (!vault.careCircle.has(linkId)) {
      vault.addCaregiverLink(record as any);
      inserted.caregivers++;
    }
  }

  // 5. Longitudinal Labs -> LabRecords
  const labRecords = convertToLabRecords(effectivePatientId, mockShantiDeviLongitudinalLabs);
  for (const lab of labRecords) {
    if (!vault.labs.has(lab.id)) {
      vault.addLab(lab);
      inserted.labs++;
    }
  }

  // 6. DueCard
  const dueCard = getBaselineDueCard(effectivePatientId);
  if (!vault.dueCards.has(dueCard.id)) {
    vault.addDueCard(dueCard);
    inserted.dueCards++;
  }

  // 7. Proposal
  const proposal = getBaselineProposal(effectivePatientId);
  if (!vault.proposals.has(proposal.id)) {
    vault.addProposal(proposal);
    inserted.proposals++;
  }

  // 8. DangerReport
  const danger = getBaselineDangerReport(effectivePatientId);
  if (!vault.dangerReports.has(danger.reportId)) {
    vault.addDangerReport(danger);
    inserted.dangerReports++;
  }

  // 9. CalendarEvents
  const calEvents = getBaselineCalendarEvents(effectivePatientId);
  for (const e of calEvents) {
    if (!vault.calendarEvents.has(e.id)) {
      vault.addCalendarEvent(e);
      inserted.calendarEvents++;
    }
  }

  const counts = vault.getSeedCounts
    ? vault.getSeedCounts(effectivePatientId)
    : {
        meds: vault.getMedications(effectivePatientId).length,
        labs: vault.getLabs(effectivePatientId).length,
        conditions: vault.getConditions(effectivePatientId).length,
        allergies: vault.getAllergies(effectivePatientId).length,
        dueCards: vault.getDueCards(effectivePatientId).length,
        proposals: vault.getProposals(effectivePatientId).length,
        dangerReports: vault.getDangerReports(effectivePatientId).length,
        calendarEvents: vault.getCalendarEvents(effectivePatientId).length,
      };

  const anyInserted = Object.values(inserted).some((v) => v > 0);
  return {
    seeded: anyInserted,
    skipped: !anyInserted,
    reason: anyInserted ? undefined : 'already_seeded_no_new_inserts',
    counts: {
      conditions: (counts as any).conditions ?? (counts as any).meds ?? 0,
      allergies: (counts as any).allergies ?? 0,
      medications: (counts as any).meds ?? (counts as any).medications ?? 0,
      labs: (counts as any).labs ?? 0,
      caregivers: vault.getCaregiverLinks(effectivePatientId).length,
      dueCards: (counts as any).dueCards ?? 0,
      proposals: (counts as any).proposals ?? 0,
      dangerReports: (counts as any).dangerReports ?? 0,
      calendarEvents: (counts as any).calendarEvents ?? 0,
    },
    inserted,
  };
}

/**
 * Hydrate-or-seed helper (M3) — convenience for bootstrap and tests.
 * - If Supabase is enabled, attempts hydrateFromSupabase(patientId, vault) first.
 * - If hydrated>0 returns with skippedSeed=true (seed skipped, idempotent).
 * - Else (skipped / 0 / error / offline) falls back to seedIfEmpty (single source, idempotent).
 * - If Supabase not enabled, directly seeds (local-only graceful).
 * - Never throws; async errors fall back to seed.
 * - No hard-coded password/host; env-only via dynamic import.
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
        // hydrated===0 or skipped => fall through to seed
        const seedRes = seedIfEmpty(vault, patientId);
        return {
          ...seedRes,
          hydrated: h.hydrated,
          hydratedCounts: h.counts as Record<string, number> | undefined,
          skippedHydration: !!h.skipped,
          hydrationError: h.error,
        };
      } catch (e: any) {
        // Hydration threw — fallback to seed, never block mount
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
  // Local-only path or hydration empty/error => seed
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
