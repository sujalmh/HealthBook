/**
 * CareCanvas Fixtures: Patient Profiles — CLEAN (M1 Mock Removal)
 * Mock profiles removed — real data comes from authenticated vault (Create Account).
 * Keeps type export for compile-time use; no mock constants remain.
 */

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

// Mock profiles removed — M1.
// Real profiles are created via Create Account (localStorage + LocalVault) — see seed.ts comment.
// This file intentionally exports only the interface; no mock constants remain.
// Test-only legacy bridge:
export * from '../../test/fixtures/legacyMocks.ts';
export const __fixtureClean_patient_profiles = true;
