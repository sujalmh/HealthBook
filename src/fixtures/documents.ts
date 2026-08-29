/**
 * CareCanvas Fixtures: Realistic Mock Documents & Image Slips with Bounding Boxes
 */

import type {  DocumentRecord, Fact  } from '../types/vault.ts';

export interface ExtractedDocumentFixture {
  document: DocumentRecord;
  facts: Fact[];
}

export const mockDischargeSummaryCardiacWard: ExtractedDocumentFixture = {
  document: {
    id: 'doc_discharge_cardiac_001',
    patientId: 'patient-s-devi',
    fileName: 'discharge_summary_cardiac_ward.pdf',
    docType: 'discharge_summary',
    pageCount: 2,
    uploadTimestamp: '2026-08-25T14:30:00Z',
    extractedText: `
      METROPOLITAN CARDIAC INSTITUTE — DISCHARGE SUMMARY
      Patient: Smt. Shanti Devi | MRN: MRN-984210 | Age: 78 | Sex: F
      Admission Date: 2026-08-20 | Discharge Date: 2026-08-25
      Attending Physician: Dr. A. Patel, MD, FACC (Cardiology)

      DISCHARGE MEDICATIONS:
      1. Apixaban (Eliquis) 5 mg oral tablet, 1 tablet twice daily (08:00, 20:00)
         Indication: Non-valvular Atrial Fibrillation stroke prevention.
      2. Metformin 1000 mg oral tablet, 1 tablet twice daily with meals (08:00, 18:00)
         Indication: Type 2 Diabetes Mellitus (Dose increased from home 500mg).
      3. Atorvastatin 40 mg oral tablet, 1 tablet at bedtime (22:00)
         Indication: Hyperlipidemia / Post-PCI. Avoid grapefruit and grapefruit juice.
      4. Lisinopril 20 mg oral tablet — DISCONTINUED. Hold due to acute renal strain.
      5. Levothyroxine 75 mcg oral tablet, 1 tab once daily in morning on empty stomach (07:30).

      DISCHARGE LABS & VITALS:
      - BP: 128/78 mmHg | HR: 72 bpm (Normal Sinus Rhythm post-cardioversion)
      - Serum Creatinine: 1.80 mg/dL | eGFR: 32 mL/min/1.73m2 (CKD Stage 3b strain)
      - Serum Potassium: 4.9 mEq/L

      DISCHARGE ORDERS & FOLLOW-UP:
      - Repeat Serum Creatinine and Electrolytes in 2 weeks with local HomeLab.
      - Follow-up cardiology clinic visit in 4 weeks.
    `,
    extractedFactIds: [
      'fact_shanti_med_apixaban',
      'fact_shanti_med_metformin',
      'fact_shanti_med_atorvastatin',
      'fact_shanti_med_lisinopril_stop',
      'fact_shanti_med_levo',
      'fact_shanti_lab_creat',
      'fact_shanti_lab_egfr',
      'fact_shanti_lab_potassium',
      'fact_shanti_cadence_creat_2w'
    ]
  },
  facts: [
    {
      id: 'fact_shanti_med_apixaban',
      patientId: 'patient-s-devi',
      category: 'medication',
      name: 'Apixaban',
      value: { dose: '5mg', frequency: 'BID', brand: 'Eliquis', route: 'oral' },
      unit: 'mg',
      status: 'unconfirmed',
      sourceDocId: 'doc_discharge_cardiac_001',
      boundingBox: { pageIndex: 1, x: 85, y: 420, width: 535, height: 25 },
      plainExplanation: 'Apixaban 5mg twice daily started as a new blood thinner for stroke prevention in atrial fibrillation.',
      author: 'system_ocr',
      timestamp: '2026-08-25T14:30:00Z'
    },
    {
      id: 'fact_shanti_med_metformin',
      patientId: 'patient-s-devi',
      category: 'medication',
      name: 'Metformin',
      value: { dose: '1000mg', frequency: 'BID', brand: 'Glucophage', route: 'oral' },
      unit: 'mg',
      status: 'unconfirmed',
      sourceDocId: 'doc_discharge_cardiac_001',
      boundingBox: { pageIndex: 1, x: 85, y: 452, width: 555, height: 26 },
      plainExplanation: 'Metformin increased from home dose of 500mg to 1000mg twice daily with meals.',
      author: 'system_ocr',
      timestamp: '2026-08-25T14:30:00Z'
    },
    {
      id: 'fact_shanti_med_atorvastatin',
      patientId: 'patient-s-devi',
      category: 'medication',
      name: 'Atorvastatin',
      value: { dose: '40mg', frequency: 'QHS', brand: 'Lipitor', route: 'oral' },
      unit: 'mg',
      status: 'unconfirmed',
      sourceDocId: 'doc_discharge_cardiac_001',
      boundingBox: { pageIndex: 1, x: 85, y: 485, width: 495, height: 25 },
      plainExplanation: 'Atorvastatin 40mg at bedtime for cholesterol management. Avoid grapefruit.',
      author: 'system_ocr',
      timestamp: '2026-08-25T14:30:00Z'
    },
    {
      id: 'fact_shanti_med_lisinopril_stop',
      patientId: 'patient-s-devi',
      category: 'medication',
      name: 'Lisinopril',
      value: { dose: '0mg', action: 'DISCONTINUED', reason: 'Renal strain' },
      unit: 'mg',
      status: 'unconfirmed',
      sourceDocId: 'doc_discharge_cardiac_001',
      boundingBox: { pageIndex: 1, x: 85, y: 520, width: 625, height: 26 },
      plainExplanation: 'Lisinopril was stopped in hospital to protect kidney function.',
      author: 'system_ocr',
      timestamp: '2026-08-25T14:30:00Z'
    },
    {
      id: 'fact_shanti_med_levo',
      patientId: 'patient-s-devi',
      category: 'medication',
      name: 'Levothyroxine',
      value: { dose: '75mcg', frequency: 'QAM', brand: 'Synthroid', route: 'oral' },
      unit: 'mcg',
      status: 'unconfirmed',
      sourceDocId: 'doc_discharge_cardiac_001',
      boundingBox: { pageIndex: 1, x: 85, y: 555, width: 580, height: 25 },
      plainExplanation: 'Levothyroxine 75mcg continued once daily in the morning on an empty stomach.',
      author: 'system_ocr',
      timestamp: '2026-08-25T14:30:00Z'
    },
    {
      id: 'fact_shanti_lab_creat',
      patientId: 'patient-s-devi',
      category: 'lab',
      name: 'Creatinine',
      value: 1.80,
      unit: 'mg/dL',
      status: 'unconfirmed',
      sourceDocId: 'doc_discharge_cardiac_001',
      boundingBox: { pageIndex: 1, x: 85, y: 610, width: 505, height: 25 },
      plainExplanation: 'Kidney function at discharge: Serum Creatinine 1.80 mg/dL (Elevated).',
      author: 'system_ocr',
      timestamp: '2026-08-25T14:30:00Z'
    },
    {
      id: 'fact_shanti_lab_egfr',
      patientId: 'patient-s-devi',
      category: 'lab',
      name: 'eGFR',
      value: 32,
      unit: 'mL/min/1.73m2',
      status: 'unconfirmed',
      sourceDocId: 'doc_discharge_cardiac_001',
      boundingBox: { pageIndex: 1, x: 85, y: 610, width: 505, height: 25 },
      plainExplanation: 'Kidney filtration rate at discharge: eGFR 32 mL/min/1.73m2 (Stage 3b kidney strain).',
      author: 'system_ocr',
      timestamp: '2026-08-25T14:30:00Z'
    },
    {
      id: 'fact_shanti_cadence_creat_2w',
      patientId: 'patient-s-devi',
      category: 'condition',
      name: 'Repeat Renal Labs Cadence',
      value: { cadence: '2_weeks', panel: 'Renal Function Panel' },
      status: 'unconfirmed',
      sourceDocId: 'doc_discharge_cardiac_001',
      boundingBox: { pageIndex: 2, x: 90, y: 180, width: 650, height: 28 },
      plainExplanation: 'Doctor ordered follow-up kidney blood test in 2 weeks.',
      author: 'system_ocr',
      timestamp: '2026-08-25T14:30:00Z'
    }
  ]
};

