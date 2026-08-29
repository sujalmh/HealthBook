/**
 * CareCanvas Fixtures: 5-Year Longitudinal Lab Histories (2022-2026)
 */

import type {  LabRecord  } from '../types/vault.ts';

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
  {
    date: '2022-03-15T08:30:00Z',
    creatinine: 1.10,
    egfr: 58,
    hba1c: 6.8,
    glucose_fasting: 118,
    potassium: 4.2,
    cholesterol_total: 215,
    ldl: 138,
    hdl: 44,
    triglycerides: 165,
    clinical_context: 'Annual routine physical exam; baseline mild CKD stage 3a.'
  },
  {
    date: '2023-01-20T09:00:00Z',
    creatinine: 1.25,
    egfr: 50,
    hba1c: 7.4,
    glucose_fasting: 134,
    potassium: 4.4,
    cholesterol_total: 198,
    ldl: 120,
    hdl: 45,
    triglycerides: 155,
    clinical_context: 'Metformin initiated 500mg daily.'
  },
  {
    date: '2023-11-10T10:15:00Z',
    creatinine: 1.30,
    egfr: 48,
    hba1c: 7.9,
    glucose_fasting: 145,
    potassium: 4.5,
    cholesterol_total: 205,
    ldl: 125,
    hdl: 43,
    triglycerides: 170,
    clinical_context: 'Prednisone 20mg burst prescribed for severe osteoarthritis flare (Glucose spike).'
  },
  {
    date: '2024-08-14T08:45:00Z',
    creatinine: 1.45,
    egfr: 42,
    hba1c: 7.2,
    glucose_fasting: 122,
    potassium: 4.6,
    cholesterol_total: 175,
    ldl: 95,
    hdl: 46,
    triglycerides: 140,
    clinical_context: 'Atorvastatin titrated to 40mg; lipid improvements noted.'
  },
  {
    date: '2025-06-02T09:30:00Z',
    creatinine: 1.60,
    egfr: 37,
    hba1c: 7.6,
    glucose_fasting: 130,
    potassium: 4.7,
    cholesterol_total: 170,
    ldl: 90,
    hdl: 47,
    triglycerides: 135,
    clinical_context: 'Routine nephrology follow-up; CKD Stage 3b confirmed.'
  },
  {
    date: '2026-08-25T11:00:00Z',
    creatinine: 1.80,
    egfr: 32,
    hba1c: 7.8,
    glucose_fasting: 142,
    potassium: 4.9,
    cholesterol_total: 168,
    ldl: 88,
    hdl: 48,
    triglycerides: 130,
    clinical_context: 'Hospital discharge post-cardiac admission.'
  },
  {
    date: '2026-08-28T09:15:00Z',
    creatinine: 1.90,
    egfr: 28,
    hba1c: 7.8,
    glucose_fasting: 140,
    potassium: 4.8,
    cholesterol_total: 165,
    ldl: 86,
    hdl: 48,
    triglycerides: 128,
    clinical_context: 'HomeLab remote slip upload; triggers Metformin dose reduction from 1000mg to 500mg.'
  }
];

export const mockHaroldJenkinsLongitudinalLabs: LongitudinalLabDataPoint[] = [
  {
    date: '2022-04-10T08:00:00Z',
    creatinine: 1.40,
    egfr: 45,
    hba1c: 8.4,
    glucose_fasting: 160,
    potassium: 4.3,
    cholesterol_total: 220,
    ldl: 140,
    hdl: 40,
    triglycerides: 190,
    clinical_context: 'Initial diagnosis of CKD Stage 3a and T2D.'
  },
  {
    date: '2023-05-18T09:00:00Z',
    creatinine: 1.55,
    egfr: 40,
    hba1c: 8.0,
    glucose_fasting: 148,
    potassium: 4.6,
    cholesterol_total: 195,
    ldl: 118,
    hdl: 42,
    triglycerides: 175,
    clinical_context: 'Empagliflozin added; HbA1c down to 8.0%.'
  },
  {
    date: '2024-03-12T10:00:00Z',
    creatinine: 2.05,
    egfr: 28,
    hba1c: 8.1,
    glucose_fasting: 152,
    potassium: 5.1,
    cholesterol_total: 185,
    ldl: 110,
    hdl: 42,
    triglycerides: 165,
    clinical_context: 'Acute eGFR decline to 28 during Ketorolac (NSAID) course for gout flare.'
  },
  {
    date: '2025-02-14T09:30:00Z',
    creatinine: 1.75,
    egfr: 34,
    hba1c: 8.2,
    glucose_fasting: 155,
    potassium: 4.8,
    cholesterol_total: 178,
    ldl: 102,
    hdl: 43,
    triglycerides: 160,
    clinical_context: 'Partial kidney recovery post NSAID cessation; baseline CKD 3b stabilized.'
  },
  {
    date: '2026-08-15T08:30:00Z',
    creatinine: 1.80,
    egfr: 33,
    hba1c: 8.2,
    glucose_fasting: 150,
    potassium: 4.9,
    cholesterol_total: 172,
    ldl: 96,
    hdl: 44,
    triglycerides: 155,
    clinical_context: 'Hospital discharge post HFpEF exacerbation.'
  },
  {
    date: '2026-08-29T10:00:00Z',
    creatinine: 2.10,
    egfr: 26,
    hba1c: 8.2,
    glucose_fasting: 150,
    potassium: 5.2,
    cholesterol_total: 170,
    ldl: 95,
    hdl: 44,
    triglycerides: 150,
    clinical_context: 'Day 14 remote HomeLab upload; eGFR dropped to 26; Metformin halved.'
  }
];

