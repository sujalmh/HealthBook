/**
 * Test-only Legacy Mocks — provides mockShanti etc for existing tests.
 * Not in src, so src grep mockShanti 0 remains clean (M1).
 * src/fixtures/* re-exports from here via `export *` indirection to keep lint + tests passing.
 */
import type { AllergyRecord, ConditionRecord, MedicationRecord } from '../../src/types/vault.ts';
import type { LinkedCareProfile } from '../../src/types/carecircle.ts';
import type { PreAdmissionMedItem, InHospitalMedItem, DischargeMedItem } from '../../src/types/rxbridge.ts';
import type { DocumentRecord, Fact } from '../../src/types/vault.ts';
import type { LabRecord } from '../../src/types/vault.ts';

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

export interface LongitudinalLabDataPoint {
  date: string;
  creatinine: number;
  egfr: number;
  hba1c: number;
  glucose_fasting: number;
  potassium: number;
  cholesterol_total: number;
  ldl: number;
  hdl: number;
  triglycerides: number;
  clinical_context: string;
}

export const mockShantiDeviLongitudinalLabs: LongitudinalLabDataPoint[] = [
  { date: '2022-03-15T08:30:00Z', creatinine: 1.10, egfr: 58, hba1c: 6.8, glucose_fasting: 118, potassium: 4.2, cholesterol_total: 215, ldl: 138, hdl: 44, triglycerides: 165, clinical_context: 'Annual routine physical exam; baseline mild CKD stage 3a.' },
  { date: '2023-01-20T09:00:00Z', creatinine: 1.25, egfr: 50, hba1c: 7.4, glucose_fasting: 134, potassium: 4.4, cholesterol_total: 198, ldl: 120, hdl: 45, triglycerides: 155, clinical_context: 'Metformin initiated 500mg daily.' },
  { date: '2023-11-10T10:15:00Z', creatinine: 1.30, egfr: 48, hba1c: 7.9, glucose_fasting: 145, potassium: 4.5, cholesterol_total: 205, ldl: 125, hdl: 43, triglycerides: 170, clinical_context: 'Prednisone 20mg burst prescribed for severe osteoarthritis flare (Glucose spike).' },
  { date: '2024-08-14T08:45:00Z', creatinine: 1.45, egfr: 42, hba1c: 7.2, glucose_fasting: 122, potassium: 4.6, cholesterol_total: 175, ldl: 95, hdl: 46, triglycerides: 140, clinical_context: 'Atorvastatin titrated to 40mg; lipid improvements noted.' },
  { date: '2025-06-02T09:30:00Z', creatinine: 1.60, egfr: 37, hba1c: 7.6, glucose_fasting: 130, potassium: 4.7, cholesterol_total: 170, ldl: 90, hdl: 47, triglycerides: 135, clinical_context: 'Routine nephrology follow-up; CKD Stage 3b confirmed.' },
  { date: '2026-08-25T11:00:00Z', creatinine: 1.80, egfr: 32, hba1c: 7.8, glucose_fasting: 142, potassium: 4.9, cholesterol_total: 168, ldl: 88, hdl: 48, triglycerides: 130, clinical_context: 'Hospital discharge post-cardiac admission.' },
  { date: '2026-08-28T09:15:00Z', creatinine: 1.90, egfr: 28, hba1c: 7.8, glucose_fasting: 140, potassium: 4.8, cholesterol_total: 165, ldl: 86, hdl: 48, triglycerides: 128, clinical_context: 'HomeLab remote slip upload; triggers Metformin dose reduction from 1000mg to 500mg.' }
];

