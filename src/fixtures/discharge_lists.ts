
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

export * from '../../test/fixtures/legacyMocks.ts';
export const __fixtureClean_discharge_lists = true;

