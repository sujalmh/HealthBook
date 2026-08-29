/**
 * CareCanvas Types: HomeLab Remote Prescribed Loop
 */

import { LabRecord, ProposalRecord } from './vault.ts';

export interface PrescribedDueCard {
  id: string;
  patientId: string;
  testPanel: string;
  dueDate: string;
  daysRemaining: number;
  isOverdue: boolean;
  prescribedBy: string;
  instructions: string;
  status: 'due_soon' | 'completed' | 'overdue';
}

export interface LabPhotoUploadResult {
  imageId: string;
  fileName: string;
  dimensions?: { width: number; height: number };
  extractedMarkers: {
    marker: string;
    value: number;
    unit: string;
    flag: 'NORMAL' | 'HIGH' | 'LOW' | 'CRITICAL_HIGH' | 'CRITICAL_LOW';
    confidence: number;
    boundingBox?: { pageIndex: number; x: number; y: number; width: number; height: number };
  }[];
  plainNarration: string;
  isBlurryWarning?: boolean;
}

export interface DoctorReviewCommentResult {
  commentId: string;
  labId: string;
  doctorId: string;
  doctorName: string;
  npi?: string;
  commentText: string;
  pinnedMarker?: string;
  timestamp: string;
  readStatus: boolean;
}

export interface DosageProposalCard {
  proposalId: string;
  patientId: string;
  doctorName: string;
  medName: string;
  currentDose: string;
  proposedDose: string;
  reason: string;
  plainNarration: string;
  linkedLabId?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  timestamp: string;
}

export interface PillMapDiffEvent {
  proposalId: string;
  medName: string;
  oldDose: string;
  newDose: string;
  animationType: 'fade_out_old_pulse_new' | 'dissolve_removed' | 'highlight_added';
  newScheduleSlot: string;
  recalculatedConflictsCount: number;
}
