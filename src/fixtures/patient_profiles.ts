
import type { AllergyRecord, ConditionRecord, MedicationRecord } from '../types/vault.ts';
import type { LinkedCareProfile } from '../types/carecircle.ts';

export interface PatientProfileFixture {
  id: string;
  name: string;
  mrn: string;
  dob: string;
  age: number;
  gender: 'M' | 'F' | 'Other';
  chronotype: 'early_bird' | 'night_owl' | 'standard';
  dietHabits: {
    drinksGrapefruitDaily: boolean;
    frequentHighVitKGreens: boolean;
    dairyBreakfast: boolean;
    usesPotassiumSaltSubstitute: boolean;
    alcoholFrequency: 'never' | 'rare' | 'moderate' | 'heavy';
  };
  allergies: AllergyRecord[];
  conditions: ConditionRecord[];
  activeMedications: MedicationRecord[];
  caregivers: LinkedCareProfile[];
}

export * from '../../test/fixtures/legacyMocks.ts';
export const __fixtureClean_patient_profiles = true;

