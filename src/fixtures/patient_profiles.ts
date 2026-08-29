/**
 * CareCanvas Fixtures: Multimorbid Patient Profiles & Caregiver Circles
 */

import type {  AllergyRecord, ConditionRecord, MedicationRecord  } from '../types/vault.ts';
import type {  LinkedCareProfile  } from '../types/carecircle.ts';

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

export const mockShantiDeviProfile: PatientProfileFixture = {
  id: 'patient-s-devi',
  name: 'Smt. Shanti Devi',
  mrn: 'MRN-984210',
  dob: '1948-03-14',
  age: 78,
  gender: 'F',
  chronotype: 'standard',
  dietHabits: {
    drinksGrapefruitDaily: true,
    frequentHighVitKGreens: false,
    dairyBreakfast: true,
    usesPotassiumSaltSubstitute: false,
    alcoholFrequency: 'never'
  },
  allergies: [
    {
      id: 'allergy_shanti_pcn',
      patientId: 'patient-s-devi',
      allergen: 'Penicillin',
      reaction: 'Anaphylaxis',
      severity: 'severe',
      recordedDate: '2018-05-10',
      sourceDocId: 'doc_consult_note_nephrology_006',
      boundingBox: { pageIndex: 1, x: 100, y: 220, width: 300, height: 30 }
    }
  ],
  conditions: [
    {
      id: 'cond_shanti_ckd',
      patientId: 'patient-s-devi',
      conditionName: 'Chronic Kidney Disease Stage 3b',
      icd10: 'N18.32',
      diagnosedDate: '2024-04-12',
      status: 'chronic',
      sourceDocId: 'doc_consult_note_nephrology_006',
      boundingBox: { pageIndex: 1, x: 120, y: 340, width: 220, height: 45 }
    },
    {
      id: 'cond_shanti_afib',
      patientId: 'patient-s-devi',
      conditionName: 'Non-valvular Atrial Fibrillation',
      icd10: 'I48.0',
      diagnosedDate: '2026-08-21',
      status: 'active',
      sourceDocId: 'doc_discharge_cardiac_001'
    },
    {
      id: 'cond_shanti_t2d',
      patientId: 'patient-s-devi',
      conditionName: 'Type 2 Diabetes Mellitus',
      icd10: 'E11.9',
      diagnosedDate: '2019-11-04',
      status: 'chronic'
    }
  ],
  activeMedications: [
    {
      id: 'med_shanti_apixaban',
      patientId: 'patient-s-devi',
      brandName: 'Eliquis',
      genericName: 'Apixaban',
      dosage: '5mg',
      unit: 'mg',
      frequency: 'BID',
      timingSlots: ['morning', 'evening'],
      withFood: false,
      status: 'active',
      colorBadge: '#3B82F6'
    },
    {
      id: 'med_shanti_metformin',
      patientId: 'patient-s-devi',
      brandName: 'Glucophage',
      genericName: 'Metformin',
      dosage: '1000mg',
      unit: 'mg',
      frequency: 'BID',
      timingSlots: ['morning', 'evening'],
      withFood: true,
      status: 'active',
      colorBadge: '#10B981'
    },
    {
      id: 'med_shanti_atorvastatin',
      patientId: 'patient-s-devi',
      brandName: 'Lipitor',
      genericName: 'Atorvastatin',
      dosage: '40mg',
      unit: 'mg',
      frequency: 'QHS',
      timingSlots: ['bedtime'],
      withFood: false,
      avoidGrapefruit: true,
      status: 'active',
      colorBadge: '#8B5CF6'
    },
    {
      id: 'med_shanti_levo',
      patientId: 'patient-s-devi',
      brandName: 'Synthroid',
      genericName: 'Levothyroxine',
      dosage: '75mcg',
      unit: 'mcg',
      frequency: 'QAM',
      timingSlots: ['morning'],
      withFood: false,
      emptyStomach: true,
      avoidDairy: true,
      status: 'active',
      colorBadge: '#F59E0B'
    },
    {
      id: 'med_shanti_fishoil',
      patientId: 'patient-s-devi',
      brandName: 'OTC Fish Oil',
      genericName: 'Omega-3 Fatty Acids',
      dosage: '1000mg',
      unit: 'mg',
      frequency: 'QAM',
      timingSlots: ['morning'],
      withFood: true,
      status: 'active',
      colorBadge: '#06B6D4'
    }
  ],
  caregivers: [
    {
      linkId: 'link_raj_devi',
      patientId: 'patient-s-devi',
      patientName: 'Smt. Shanti Devi',
      relationship: 'child',
      caregiverId: 'user_raj_son',
      caregiverName: 'Raj Devi',
      permissionLevel: 'manage',
      linkedDate: '2026-01-10T10:00:00Z',
      status: 'active'
    }
  ]
};