export const mockHomeLabPhotoSlip: ExtractedDocumentFixture = {
  document: {
    id: 'doc_homelab_slip_002',
    patientId: 'patient-s-devi',
    fileName: 'homelab_creatinine_photo_slip.jpg',
    docType: 'lab_slip_photo',
    pageCount: 1,
    uploadTimestamp: '2026-08-28T09:15:00Z',
    extractedText: `
      METROPOLIS HEALTHCARE REMOTE COLLECTION
      Specimen ID: MET-902381 | Patient: Smt. Shanti Devi | Draw: 2026-08-28 08:30
      
      SERUM CREATININE: 1.90 mg/dL (Ref: 0.60 - 1.20) [HIGH]
      eGFR (CKD-EPI 2021): 28 mL/min/1.73m2 (Ref: > 60) [CRITICAL LOW]
      SERUM POTASSIUM: 4.8 mEq/L (Ref: 3.5 - 5.1) [NORMAL]
      FASTING GLUCOSE: 140 mg/dL (Ref: 70 - 99) [HIGH]
    `,
    extractedFactIds: [
      'fact_homelab_creat_190',
      'fact_homelab_egfr_28',
      'fact_homelab_k_48'
    ]
  },
  facts: [
    {
      id: 'fact_homelab_creat_190',
      patientId: 'patient-s-devi',
      category: 'lab',
      name: 'Creatinine',
      value: 1.90,
      unit: 'mg/dL',
      status: 'unconfirmed',
      sourceDocId: 'doc_homelab_slip_002',
      boundingBox: { pageIndex: 1, x: 110, y: 380, width: 780, height: 55 },
      plainExplanation: 'Serum Creatinine: 1.90 mg/dL (High — increased from 1.80 mg/dL at discharge).',
      author: 'system_ocr',
      timestamp: '2026-08-28T09:15:00Z'
    },
    {
      id: 'fact_homelab_egfr_28',
      patientId: 'patient-s-devi',
      category: 'lab',
      name: 'eGFR',
      value: 28,
      unit: 'mL/min/1.73m2',
      status: 'unconfirmed',
      sourceDocId: 'doc_homelab_slip_002',
      boundingBox: { pageIndex: 1, x: 110, y: 445, width: 800, height: 55 },
      plainExplanation: 'eGFR: 28 mL/min/1.73m2 (Stage 4 Kidney Strain — decreased from 32).',
      author: 'system_ocr',
      timestamp: '2026-08-28T09:15:00Z'
    },
    {
      id: 'fact_homelab_k_48',
      patientId: 'patient-s-devi',
      category: 'lab',
      name: 'Potassium',
      value: 4.8,
      unit: 'mEq/L',
      status: 'unconfirmed',
      sourceDocId: 'doc_homelab_slip_002',
      boundingBox: { pageIndex: 1, x: 110, y: 510, width: 770, height: 50 },
      plainExplanation: 'Serum Potassium: 4.8 mEq/L (Normal range 3.5 - 5.1 mEq/L).',
      author: 'system_ocr',
      timestamp: '2026-08-28T09:15:00Z'
    }
  ]
};