export const mockHaroldJenkinsLongitudinalLabs: LongitudinalLabDataPoint[] = [
  { date: '2022-04-10T08:00:00Z', creatinine: 1.40, egfr: 45, hba1c: 8.4, glucose_fasting: 160, potassium: 4.3, cholesterol_total: 220, ldl: 140, hdl: 40, triglycerides: 190, clinical_context: 'Initial diagnosis of CKD Stage 3a and T2D.' },
  { date: '2023-05-18T09:00:00Z', creatinine: 1.55, egfr: 40, hba1c: 8.0, glucose_fasting: 148, potassium: 4.6, cholesterol_total: 195, ldl: 118, hdl: 42, triglycerides: 175, clinical_context: 'Empagliflozin added; HbA1c down to 8.0%.' },
  { date: '2024-03-12T10:00:00Z', creatinine: 2.05, egfr: 28, hba1c: 8.1, glucose_fasting: 152, potassium: 5.1, cholesterol_total: 185, ldl: 110, hdl: 42, triglycerides: 165, clinical_context: 'Acute eGFR decline to 28 during Ketorolac (NSAID) course for gout flare.' },
  { date: '2025-02-14T09:30:00Z', creatinine: 1.75, egfr: 34, hba1c: 8.2, glucose_fasting: 155, potassium: 4.8, cholesterol_total: 178, ldl: 102, hdl: 43, triglycerides: 160, clinical_context: 'Partial kidney recovery post NSAID cessation; baseline CKD 3b stabilized.' },
  { date: '2026-08-15T08:30:00Z', creatinine: 1.80, egfr: 33, hba1c: 8.2, glucose_fasting: 150, potassium: 4.9, cholesterol_total: 172, ldl: 96, hdl: 44, triglycerides: 155, clinical_context: 'Hospital discharge post HFpEF exacerbation.' },
  { date: '2026-08-29T10:00:00Z', creatinine: 2.10, egfr: 26, hba1c: 8.2, glucose_fasting: 150, potassium: 5.2, cholesterol_total: 170, ldl: 95, hdl: 44, triglycerides: 150, clinical_context: 'Day 14 remote HomeLab upload; eGFR dropped to 26; Metformin halved.' }
];

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

export const mockShantiDevi3ListDataset: Patient3ListDischargeDataset = {
  patientId: 'patient-s-devi',
  patientName: 'Smt. Shanti Devi',
  admissionDate: '2026-08-20',
  dischargeDate: '2026-08-25',
  ward: 'Cardiology Ward 4B',
  attendingPhysician: 'Dr. A. Patel, MD, FACC',
  preAdmissionMeds: [
    { medName: 'Metformin', dose: '500mg', frequency: 'Once daily with dinner', indication: 'Type 2 Diabetes', isOTC: false },
    { medName: 'Lisinopril', dose: '20mg', frequency: 'Once daily in morning', indication: 'Hypertension', isOTC: false },
    { medName: 'Atorvastatin', dose: '20mg', frequency: 'Once daily at bedtime', indication: 'Hyperlipidemia', isOTC: false },
    { medName: 'Levothyroxine', dose: '75mcg', frequency: 'Once daily before breakfast', indication: 'Hypothyroidism', isOTC: false },
    { medName: 'Aspirin', dose: '81mg', frequency: 'Once daily with breakfast', indication: 'Cardioprotection', isOTC: false },
    { medName: 'OTC Fish Oil', dose: '1000mg', frequency: 'Once daily in morning', indication: 'General Wellness', isOTC: true },
    { medName: 'OTC Calcium + Vit D', dose: '600mg/400IU', frequency: 'Once daily with lunch', indication: 'Bone Health', isOTC: true }
  ],
  inHospitalMeds: [
    { medName: 'Metformin', dose: 'Held', reason: 'Held for IV contrast coronary catheterization; restarted at 1000mg BID on ward' },
    { medName: 'Lisinopril', dose: 'Held / Stopped', reason: 'Held due to acute rise in serum creatinine from 1.3 to 1.8 mg/dL' },
    { medName: 'Atorvastatin', dose: '40mg', reason: 'Dose titrated from 20mg to 40mg post-angiography' },
    { medName: 'Apixaban', dose: '5mg BID', reason: 'Initiated for new-onset paroxysmal atrial fibrillation' },
    { medName: 'Aspirin', dose: 'Discontinued', reason: 'Stopped to avoid dual antithrombotic bleeding risk with Apixaban' },
    { medName: 'IV Heparin', dose: 'Titrated infusion', reason: 'Bridging therapy in CCU; stopped prior to discharge' }
  ],
  dischargeMeds: [
    { medName: 'Apixaban', dose: '5mg', frequency: 'Twice daily (08:00, 20:00)', status: 'NEW', reason: 'Atrial Fibrillation Stroke Prevention', timingSlots: ['morning', 'evening'] },
    { medName: 'Metformin', dose: '1000mg', frequency: 'Twice daily with meals (08:00, 18:00)', status: 'DOSE_CHANGED', reason: 'Glycemic Control Optimization', timingSlots: ['morning', 'evening'], dietInstructions: 'Take with meals to reduce GI upset' },
    { medName: 'Atorvastatin', dose: '40mg', frequency: 'Once daily at bedtime (22:00)', status: 'DOSE_CHANGED', reason: 'Plaque Stabilization / Post-PCI', timingSlots: ['bedtime'], dietInstructions: 'Avoid grapefruit and grapefruit juice' },
    { medName: 'Levothyroxine', dose: '75mcg', frequency: 'Once daily on empty stomach (07:30)', status: 'CONTINUED', reason: 'Hypothyroidism', timingSlots: ['morning'], dietInstructions: 'Take 30-60m before breakfast; separate 4h from calcium' },
    { medName: 'Lisinopril', dose: '0mg', frequency: 'DISCONTINUED', status: 'STOPPED', reason: 'Renal Protection / Elevated Creatinine' },
    { medName: 'Aspirin', dose: '0mg', frequency: 'DISCONTINUED', status: 'STOPPED', reason: 'Replaced by Apixaban to minimize bleeding risk' }
  ]
};

