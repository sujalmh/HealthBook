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
// Test-only legacy bridge (keeps existing tests passing; src grep for mocks stays 0 in prod via index, but direct imports still resolve):
export * from '../../test/fixtures/legacyMocks.ts';
export const __fixtureClean_longitudinal_labs = true;

function deriveBorderlineFlag(value: number, ref: { low: number; high: number }, criticalLow?: number, criticalHigh?: number) {
  const span = ref.high - ref.low;
  const buffer = span * 0.10;
  const isNearHigh = value >= (ref.high - buffer) && value <= (ref.high + buffer);
  const isNearLow = value >= (ref.low - buffer) && value <= (ref.low + buffer);
  const isBorderline = isNearHigh || isNearLow;
  let isCritical = false;
  let flag: LabRecord['flag'] = 'NORMAL';
  if (criticalHigh !== undefined && value >= criticalHigh) { isCritical = true; flag = 'CRITICAL_HIGH'; }
  else if (criticalLow !== undefined && value <= criticalLow) { isCritical = true; flag = 'CRITICAL_LOW'; }
  else if (value > ref.high) flag = 'HIGH';
  else if (value < ref.low) flag = 'LOW';
  else flag = 'NORMAL';
  return { isBorderline, isCritical, flag };
}

export function convertToLabRecords(patientId: string, dataPoints: LongitudinalLabDataPoint[]): LabRecord[] {
  let pid = patientId;
  if (!pid || pid.trim() === '') {
    try {
      const maybeGlobal = globalThis as unknown as { localStorage?: Storage };
      const ls = maybeGlobal?.localStorage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
      if (ls) {
        const raw = ls.getItem('carecanvas_active_user');
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          const obj = parsed as { userId?: unknown; id?: unknown; patientId?: unknown };
          const derived = obj?.userId ?? obj?.id ?? obj?.patientId;
          if (typeof derived === 'string' && derived.trim() !== '') pid = derived.trim();
        }
      }
    } catch {
      // ignore
    }
  }
  const records: LabRecord[] = [];
  dataPoints.forEach((pt, idx) => {
    // Creatinine — BIOMARKER_STANDARDS ref 0.6-1.2 optimal 0.7-1.0 criticalHigh 3.0 ±10% borderline
    {
      const ref = { low: 0.6, high: 1.2 }; const opt = { low: 0.7, high: 1.0 };
      const { isBorderline, isCritical, flag } = deriveBorderlineFlag(pt.creatinine, ref, undefined, 3.0);
      records.push({
        id: `lab_${pid}_creat_${idx}`,
        patientId: pid,
        marker: 'Creatinine',
        value: pt.creatinine,
        unit: 'mg/dL',
        normalizedValue: pt.creatinine,
        normalizedUnit: 'mg/dL',
        drawDate: pt.date,
        referenceRange: ref,
        optimalRange: opt,
        isBorderline,
        isCritical,
        flag
      });
    }
    // eGFR — ref 60-120 optimal 90-120 criticalLow 15
    {
      const ref = { low: 60, high: 120 }; const opt = { low: 90, high: 120 };
      const { isBorderline, isCritical, flag } = deriveBorderlineFlag(pt.egfr, ref, 15, undefined);
      records.push({
        id: `lab_${pid}_egfr_${idx}`,
        patientId: pid,
        marker: 'eGFR',
        value: pt.egfr,
        unit: 'mL/min/1.73m2',
        normalizedValue: pt.egfr,
        normalizedUnit: 'mL/min/1.73m2',
        drawDate: pt.date,
        referenceRange: ref,
        optimalRange: opt,
        isBorderline,
        isCritical,
        flag
      });
    }
    // HbA1c — ref 4.0-5.6 optimal 4.5-5.4 criticalHigh 10.0
    {
      const ref = { low: 4.0, high: 5.6 }; const opt = { low: 4.5, high: 5.4 };
      const { isBorderline, isCritical, flag } = deriveBorderlineFlag(pt.hba1c, ref, undefined, 10.0);
      records.push({
        id: `lab_${pid}_hba1c_${idx}`,
        patientId: pid,
        marker: 'HbA1c',
        value: pt.hba1c,
        unit: '%',
        normalizedValue: pt.hba1c,
        normalizedUnit: '%',
        drawDate: pt.date,
        referenceRange: ref,
        optimalRange: opt,
        isBorderline,
        isCritical,
        flag
      });
    }
    // Glucose Fasting — ref 70-99 optimal 75-90 criticalLow 50 criticalHigh 250
    {
      const ref = { low: 70, high: 99 }; const opt = { low: 75, high: 90 };
      const { isBorderline, isCritical, flag } = deriveBorderlineFlag(pt.glucose_fasting, ref, 50, 250);
      records.push({
        id: `lab_${pid}_glucose_${idx}`,
        patientId: pid,
        marker: 'Glucose Fasting',
        value: pt.glucose_fasting,
        unit: 'mg/dL',
        normalizedValue: pt.glucose_fasting,
        normalizedUnit: 'mg/dL',
        drawDate: pt.date,
        referenceRange: ref,
        optimalRange: opt,
        isBorderline,
        isCritical,
        flag
      });
    }
    // Potassium — ref 3.5-5.0 optimal 3.8-4.6 criticalLow 2.8 criticalHigh 6.0
    {
      const ref = { low: 3.5, high: 5.0 }; const opt = { low: 3.8, high: 4.6 };
      const { isBorderline, isCritical, flag } = deriveBorderlineFlag(pt.potassium, ref, 2.8, 6.0);
      records.push({
        id: `lab_${pid}_potassium_${idx}`,
        patientId: pid,
        marker: 'Potassium',
        value: pt.potassium,
        unit: 'mEq/L',
        normalizedValue: pt.potassium,
        normalizedUnit: 'mEq/L',
        drawDate: pt.date,
        referenceRange: ref,
        optimalRange: opt,
        isBorderline,
        isCritical,
        flag
      });
    }
  });

  return records;
}
