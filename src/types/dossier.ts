/**
 * Healthbook Types: Continuity Dossier & Lifetime Health Record (M6)
 */

import type {
  BoundingBox,
  Fact,
  MedicationRecord,
  LabRecord,
  AllergyRecord,
  ConditionRecord,
  ProposalRecord,
  CalendarEventRecord,
  AuditLogEntry,
  QuestionBankItem,
  DueCardRecord
} from './vault.ts';
import type { LinkedCareProfile, DoctorAccessGrant } from './carecircle.ts';
import type { DangerSignReport } from './safety.ts';

export type DossierTimelineCategory =
  | 'all'
  | 'labs'
  | 'meds'
  | 'visits'
  | 'danger_signs'
  | 'doctor_notes'
  | 'allergies'
  | 'conditions'
  | 'proposals'
  | 'audit';

export interface DossierTimelineItem {
  id: string;
  date: string;
  category: DossierTimelineCategory;
  title: string;
  description: string;
  statusBadge?: string;
  badgeColor?: string;
  doctorName?: string;
  doctorComment?: string;
  dosageTransition?: {
    medName: string;
    previousDose: string;
    newDose: string;
    reason?: string;
  };
  sourceDocId?: string;
  sourceFileName?: string;
  pageIndex?: number;
  boundingBox?: BoundingBox;
  snippetText?: string;
  metadata?: Record<string, unknown>;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  isPrimary: boolean;
}

export interface BaselineVitals {
  systolicBP?: number;
  diastolicBP?: number;
  heartRate?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weightLbs?: number;
  temperatureF?: number;
  lastUpdated?: string;
}

export interface CriticalLabSummary {
  marker: string;
  value: number;
  unit: string;
  drawDate: string;
  flag: 'NORMAL' | 'HIGH' | 'LOW' | 'CRITICAL_HIGH' | 'CRITICAL_LOW';
  referenceRange: { low: number; high: number };
  isCritical?: boolean;
}

export interface QRValidationStamp {
  stampId: string;
  verificationCode: string;
  generatedAt: string;
  hash: string;
  signature: string;
  issuer: string;
  qrPayload: string;
}

export interface EmergencySnapshot {
  patientId: string;
  patientName: string;
  mrn: string;
  dob: string;
  age: number;
  gender: string;
  bloodType: string;
  codeStatus: string;
  verifiedAllergies: AllergyRecord[];
  activeMedications: MedicationRecord[];
  baselineVitals: BaselineVitals;
  mostRecentCriticalLabs: CriticalLabSummary[];
  emergencyContacts: EmergencyContact[];
  qrValidationStamp: QRValidationStamp;
}

export interface SourceDocumentCitation {
  citationId: string;
  documentId: string;
  fileName: string;
  factName: string;
  boundingBox: BoundingBox;
  snippetText: string;
  pageIndex?: number;
  extractedDate?: string;
}

export interface FHIRResource {
  resourceType: string;
  id: string;
  /** Open FHIR extension — unknown at boundary, validated via schema before use */
  [key: string]: unknown;
}

export interface FHIRR4Bundle {
  resourceType: 'Bundle';
  id: string;
  type: 'document' | 'collection' | 'searchset';
  timestamp: string;
  meta: {
    lastUpdated: string;
    profile: string[];
  };
  identifier: {
    system: string;
    value: string;
  };
  total?: number;
  entry: Array<{
    fullUrl: string;
    resource: FHIRResource;
  }>;
}

export interface CompiledHealthRecord {
  recordType: 'ContinuityDossierCompilation';
  patientId: string;
  patientProfile: {
    id: string;
    name: string;
    mrn: string;
    dob: string;
    age: number;
    gender: string;
    allergies: AllergyRecord[];
    chronicConditions: ConditionRecord[];
    emergencyContacts?: EmergencyContact[];
  };
  emergencySnapshot: EmergencySnapshot;
  facts: Fact[];
  activeMedications: MedicationRecord[];
  allMedications: MedicationRecord[];
  longitudinalLabs: LabRecord[];
  chronicConditions: ConditionRecord[];
  allergies: AllergyRecord[];
  proposals: ProposalRecord[];
  reconciliationHistorySummary: {
    admissionDate: string;
    dischargeDate: string;
    changesCount: number;
    ward?: string;
    attendingPhysician?: string;
  }[];
  recentHomeLabReviews: {
    testPanel: string;
    completedDate: string;
    doctorComment?: string;
    biomarkers?: string[];
  }[];
  safetyAlertsHistory: DangerSignReport[];
  calendarEvents: CalendarEventRecord[];
  caregiverProxyAuditTrail: AuditLogEntry[];
  doctorAccessGrants: DoctorAccessGrant[];
  questionBankItems: QuestionBankItem[];
  dueCards: DueCardRecord[];
  sourceDocumentCitations: SourceDocumentCitation[];
  timelineItems: DossierTimelineItem[];
  exportTimestamp: string;
  format?: 'json_dossier' | 'fhir_r4' | 'emergency_snapshot' | string;
  fhirBundle?: FHIRR4Bundle;
}
