
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
        const raw = ls.getItem('healthbook_active_user');
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          const obj = parsed as { userId?: unknown; id?: unknown; patientId?: unknown };
          const derived = obj?.userId ?? obj?.id ?? obj?.patientId;
          if (typeof derived === 'string' && derived.trim() !== '') pid = derived.trim();
        }
      }
    } catch {

    }
  }
  const records: LabRecord[] = [];
  dataPoints.forEach((pt, idx) => {

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

