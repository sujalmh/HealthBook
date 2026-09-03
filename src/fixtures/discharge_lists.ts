/**
 * Healthbook Fixtures: 3-List Discharge Datasets — CLEAN (M1 Mock Removal)
 * Mock datasets removed; tools must build from vault or require params.dataset.
 */

import type { PreAdmissionMedItem, InHospitalMedItem, DischargeMedItem } from '../types/rxbridge.ts';

export interface Patient3ListDischargeDataset {
  patientId: string;
  patientName: string;
  admissionDate: string;
  dischargeDate: string;
  ward: string;
  attendingPhysician: string;
  preAdmissionMeds: PreAdmissionMedItem[];
  inHospitalMeds: InHospitalMedItem[];
  dischargeMeds: DischargeMedItem[];
}

// Mock discharge datasets removed — M1.
// Real data comes from vault or params.dataset passed to tools; no mock fallback.
// Test-only legacy bridge:
export * from '../../test/fixtures/legacyMocks.ts';
export const __fixtureClean_discharge_lists = true;