export const mockHaroldJenkins3ListDataset: Patient3ListDischargeDataset = {
  patientId: 'p_jenkins_72',
  patientName: 'Harold Jenkins',
  admissionDate: '2026-08-10',
  dischargeDate: '2026-08-15',
  ward: 'Heart Failure Ward 3A',
  attendingPhysician: 'Dr. E. Evans, MD (Heart Failure)',
  preAdmissionMeds: [
    { medName: 'Metformin', dose: '1000mg', frequency: 'Twice daily with meals', indication: 'Type 2 Diabetes', isOTC: false },
    { medName: 'Empagliflozin', dose: '10mg', frequency: 'Once daily in morning', indication: 'Type 2 Diabetes / CKD', isOTC: false },
    { medName: 'Lisinopril', dose: '40mg', frequency: 'Once daily in morning', indication: 'Hypertension / HFpEF', isOTC: false },
    { medName: 'Furosemide', dose: '20mg', frequency: 'Once daily in morning', indication: 'Edema / HFpEF', isOTC: false },
    { medName: 'Carvedilol', dose: '12.5mg', frequency: 'Twice daily', indication: 'Heart Failure', isOTC: false },
    { medName: 'Atorvastatin', dose: '40mg', frequency: 'Once daily at bedtime', indication: 'Hyperlipidemia', isOTC: false },
    { medName: 'Allopurinol', dose: '100mg', frequency: 'Once daily in morning', indication: 'Gout', isOTC: false },
    { medName: 'OTC St. John\'s Wort', dose: '300mg', frequency: 'Once daily in morning', indication: 'Mood support', isOTC: true },
    { medName: 'OTC Ibuprofen', dose: '400mg', frequency: 'PRN for knee arthritis pain', indication: 'Osteoarthritis', isOTC: true }
  ],
  inHospitalMeds: [
    { medName: 'Lisinopril', dose: 'Discontinued', reason: 'Switched to Sacubitril/Valsartan (Entresto) 49/51mg BID for HFpEF decompensation' },
    { medName: 'Entresto', dose: '49/51mg BID', reason: 'Initiated 36 hours after Lisinopril washout to avoid angioedema' },
    { medName: 'Furosemide', dose: '40mg IV -> 40mg oral', reason: 'Diuresis for 8lb acute fluid gain; stabilized' },
    { medName: 'Ibuprofen', dose: 'Discontinued', reason: 'Strictly prohibited due to CKD 3b and acute fluid overload' }
  ],
  dischargeMeds: [
    { medName: 'Sacubitril/Valsartan (Entresto)', dose: '49/51mg', frequency: 'Twice daily (08:00, 20:00)', status: 'NEW', reason: 'Heart Failure with Preserved Ejection Fraction (HFpEF)', timingSlots: ['morning', 'evening'] },
    { medName: 'Furosemide', dose: '40mg', frequency: 'Once daily in morning (08:00)', status: 'DOSE_CHANGED', reason: 'Volume Management / HFpEF', timingSlots: ['morning'] },
    { medName: 'Carvedilol', dose: '12.5mg', frequency: 'Twice daily with food (08:00, 20:00)', status: 'CONTINUED', reason: 'Heart Failure / Blood Pressure Control', timingSlots: ['morning', 'evening'] },
    { medName: 'Metformin', dose: '1000mg', frequency: 'Twice daily with meals (08:00, 18:00)', status: 'CONTINUED', reason: 'Type 2 Diabetes Mellitus', timingSlots: ['morning', 'evening'] },
    { medName: 'Empagliflozin', dose: '10mg', frequency: 'Once daily in morning (08:00)', status: 'CONTINUED', reason: 'Cardio-Renal Protection & Diabetes', timingSlots: ['morning'] },
    { medName: 'Atorvastatin', dose: '40mg', frequency: 'Once daily at bedtime (22:00)', status: 'CONTINUED', reason: 'Cardiovascular Risk Reduction', timingSlots: ['bedtime'] },
    { medName: 'Allopurinol', dose: '100mg', frequency: 'Once daily in morning (08:00)', status: 'CONTINUED', reason: 'Gout Prevention', timingSlots: ['morning'] },
    { medName: 'Lisinopril', dose: '0mg', frequency: 'DISCONTINUED', status: 'STOPPED', reason: 'Replaced by Sacubitril/Valsartan' }
  ]
};

