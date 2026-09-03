/**
 * Healthbook Types: PillMap Visual Polypharmacy Negotiator (M3)
 */

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type TimeSlot = 'morning' | 'noon' | 'evening' | 'bedtime';
export type Chronotype = 'early_bird' | 'night_owl' | 'standard';

export interface PillSlotItem {
  id: string;
  medId: string;
  name: string;
  brandName?: string;
  genericName?: string;
  dosage: string;
  frequency?: string;
  color: string;
  shape: 'round' | 'capsule' | 'oval';
  category?: 'cardiovascular' | 'antidiabetic' | 'antibiotic' | 'analgesic' | 'supplement' | 'thyroid' | 'gastrointestinal' | 'psychiatric' | 'other';
  withFood: boolean;
  emptyStomach?: boolean;
  avoidGrapefruit?: boolean;
  avoidAlcohol?: boolean;
  avoidDairy?: boolean;
  timingSlots?: TimeSlot[];
  days?: DayOfWeek[];
  status?: 'active' | 'ghost_preview' | 'fading_out' | 'pulsing_in';
}

export interface PillboxGrid {
  [day: string]: {
    morning: PillSlotItem[];
    noon: PillSlotItem[];
    evening: PillSlotItem[];
    bedtime: PillSlotItem[];
  };
}

export interface InteractionArc {
  id: string;
  drugA: string;
  drugB: string;
  severity: 'CONTRAINDICATED' | 'MAJOR' | 'MODERATE' | 'MINOR';
  arcColor: string; // Red #EF4444, Orange #F97316, Yellow #EAB308
  mechanism: string;
  clinicalGuidance: string;
  affectedSlots: { day: DayOfWeek; slot: TimeSlot }[];
}

export interface DietBadge {
  id: string;
  drugName: string;
  dietItem: string;
  severity: 'CONTRAINDICATED' | 'MAJOR' | 'MODERATE';
  badgeText: string;
  plateArcColor: string;
  mechanism: string;
  clinicalGuidance: string;
}

export interface DuplicateIngredientAlert {
  id: string;
  ingredient: string;
  drugsInvolved: { name: string; dose: string; ingredientAmountMg: number }[];
  totalCumulativeDoseMg: number;
  maxSafeDailyDoseMg: number;
  isOverLimit: boolean;
  plainNarration: string;
}

export interface GhostPreviewShift {
  medId: string;
  medName: string;
  fromSlot: TimeSlot;
  toSlot: TimeSlot;
  fromDay?: DayOfWeek;
  toDay?: DayOfWeek;
  reason: string;
}

export interface ScheduleSuggestionResult {
  chronotype: Chronotype;
  proposedShifts: GhostPreviewShift[];
  resolvedConflictsCount: number;
  plainExplanation: string;
}

export interface MissedDoseSimulationResult {
  medName: string;
  missedSlot: { day: DayOfWeek; slot: TimeSlot };
  clinicalImpactSummary: string;
  projectedBiomarkerDelta?: {
    biomarker: string;
    estimatedChange: string;
  };
  recoveryProtocol: string;
  doNotDoubleDoseWarning: boolean;
}

export interface PharmacistExportBundle {
  patientName: string;
  generatedDate: string;
  activeRegimenGrid: PillboxGrid;
  brandGenericCrosswalk: { brand: string; generic: string; class: string; dose: string; frequency?: string; timingSlots?: string[] }[];
  drugInteractions: InteractionArc[];
  dietTimingRules: DietBadge[];
  duplicateAlerts?: DuplicateIngredientAlert[];
  pharmacistVerificationNotes: string[];
  signatureBlock: {
    requiresPharmDSignature: boolean;
    verificationStatus?: string;
    verificationDate?: string;
  };
}

export interface ArcCoordinate {
  id: string;
  fromMed: string;
  toMed: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  path: string;
  arcColor: string;
  severity: 'CONTRAINDICATED' | 'MAJOR' | 'MODERATE' | 'MINOR';
  mechanism: string;
  clinicalGuidance: string;
}

export const CHRONOTYPE_TIMES: Record<Chronotype, Record<TimeSlot, string>> = {
  early_bird: {
    morning: '06:30',
    noon: '11:30',
    evening: '17:30',
    bedtime: '21:00'
  },
  standard: {
    morning: '08:00',
    noon: '12:00',
    evening: '18:00',
    bedtime: '22:00'
  },
  night_owl: {
    morning: '10:00',
    noon: '14:00',
    evening: '20:00',
    bedtime: '00:30'
  }
};

export const DAYS_OF_WEEK: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
export const TIME_SLOTS: TimeSlot[] = ['morning', 'noon', 'evening', 'bedtime'];
