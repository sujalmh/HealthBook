/**
 * Healthbook Types: Family Care Circle & Continuity Dossier
 */

import { BoundingBox, Fact, MedicationRecord, LabRecord, AllergyRecord, ConditionRecord, AuditLogEntry } from './vault.ts';
import { DangerSignReport } from './safety.ts';

export type CaregiverPermissionLevel = 'view_only' | 'manage' | 'full';

export interface LinkedCareProfile {
  linkId: string;
  patientId: string;
  patientName?: string;
  relationship: 'mother' | 'father' | 'son' | 'daughter' | 'children' | 'husband' | 'wife' | 'partner' | 'brother' | 'sister' | 'guardian' | 'advocate' | 'friend' | 'other' | 'parent' | 'child' | 'spouse' | 'sibling' | string;
  caregiverId?: string;
  caregiverUserId?: string;
  caregiverName: string;
  permissionLevel: CaregiverPermissionLevel;
  linkedDate?: string;
  grantedDate?: string;
  status: 'active' | 'suspended' | 'revoked';
}

export interface ProxyActionLog {
  actionId: string;
  actionName: string;
  caregiverId: string;
  caregiverName: string;
  onBehalfOfPatientId: string;
  onBehalfOfPatientName: string;
  role: string;
  timestamp: string;
  details: Record<string, unknown>;
  cryptographicSignature?: string;
}

export interface DoctorAccessGrant {
  grantId: string;
  patientId: string;
  doctorEmail: string;
  doctorName?: string;
  durationDays: number;
  scope: 'full_dossier' | 'snapshot_only' | 'labs_and_meds';
  permissionScope?: string;
  issuedAt: string;
  expiresAt: string;
  token: string;
  accessToken?: string;
  /** Boundary: validated via Array.isArray before use */
  accessLog?: unknown[];
  status: 'active' | 'expired' | 'revoked';
  revokedAt?: string;
}

export type DoctorPermissionLevel = 'view_only' | 'manage' | 'full';

export interface DoctorPatientLink {
  linkId: string;
  patientId: string;
  patientName?: string;
  doctorId: string;
  doctorUserId?: string;
  doctorName: string;
  doctorEmail?: string;
  specialty?: string;
  permissionLevel: DoctorPermissionLevel;
  scope?: 'full_dossier' | 'snapshot_only' | 'labs_and_meds';
  status: 'active' | 'revoked' | 'suspended';
  linkedDate: string;
  grantedDate?: string;
  revokedAt?: string;
  authToken?: string;
}

export interface ContinuityDossierBundle {
  patientProfile: {
    id: string;
    name: string;
    mrn: string;
    dob: string;
    allergies: AllergyRecord[];
    chronicConditions: ConditionRecord[];
  };
  longitudinalLabs: LabRecord[];
  activeMedications: MedicationRecord[];
  reconciliationHistorySummary: {
    admissionDate: string;
    dischargeDate: string;
    changesCount: number;
  }[];
  recentHomeLabReviews: {
    testPanel: string;
    completedDate: string;
    doctorComment?: string;
  }[];
  safetyAlertsHistory: DangerSignReport[];
  caregiverProxyAuditTrail: AuditLogEntry[];
  sourceDocumentCitations: {
    citationId: string;
    documentId: string;
    fileName: string;
    factName: string;
    boundingBox: BoundingBox;
    snippetText: string;
  }[];
  exportTimestamp: string;
}