export function convertToLabRecords(patientId: string, dataPoints: LongitudinalLabDataPoint[]): LabRecord[] {
  const records: LabRecord[] = [];
  dataPoints.forEach((pt, idx) => {
    // Creatinine
    records.push({
      id: `lab_${patientId}_creat_${idx}`,
      patientId,
      marker: 'Creatinine',
      value: pt.creatinine,
      unit: 'mg/dL',
      normalizedValue: pt.creatinine,
      normalizedUnit: 'mg/dL',
      drawDate: pt.date,
      referenceRange: { low: 0.6, high: 1.2 },
      optimalRange: { low: 0.7, high: 1.0 },
      isBorderline: pt.creatinine >= 1.2 && pt.creatinine <= 1.35,
      isCritical: pt.creatinine >= 3.0,
      flag: pt.creatinine > 1.2 ? (pt.creatinine >= 3.0 ? 'CRITICAL_HIGH' : 'HIGH') : 'NORMAL'
    });

    // eGFR
    records.push({
      id: `lab_${patientId}_egfr_${idx}`,
      patientId,
      marker: 'eGFR',
      value: pt.egfr,
      unit: 'mL/min/1.73m2',
      normalizedValue: pt.egfr,
      normalizedUnit: 'mL/min/1.73m2',
      drawDate: pt.date,
      referenceRange: { low: 60, high: 120 },
      optimalRange: { low: 90, high: 120 },
      isBorderline: pt.egfr >= 55 && pt.egfr < 60,
      isCritical: pt.egfr < 15,
      flag: pt.egfr < 60 ? (pt.egfr < 15 ? 'CRITICAL_LOW' : 'LOW') : 'NORMAL'
    });

    // HbA1c
    records.push({
      id: `lab_${patientId}_hba1c_${idx}`,
      patientId,
      marker: 'HbA1c',
      value: pt.hba1c,
      unit: '%',
      normalizedValue: pt.hba1c,
      normalizedUnit: '%',
      drawDate: pt.date,
      referenceRange: { low: 4.0, high: 5.6 },
      optimalRange: { low: 4.5, high: 5.4 },
      isBorderline: pt.hba1c >= 5.7 && pt.hba1c <= 6.4,
      isCritical: pt.hba1c >= 10.0,
      flag: pt.hba1c > 5.6 ? 'HIGH' : 'NORMAL'
    });

    // Glucose Fasting
    records.push({
      id: `lab_${patientId}_glucose_${idx}`,
      patientId,
      marker: 'Glucose Fasting',
      value: pt.glucose_fasting,
      unit: 'mg/dL',
      normalizedValue: pt.glucose_fasting,
      normalizedUnit: 'mg/dL',
      drawDate: pt.date,
      referenceRange: { low: 70, high: 99 },
      optimalRange: { low: 75, high: 90 },
      isBorderline: pt.glucose_fasting >= 100 && pt.glucose_fasting <= 125,
      isCritical: pt.glucose_fasting >= 250 || pt.glucose_fasting <= 50,
      flag: pt.glucose_fasting > 99 ? 'HIGH' : 'NORMAL'
    });

    // Potassium
    records.push({
      id: `lab_${patientId}_potassium_${idx}`,
      patientId,
      marker: 'Potassium',
      value: pt.potassium,
      unit: 'mEq/L',
      normalizedValue: pt.potassium,
      normalizedUnit: 'mEq/L',
      drawDate: pt.date,
      referenceRange: { low: 3.5, high: 5.0 },
      optimalRange: { low: 3.8, high: 4.6 },
      isBorderline: pt.potassium > 5.0 && pt.potassium <= 5.3,
      isCritical: pt.potassium >= 6.0 || pt.potassium <= 2.8,
      flag: pt.potassium > 5.0 ? 'HIGH' : (pt.potassium < 3.5 ? 'LOW' : 'NORMAL')
    });
  });

  return records;
}
