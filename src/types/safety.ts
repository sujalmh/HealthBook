/**
 * CareCanvas Types: Safety Alerts, Doctor Remote Pillbox & Calendar
 */

export type DangerSymptomTag =
  | 'edema_feet'
  | 'dyspnea'
  | 'chest_pain'
  | 'dizziness'
  | 'shakiness'
  | 'sweating'
  | 'confusion'
  | 'headache'
  | 'vision_changes'
  | 'bleeding_bruising';

export interface DangerSignReport {
  reportId: string;
  patientId: string;
  symptomTags: DangerSymptomTag[];
  freeText: string;
  severityRating: 'mild' | 'moderate' | 'severe' | 'critical';
  vitalSigns?: {
    systolicBP?: number;
    diastolicBP?: number;
    heartRate?: number;
    weightLbs?: number;
  };
  photoAttachment?: {
    id: string;
    fileName: string;
    thumbnailUrl?: string;
  };
  timestamp: string;
  triagePriority: 'URGENT' | 'EMERGENCY' | 'ROUTINE';
  firstAidAdvice: string;
}

export interface DoctorTriageAlert {
  alertId: string;
  reportId: string;
  patientId: string;
  patientName: string;
  priority: 'URGENT' | 'EMERGENCY' | 'ROUTINE';
  symptoms: string[];
  activeMedicationsSnapshot: string[];
  recentLabsSummary: string[];
  timestamp: string;
  status: 'new' | 'in_review' | 'resolved';
}

export interface DoctorRemotePillAction {
  actionId: string;
  patientId: string;
  doctorName: string;
  actionType: 'remove_med' | 'add_med' | 'change_dose';
  medName: string;
  targetDose?: string;
  timingSlot?: string;
  reason: string;
  status: 'pending_patient_approval' | 'approved' | 'rejected';
  timestamp: string;
}

export interface FollowupAppointmentRecord {
  appointmentId: string;
  patientId: string;
  doctorName: string;
  appointmentType: 'in_person_clinic' | 'telehealth_video';
  scheduledDate: string;
  reason: string;
  telehealthLink?: string;
  clinicAddress?: string;
  attachedQuestionBankCount: number;
  reminderScheduleHours: number[];
}
