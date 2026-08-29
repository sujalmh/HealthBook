/**
 * CareCanvas Fixtures: Longitudinal Lab Helpers — CLEAN (M1 Mock Removal)
 * Mock datasets removed; real data comes from vault for context.patientId.
 * Keeps convertToLabRecords helper for real-data transforms.
 */

import type { LabRecord } from '../types/vault.ts';

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

// Mock longitudinal datasets removed — M1.
// Tools must read from context.vault for real patient labs; no mock fallback.
// Test-only legacy bridge:
export * from '../../test/fixtures/legacyMocks.ts';
export const __fixtureClean_longitudinal_labs = true;

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
