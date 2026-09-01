/**
 * CareCanvas Types: Approved Fact Vault & Entity Models
 * Fact boundingBox optional but AI provides normalized bbox with grounded coordinates plus confidence and plainExplanation via structured outputs.
 * Vision+text multimodal single request provides grounded bbox not fixed, confidence above zero, categories typed.
 */

export interface BoundingBox {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  highlightColor?: string;
  textSnippet?: string;
}

export type FactCategory = 'lab' | 'medication' | 'allergy' | 'condition' | 'supplement' | 'vital_sign' | 'diet_habit' | string;
export type FactStatus = 'unconfirmed' | 'confirmed' | 'rejected' | 'pending' | 'approved' | 'edited';

export interface Fact {
  id: string;
  patientId: string;
  category: FactCategory;
  name: string;
  value: any;
  factKey?: string;
  factValue?: any;
  unit?: string;
  confidence?: number;
  status: FactStatus;
  approvalStatus?: FactStatus;
  sourceDocId?: string;
  documentId?: string;
  boundingBox?: BoundingBox;
  sourceBoundingBox?: BoundingBox;
  plainExplanation: string;
  plainNarration?: string;
  author: any;
  actorName?: string;
  approvedBy?: string;
  approvedAt?: string;
  timestamp: string;
  createdAt?: string;
  metadata?: Record<string, any>;
}

export type FactEntity = Fact;

export interface DocumentRecord {
  id: string;
  patientId: string;
  fileName?: string;
  name?: string;
  title?: string;
  docType?: 'discharge_summary' | 'in_hospital_chart' | 'pre_admission_list' | 'lab_slip_photo' | 'clinic_note' | 'general_pdf' | string;
  type?: string;
  pageCount: number;
  uploadTimestamp: string;
  uploadedAt?: string;
  extractedText?: string;
  rawBuffer?: string; // base64 or mock uri
  extractedFactIds: string[];
}

export interface MedicationRecord {
  id: string;
  patientId: string;
  name?: string;
  brandName?: string;
  genericName: string;
  dosage: string;
  unit?: string;
  frequency: string;
  timingSlots: ('morning' | 'noon' | 'evening' | 'bedtime')[];
  withFood: boolean;
  avoidGrapefruit?: boolean;
  avoidAlcohol?: boolean;
  avoidDairy?: boolean;
  emptyStomach?: boolean;
  status: 'active' | 'stopped' | 'pending_proposal' | 'held' | 'discontinued';
  source?: string;
  startDate?: string;
  stopDate?: string;
  indication?: string;
  colorBadge?: string;
}

export interface LabRecord {
  id: string;
  patientId: string;
  marker: string;
  markerCode?: string;
  value: number;
  unit: string;
  normalizedValue: number;
  normalizedUnit: string;
  drawDate: string;
  referenceRange: { low: number; high: number };
  optimalRange: { low: number; high: number };
  isBorderline: boolean;
  isCritical: boolean;
  flag?: 'NORMAL' | 'HIGH' | 'LOW' | 'CRITICAL_HIGH' | 'CRITICAL_LOW';
  sourceDocId?: string;
  boundingBox?: BoundingBox;
  doctorComment?: {
    id?: string;
    doctorId: string;
    doctorName: string;
    comment: string;
    timestamp: string;
    pinnedMarker?: string;
    read?: boolean;
  };
  doctorComments?: {
    id?: string;
    doctorId: string;
    doctorName: string;
    comment: string;
    timestamp: string;
    pinnedMarker?: string;
    read?: boolean;
  }[];
}

export interface AllergyRecord {
  id: string;
  patientId: string;
  allergen: string;
  reaction: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life_threatening';
  recordedDate: string;
  sourceDocId?: string;
  boundingBox?: BoundingBox;
}

export interface ConditionRecord {
  id: string;
  patientId: string;
  conditionName: string;
  icd10?: string;
  diagnosedDate?: string;
  status: 'active' | 'resolved' | 'chronic';
  sourceDocId?: string;
  boundingBox?: BoundingBox;
}

export interface ProposalRecord {
  id: string;
  patientId: string;
  doctorName: string;
  doctorId?: string;
  type: 'dose_change' | 'add_med' | 'remove_med' | 'schedule_shift';
  medId?: string;
  medName: string;
  previousDose?: string;
  proposedDose?: string;
  previousSlot?: string;
  proposedSlot?: string;
  reason: string;
  plainNarration?: string;
  linkedLabId?: string;
  linkedDangerId?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  timestamp: string;
  approvedAt?: string;
  approvedBy?: string;
  approvalRole?: string;
  onBehalfOf?: string;
}

export interface CalendarEventRecord {
  id: string;
  patientId: string;
  title: string;
  eventType: 'lab_due' | 'doctor_followup' | 'med_reminder' | 'urgent_triage';
  scheduledDate: string;
  scheduledDateEnd?: string;
  reason: string;
  providerName?: string;
  notifyHoursBefore?: number[];
  isCompleted: boolean;
  syncedToCalendar: boolean;
  icsData?: string;
  sharedWithCaregivers?: string[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  entityId: string;
  entityType: 'fact' | 'med' | 'lab' | 'proposal' | 'access_grant' | 'danger_sign' | 'calendar_event' | 'due_card';
  performedBy: {
    userId: string;
    userName: string;
    role: 'patient' | 'caregiver' | 'doctor' | 'system';
    onBehalfOf?: string;
  };
  details: Record<string, any>;
  /** Patient isolation key — populated when audit originates from a patient-scoped entity */
  patientId?: string;
  hash?: string;
}

export interface QuestionBankItem {
  id: string;
  patientId: string;
  questionText: string;
  category: 'medication_change' | 'lab_trend' | 'symptom_monitoring' | 'general' | 'medication_clarification';
  sourceModule?: 'rxbridge' | 'labstory' | 'homelab' | 'safety' | 'patient_custom' | 'vault';
  originModule?: 'rxbridge' | 'labstory' | 'homelab' | 'safety' | 'patient_custom' | 'vault';
  context?: string;
  linkedMedName?: string;
  linkedLabMarker?: string;
  priority?: 'high' | 'urgent' | 'routine' | 'medium' | 'low';
  clinicalRationale?: string;
  status: 'pending' | 'discussed' | 'resolved' | 'active' | 'dismissed';
  includedInExport?: boolean;
  createdAt: string;
}

export interface DueCardRecord {
  id: string;
  patientId: string;
  testPanel: string;
  biomarkers: string[];
  dueDate: string;
  prescribedBy: string;
  prescribedDate: string;
  instructions?: string;
  status: 'due_soon' | 'completed' | 'overdue';
  completedLabId?: string;
}

export type { LinkedCareProfile, DoctorAccessGrant } from './carecircle.ts';