export const mockHaroldJenkinsProfile: PatientProfileFixture = {
  id: 'p_jenkins_72',
  name: 'Harold Jenkins',
  mrn: 'MRN-449102',
  dob: '1954-07-22',
  age: 72,
  gender: 'M',
  chronotype: 'night_owl',
  dietHabits: {
    drinksGrapefruitDaily: false,
    frequentHighVitKGreens: false,
    dairyBreakfast: false,
    usesPotassiumSaltSubstitute: true,
    alcoholFrequency: 'rare'
  },
  allergies: [
    {
      id: 'allergy_jenkins_sulfa',
      patientId: 'p_jenkins_72',
      allergen: 'Sulfonamides',
      reaction: 'Severe Rash',
      severity: 'moderate',
      recordedDate: '2015-08-14'
    }
  ],
  conditions: [
    {
      id: 'cond_jenkins_ckd3b',
      patientId: 'p_jenkins_72',
      conditionName: 'Chronic Kidney Disease Stage 3b',
      icd10: 'N18.32',
      diagnosedDate: '2022-04-10',
      status: 'chronic'
    },
    {
      id: 'cond_jenkins_hfpef',
      patientId: 'p_jenkins_72',
      conditionName: 'Heart Failure with Preserved Ejection Fraction (HFpEF, NYHA Class II)',
      icd10: 'I50.32',
      diagnosedDate: '2023-01-15',
      status: 'chronic'
    },
    {
      id: 'cond_jenkins_t2d',
      patientId: 'p_jenkins_72',
      conditionName: 'Type 2 Diabetes Mellitus',
      icd10: 'E11.9',
      diagnosedDate: '2020-02-18',
      status: 'chronic'
    },
    {
      id: 'cond_jenkins_oa',
      patientId: 'p_jenkins_72',
      conditionName: 'Bilateral Knee Osteoarthritis',
      icd10: 'M17.0',
      diagnosedDate: '2017-09-20',
      status: 'chronic'
    }
  ],
  activeMedications: [
    {
      id: 'med_jenkins_metformin',
      patientId: 'p_jenkins_72',
      brandName: 'Glucophage',
      genericName: 'Metformin',
      dosage: '1000mg',
      unit: 'mg',
      frequency: 'BID',
      timingSlots: ['morning', 'evening'],
      withFood: true,
      status: 'active',
      colorBadge: '#10B981'
    },
    {
      id: 'med_jenkins_empa',
      patientId: 'p_jenkins_72',
      brandName: 'Jardiance',
      genericName: 'Empagliflozin',
      dosage: '10mg',
      unit: 'mg',
      frequency: 'QAM',
      timingSlots: ['morning'],
      withFood: false,
      status: 'active',
      colorBadge: '#3B82F6'
    },
    {
      id: 'med_jenkins_entresto',
      patientId: 'p_jenkins_72',
      brandName: 'Entresto',
      genericName: 'Sacubitril/Valsartan',
      dosage: '49/51mg',
      unit: 'mg',
      frequency: 'BID',
      timingSlots: ['morning', 'evening'],
      withFood: false,
      status: 'active',
      colorBadge: '#EC4899'
    },
    {
      id: 'med_jenkins_furosemide',
      patientId: 'p_jenkins_72',
      brandName: 'Lasix',
      genericName: 'Furosemide',
      dosage: '40mg',
      unit: 'mg',
      frequency: 'QAM',
      timingSlots: ['morning'],
      withFood: false,
      status: 'active',
      colorBadge: '#F59E0B'
    },
    {
      id: 'med_jenkins_carvedilol',
      patientId: 'p_jenkins_72',
      brandName: 'Coreg',
      genericName: 'Carvedilol',
      dosage: '12.5mg',
      unit: 'mg',
      frequency: 'BID',
      timingSlots: ['morning', 'evening'],
      withFood: true,
      status: 'active',
      colorBadge: '#6366F1'
    },
    {
      id: 'med_jenkins_atorva',
      patientId: 'p_jenkins_72',
      brandName: 'Lipitor',
      genericName: 'Atorvastatin',
      dosage: '40mg',
      unit: 'mg',
      frequency: 'QHS',
      timingSlots: ['bedtime'],
      withFood: false,
      avoidGrapefruit: true,
      status: 'active',
      colorBadge: '#8B5CF6'
    },
    {
      id: 'med_jenkins_allopurinol',
      patientId: 'p_jenkins_72',
      brandName: 'Zyloprim',
      genericName: 'Allopurinol',
      dosage: '100mg',
      unit: 'mg',
      frequency: 'QAM',
      timingSlots: ['morning'],
      withFood: true,
      status: 'active',
      colorBadge: '#14B8A6'
    },
    {
      id: 'med_jenkins_tylenol',
      patientId: 'p_jenkins_72',
      brandName: 'Tylenol',
      genericName: 'Acetaminophen',
      dosage: '500mg',
      unit: 'mg',
      frequency: 'TID PRN',
      timingSlots: ['morning', 'noon', 'evening'],
      withFood: false,
      status: 'active',
      colorBadge: '#EF4444'
    },
    {
      id: 'med_jenkins_stjohn',
      patientId: 'p_jenkins_72',
      brandName: 'OTC St. John\'s Wort',
      genericName: 'Hypericum perforatum',
      dosage: '300mg',
      unit: 'mg',
      frequency: 'QAM',
      timingSlots: ['morning'],
      withFood: false,
      status: 'active',
      colorBadge: '#F97316'
    }
  ],
  caregivers: [
    {
      linkId: 'link_susan_jenkins',
      patientId: 'p_jenkins_72',
      patientName: 'Harold Jenkins',
      relationship: 'child',
      caregiverId: 'user_susan_daughter',
      caregiverName: 'Susan Jenkins (Daughter)',
      permissionLevel: 'manage',
      linkedDate: '2026-02-01T10:00:00Z',
      status: 'active'
    }
  ]
};
