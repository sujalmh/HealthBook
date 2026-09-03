/**
 * Healthbook Types: RxBridge Post-Discharge 3-List Reconciliation Engine
 */

export type ChangeStatusBadge = 'CONTINUED' | 'DOSE_CHANGED' | 'STOPPED' | 'NEW' | 'HELD_AND_RESUMED';

export type ReconciliationFilter = 'ALL' | 'NEW' | 'DOSE_CHANGED' | 'STOPPED' | 'CONTINUED' | 'HELD_AND_RESUMED';

export interface PreAdmissionMedItem {
  medName: string;
  dose: string;
  frequency: string;
  indication?: string;
  isOTC?: boolean;
}

export interface InHospitalMedItem {
  medName: string;
  dose: string;
  reason?: string;
  statusChange?: string;
}

export interface DischargeMedItem {
  medName: string;
  dose: string;
  frequency: string;
  status: ChangeStatusBadge;
  reason: string;
  timingSlots?: ('morning' | 'noon' | 'evening' | 'bedtime')[];
  dietInstructions?: string;
}

export interface FlaggedReconciliationInteraction {
  id: string;
  drugA: string;
  drugB: string;
  severity: 'CONTRAINDICATED' | 'MAJOR' | 'MODERATE';
  mechanism: string;
  clinicalGuidance: string;
  isPreAdmitOTC: boolean;
  labContextWarning?: string;
}

export interface FlaggedDietInteraction {
  id: string;
  medName: string;
  dietItem: string;
  severity: 'CONTRAINDICATED' | 'MAJOR' | 'MODERATE';
  badge: string;
  mechanism: string;
  clinicalGuidance: string;
}

export interface ReconciledMedChangeItem {
  medId: string;
  medName: string;
  genericName: string;
  preHospDose?: string;
  preHospFrequency?: string;
  inHospAction?: string;
  inHospReason?: string;
  dischargeDose: string;
  dischargeFrequency?: string;
  statusBadge: ChangeStatusBadge;
  plainLanguageExplanation: string;
  documentedReason?: string;
  isApprovedByPatient: boolean;
  patientComment?: string;
  suggestedQuestions?: string[];
  dietBadges?: string[];
  timingSlots?: ('morning' | 'noon' | 'evening' | 'bedtime')[];
  dietInstructions?: string;
  isOTC?: boolean;
  interactions?: FlaggedReconciliationInteraction[];
  dietInteractions?: FlaggedDietInteraction[];
}

export interface TeachBackCheck {
  patientId: string;
  promptQuestion: string;
  patientResponse: string;
  comprehensionScore: 'accurate' | 'minor_confusion' | 'misunderstood';
  feedbackNarration: string;
  verifiedAt: string;
}

export interface PatientHomeSummaryExport {
  patientName: string;
  dischargeDate: string;
  ward: string;
  attendingPhysician: string;
  whatChangedSummary: {
    medName: string;
    change: string;
    reason: string;
  }[];
  activeDailySchedule: {
    slot: 'morning' | 'noon' | 'evening' | 'bedtime';
    timeString: string;
    meds: { name: string; dose: string; instructions: string }[];
  }[];
  foodAndDietRules: string[];
  redFlagWarningSymptoms: string[];
  doctorQuestionBankItems: string[];
  emergencyContact: {
    clinicName: string;
    phone: string;
    dischargeWardPhone: string;
  };
  qrCodeVerificationPayload: string;
  language: 'en' | 'es' | 'hi';
}

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