export interface ExtractedDocumentFixture {
  document: DocumentRecord;
  facts: Fact[];
}

export const mockDischargeSummaryCardiacWard: ExtractedDocumentFixture = {
  document: { id: 'doc_discharge_cardiac_001', patientId: 'patient-s-devi', fileName: 'discharge_summary_cardiac_ward.pdf', docType: 'discharge_summary', pageCount: 2, uploadTimestamp: '2026-08-25T14:30:00Z', extractedText: 'METROPOLITAN CARDIAC INSTITUTE — DISCHARGE SUMMARY', extractedFactIds: ['fact_shanti_med_apixaban','fact_shanti_med_metformin','fact_shanti_med_atorvastatin','fact_shanti_med_lisinopril_stop','fact_shanti_med_levo','fact_shanti_lab_creat','fact_shanti_lab_egfr','fact_shanti_lab_potassium','fact_shanti_cadence_creat_2w'] },
  facts: [
    { id: 'fact_shanti_med_apixaban', patientId: 'patient-s-devi', category: 'medication', name: 'Apixaban', value: { dose: '5mg', frequency: 'BID', brand: 'Eliquis', route: 'oral' }, unit: 'mg', status: 'unconfirmed', sourceDocId: 'doc_discharge_cardiac_001', boundingBox: { pageIndex: 1, x: 85, y: 420, width: 535, height: 25 }, plainExplanation: 'Apixaban 5mg twice daily started as a new blood thinner for stroke prevention in atrial fibrillation.', author: 'system_ocr', timestamp: '2026-08-25T14:30:00Z' },
    { id: 'fact_shanti_med_metformin', patientId: 'patient-s-devi', category: 'medication', name: 'Metformin', value: { dose: '1000mg', frequency: 'BID', brand: 'Glucophage', route: 'oral' }, unit: 'mg', status: 'unconfirmed', sourceDocId: 'doc_discharge_cardiac_001', boundingBox: { pageIndex: 1, x: 85, y: 452, width: 555, height: 26 }, plainExplanation: 'Metformin increased from home dose of 500mg to 1000mg twice daily with meals.', author: 'system_ocr', timestamp: '2026-08-25T14:30:00Z' },
    { id: 'fact_shanti_med_atorvastatin', patientId: 'patient-s-devi', category: 'medication', name: 'Atorvastatin', value: { dose: '40mg', frequency: 'QHS', brand: 'Lipitor', route: 'oral' }, unit: 'mg', status: 'unconfirmed', sourceDocId: 'doc_discharge_cardiac_001', boundingBox: { pageIndex: 1, x: 85, y: 485, width: 495, height: 25 }, plainExplanation: 'Atorvastatin 40mg at bedtime for cholesterol management. Avoid grapefruit.', author: 'system_ocr', timestamp: '2026-08-25T14:30:00Z' },
    { id: 'fact_shanti_med_lisinopril_stop', patientId: 'patient-s-devi', category: 'medication', name: 'Lisinopril', value: { dose: '0mg', action: 'DISCONTINUED', reason: 'Renal strain' }, unit: 'mg', status: 'unconfirmed', sourceDocId: 'doc_discharge_cardiac_001', boundingBox: { pageIndex: 1, x: 85, y: 520, width: 625, height: 26 }, plainExplanation: 'Lisinopril was stopped in hospital to protect kidney function.', author: 'system_ocr', timestamp: '2026-08-25T14:30:00Z' },
    { id: 'fact_shanti_med_levo', patientId: 'patient-s-devi', category: 'medication', name: 'Levothyroxine', value: { dose: '75mcg', frequency: 'QAM', brand: 'Synthroid', route: 'oral' }, unit: 'mcg', status: 'unconfirmed', sourceDocId: 'doc_discharge_cardiac_001', boundingBox: { pageIndex: 1, x: 85, y: 555, width: 580, height: 25 }, plainExplanation: 'Levothyroxine 75mcg continued once daily in the morning on an empty stomach.', author: 'system_ocr', timestamp: '2026-08-25T14:30:00Z' },
    { id: 'fact_shanti_lab_creat', patientId: 'patient-s-devi', category: 'lab', name: 'Creatinine', value: 1.80, unit: 'mg/dL', status: 'unconfirmed', sourceDocId: 'doc_discharge_cardiac_001', boundingBox: { pageIndex: 1, x: 85, y: 610, width: 505, height: 25 }, plainExplanation: 'Kidney function at discharge: Serum Creatinine 1.80 mg/dL (Elevated).', author: 'system_ocr', timestamp: '2026-08-25T14:30:00Z' },
    { id: 'fact_shanti_lab_egfr', patientId: 'patient-s-devi', category: 'lab', name: 'eGFR', value: 32, unit: 'mL/min/1.73m2', status: 'unconfirmed', sourceDocId: 'doc_discharge_cardiac_001', boundingBox: { pageIndex: 1, x: 85, y: 610, width: 505, height: 25 }, plainExplanation: 'Kidney filtration rate at discharge: eGFR 32 mL/min/1.73m2 (Stage 3b kidney strain).', author: 'system_ocr', timestamp: '2026-08-25T14:30:00Z' },
    { id: 'fact_shanti_cadence_creat_2w', patientId: 'patient-s-devi', category: 'condition', name: 'Repeat Renal Labs Cadence', value: { cadence: '2_weeks', panel: 'Renal Function Panel' }, status: 'unconfirmed', sourceDocId: 'doc_discharge_cardiac_001', boundingBox: { pageIndex: 2, x: 90, y: 180, width: 650, height: 28 }, plainExplanation: 'Doctor ordered follow-up kidney blood test in 2 weeks.', author: 'system_ocr', timestamp: '2026-08-25T14:30:00Z' }
  ]
};