export const mockNephrologyConsultDocument: ExtractedDocumentFixture = {
  document: {
    id: 'doc_consult_note_nephrology_006',
    patientId: 'patient-s-devi',
    fileName: 'nephrology_consult_2024.pdf',
    docType: 'clinic_note',
    pageCount: 1,
    uploadTimestamp: '2024-04-12T11:00:00Z',
    extractedText: `
      REGIONAL NEPHROLOGY CONSULTATION NOTE
      Patient: Smt. Shanti Devi | Date: 2024-04-12 | Clinician: Dr. Chen, MD
      
      DIAGNOSIS & ASSESSMENT:
      Chronic Kidney Disease Stage 3b (baseline eGFR 38-42 mL/min).
      Avoid all NSAIDs and maintain tight glycemic and blood pressure control.
    `,
    extractedFactIds: ['fact_ckd_stage_3b_diagnosis']
  },
  facts: [
    {
      id: 'fact_ckd_stage_3b_diagnosis',
      patientId: 'patient-s-devi',
      category: 'condition',
      name: 'Chronic Kidney Disease Stage 3b',
      value: { icd10: 'N18.32', stage: '3b', baselineEgfr: 40 },
      status: 'confirmed',
      sourceDocId: 'doc_consult_note_nephrology_006',
      boundingBox: { pageIndex: 1, x: 120, y: 340, width: 220, height: 45 },
      plainExplanation: 'CKD Stage 3b diagnosed on 2024-04-12 by Dr. Chen.',
      author: 'dr_chen_md',
      timestamp: '2024-04-12T11:00:00Z'
    }
  ]
};