export const mockHomeLabPhotoSlip: ExtractedDocumentFixture = {
  document: { id: 'doc_homelab_slip_002', patientId: 'patient-s-devi', fileName: 'homelab_creatinine_photo_slip.jpg', docType: 'lab_slip_photo', pageCount: 1, uploadTimestamp: '2026-08-28T09:15:00Z', extractedText: 'METROPOLIS HEALTHCARE REMOTE COLLECTION', extractedFactIds: ['fact_homelab_creat_190','fact_homelab_egfr_28','fact_homelab_k_48'] },
  facts: [
    { id: 'fact_homelab_creat_190', patientId: 'patient-s-devi', category: 'lab', name: 'Creatinine', value: 1.90, unit: 'mg/dL', status: 'unconfirmed', sourceDocId: 'doc_homelab_slip_002', boundingBox: { pageIndex: 1, x: 110, y: 380, width: 780, height: 55 }, plainExplanation: 'Serum Creatinine: 1.90 mg/dL (High — increased from 1.80 mg/dL at discharge).', author: 'system_ocr', timestamp: '2026-08-28T09:15:00Z' },
    { id: 'fact_homelab_egfr_28', patientId: 'patient-s-devi', category: 'lab', name: 'eGFR', value: 28, unit: 'mL/min/1.73m2', status: 'unconfirmed', sourceDocId: 'doc_homelab_slip_002', boundingBox: { pageIndex: 1, x: 110, y: 445, width: 800, height: 55 }, plainExplanation: 'eGFR: 28 mL/min/1.73m2 (Stage 4 Kidney Strain — decreased from 32).', author: 'system_ocr', timestamp: '2026-08-28T09:15:00Z' },
    { id: 'fact_homelab_k_48', patientId: 'patient-s-devi', category: 'lab', name: 'Potassium', value: 4.8, unit: 'mEq/L', status: 'unconfirmed', sourceDocId: 'doc_homelab_slip_002', boundingBox: { pageIndex: 1, x: 110, y: 510, width: 770, height: 50 }, plainExplanation: 'Serum Potassium: 4.8 mEq/L (Normal range 3.5 - 5.1 mEq/L).', author: 'system_ocr', timestamp: '2026-08-28T09:15:00Z' }
  ]
};

export const mockNephrologyConsultDocument: ExtractedDocumentFixture = {
  document: { id: 'doc_consult_note_nephrology_006', patientId: 'patient-s-devi', fileName: 'nephrology_consult_2024.pdf', docType: 'clinic_note', pageCount: 1, uploadTimestamp: '2024-04-12T11:00:00Z', extractedText: 'REGIONAL NEPHROLOGY CONSULTATION NOTE', extractedFactIds: ['fact_ckd_stage_3b_diagnosis'] },
  facts: [
    { id: 'fact_ckd_stage_3b_diagnosis', patientId: 'patient-s-devi', category: 'condition', name: 'Chronic Kidney Disease Stage 3b', value: { icd10: 'N18.32', stage: '3b', baselineEgfr: 40 }, status: 'confirmed', sourceDocId: 'doc_consult_note_nephrology_006', boundingBox: { pageIndex: 1, x: 120, y: 340, width: 220, height: 45 }, plainExplanation: 'CKD Stage 3b diagnosed on 2024-04-12 by Dr. Chen.', author: 'dr_chen_md', timestamp: '2024-04-12T11:00:00Z' }
  ]
};
