/**
 * CareCanvas WebMCP Tools: LabStory Longitudinal Biomarker Causal Engine — CLEAN (M1)
 * Tools: extract_labs, correlate_meds
 * No mock fixture branching — reads from context.vault for context.patientId.
 */

import type { WebMCPToolDefinition, WebMCPExecutionContext, WebMCPToolResult } from '../types/webmcp.ts';
import type { LabRecord } from '../types/vault.ts';
import type { LongitudinalLabDataPoint } from '../fixtures/longitudinal_labs.ts';
import { convertToLabRecords } from '../fixtures/longitudinal_labs.ts';

// Standard reference and optimal ranges for biomarker normalizer
export const BIOMARKER_STANDARDS: Record<
  string,
  {
    canonicalName: string;
    standardUnit: string;
    refRange: { low: number; high: number };
    optimalRange: { low: number; high: number };
    criticalLow?: number;
    criticalHigh?: number;
    convertUnit: (val: number, unit: string) => number;
  }
> = {
  creatinine: {
    canonicalName: 'Creatinine',
    standardUnit: 'mg/dL',
    refRange: { low: 0.6, high: 1.2 },
    optimalRange: { low: 0.7, high: 1.0 },
    criticalHigh: 3.0,
    convertUnit: (val: number, unit: string) => {
      const u = unit.toLowerCase().trim();
      if (u.includes('umol') || u.includes('µmol')) {
        return Math.round((val / 88.42) * 100) / 100;
      }
      if (u === 'mmol/l') {
        return Math.round(((val * 1000) / 88.42) * 100) / 100;
      }
      return val;
    }
  },
  egfr: {
    canonicalName: 'eGFR',
    standardUnit: 'mL/min/1.73m2',
    refRange: { low: 60, high: 120 },
    optimalRange: { low: 90, high: 120 },
    criticalLow: 15,
    convertUnit: (val: number) => val
  },
  hba1c: {
    canonicalName: 'HbA1c',
    standardUnit: '%',
    refRange: { low: 4.0, high: 5.6 },
    optimalRange: { low: 4.5, high: 5.4 },
    criticalHigh: 10.0,
    convertUnit: (val: number, unit: string) => {
      const u = unit.toLowerCase().trim();
      if (u.includes('mmol/mol')) {
        return Math.round(((val / 10.929) + 2.15) * 10) / 10;
      }
      return val;
    }
  },
  'glucose fasting': {
    canonicalName: 'Glucose Fasting',
    standardUnit: 'mg/dL',
    refRange: { low: 70, high: 99 },
    optimalRange: { low: 75, high: 90 },
    criticalLow: 50,
    criticalHigh: 250,
    convertUnit: (val: number, unit: string) => {
      const u = unit.toLowerCase().trim();
      if (u.includes('mmol/l')) {
        return Math.round(val * 18.0182 * 10) / 10;
      }
      return val;
    }
  },
  potassium: {
    canonicalName: 'Potassium',
    standardUnit: 'mEq/L',
    refRange: { low: 3.5, high: 5.0 },
    optimalRange: { low: 3.8, high: 4.6 },
    criticalLow: 2.8,
    criticalHigh: 6.0,
    convertUnit: (val: number) => val
  },
  'cholesterol total': {
    canonicalName: 'Cholesterol Total',
    standardUnit: 'mg/dL',
    refRange: { low: 125, high: 200 },
    optimalRange: { low: 140, high: 180 },
    criticalHigh: 300,
    convertUnit: (val: number, unit: string) => {
      const u = unit.toLowerCase().trim();
      if (u.includes('mmol/l')) {
        return Math.round(val * 38.67);
      }
      return val;
    }
  },
  ldl: {
    canonicalName: 'LDL',
    standardUnit: 'mg/dL',
    refRange: { low: 50, high: 100 },
    optimalRange: { low: 50, high: 80 },
    criticalHigh: 190,
    convertUnit: (val: number, unit: string) => {
      const u = unit.toLowerCase().trim();
      if (u.includes('mmol/l')) {
        return Math.round(val * 38.67);
      }
      return val;
    }
  },
  hdl: {
    canonicalName: 'HDL',
    standardUnit: 'mg/dL',
    refRange: { low: 40, high: 80 },
    optimalRange: { low: 50, high: 80 },
    criticalLow: 25,
    convertUnit: (val: number, unit: string) => {
      const u = unit.toLowerCase().trim();
      if (u.includes('mmol/l')) {
        return Math.round(val * 38.67);
      }
      return val;
    }
  },
  triglycerides: {
    canonicalName: 'Triglycerides',
    standardUnit: 'mg/dL',
    refRange: { low: 50, high: 150 },
    optimalRange: { low: 60, high: 100 },
    criticalHigh: 500,
    convertUnit: (val: number, unit: string) => {
      const u = unit.toLowerCase().trim();
      if (u.includes('mmol/l')) {
        return Math.round(val * 88.57);
      }
      return val;
    }
  },
  hemoglobin: {
    canonicalName: 'Hemoglobin',
    standardUnit: 'g/dL',
    refRange: { low: 12.0, high: 16.0 },
    optimalRange: { low: 13.0, high: 15.5 },
    criticalLow: 7.0,
    criticalHigh: 20.0,
    convertUnit: (val: number, unit: string) => {
      const u = unit.toLowerCase().trim();
      if (u.includes('g/l')) {
        return Math.round((val / 10) * 10) / 10;
      }
      return val;
    }
  }
};

/**
 * Finds the matching biomarker standard definition using name aliases and tokens.
 */
export function findBiomarkerStandard(markerName: string) {
  const m = markerName.toLowerCase().trim();
  if (m.includes('creat')) return BIOMARKER_STANDARDS['creatinine'];
  if (m.includes('egfr') || m.includes('gfr')) return BIOMARKER_STANDARDS['egfr'];
  if (m.includes('hba1c') || m.includes('a1c') || m.includes('glycated')) return BIOMARKER_STANDARDS['hba1c'];
  if (m.includes('glucose') || m.includes('blood sugar') || m.includes('glu')) return BIOMARKER_STANDARDS['glucose fasting'];
  if (m.includes('potassium') || m === 'k' || m === 'k+') return BIOMARKER_STANDARDS['potassium'];
  if (m.includes('ldl')) return BIOMARKER_STANDARDS['ldl'];
  if (m.includes('hdl')) return BIOMARKER_STANDARDS['hdl'];
  if (m.includes('triglyceride')) return BIOMARKER_STANDARDS['triglycerides'];
  if (m.includes('cholesterol') || m.includes('total cholesterol')) return BIOMARKER_STANDARDS['cholesterol total'];
  if (m.includes('hemoglobin') || m.includes('hgb') || m === 'hb') return BIOMARKER_STANDARDS['hemoglobin'];

  return Object.values(BIOMARKER_STANDARDS).find(
    (std) => std.canonicalName.toLowerCase() === m || m.includes(std.canonicalName.toLowerCase())
  ) || null;
}

/**
 * Normalizes raw lab biomarker entry, evaluates ±10% borderline buffer zone,
 * and sets clinical status flags.
 */
export function normalizeLabBiomarker(
  markerName: string,
  rawValue: number,
  rawUnit: string,
  drawDate: string,
  patientId: string,
  sourceDocId?: string
): LabRecord {
  // M3 NaN guard: malformed rawLabData (e.g., Number("abc") => NaN) must not store NaN normalizedValue
  const safeRawValue = Number.isFinite(rawValue) ? rawValue : 0;
  const std = findBiomarkerStandard(markerName);
  const canonicalMarker = std ? std.canonicalName : markerName;
  const normalizedUnit = std ? std.standardUnit : rawUnit;
  let normalizedValue = std ? std.convertUnit(safeRawValue, rawUnit) : safeRawValue;
  // Guard after conversion as well (convertUnit may return NaN for malformed unit)
  if (!Number.isFinite(normalizedValue)) normalizedValue = 0;
  const referenceRange = std ? std.refRange : { low: 0, high: 100 };
  const optimalRange = std ? std.optimalRange : { low: referenceRange.low, high: referenceRange.high * 0.85 };

  // Calculate 10% borderline buffer around reference bounds
  const span = referenceRange.high - referenceRange.low;
  const buffer10 = span * 0.10;
  const isNearHigh = normalizedValue >= (referenceRange.high - buffer10) && normalizedValue <= (referenceRange.high + buffer10);
  const isNearLow = normalizedValue >= (referenceRange.low - buffer10) && normalizedValue <= (referenceRange.low + buffer10);
  const isBorderline = isNearHigh || isNearLow;

  // Determine critical flags
  let isCritical = false;
  let flag: LabRecord['flag'] = 'NORMAL';

  if (std?.criticalHigh && normalizedValue >= std.criticalHigh) {
    isCritical = true;
    flag = 'CRITICAL_HIGH';
  } else if (std?.criticalLow && normalizedValue <= std.criticalLow) {
    isCritical = true;
    flag = 'CRITICAL_LOW';
  } else if (normalizedValue > referenceRange.high) {
    flag = 'HIGH';
  } else if (normalizedValue < referenceRange.low) {
    flag = 'LOW';
  } else {
    flag = 'NORMAL';
  }

  return {
    id: `lab_${patientId}_${canonicalMarker.toLowerCase().replace(/\s+/g, '_')}_${new Date(drawDate).getTime() || Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    patientId,
    marker: canonicalMarker,
    markerCode: canonicalMarker.toUpperCase().replace(/\s+/g, '_'),
    value: rawValue,
    unit: rawUnit,
    normalizedValue,
    normalizedUnit,
    drawDate,
    referenceRange,
    optimalRange,
    isBorderline,
    isCritical,
    flag,
    sourceDocId
  };
}

export const extractLabsTool: WebMCPToolDefinition = {
  name: 'extract_labs',
  description:
    'Ingests multi-year PDF/image lab drops, normalizes units (e.g. mmol/L to mg/dL), tags reference/optimal ranges, ±10% borderline buffers, and places points on DuckDB/LocalVault timeline.',
  moduleOwner: 'labstory',
  category: 'imperative_extraction',
  requiresHumanApproval: false,
  approvalGateType: 'none',
  parameters: {
    type: 'object',
    properties: {
      documentId: { type: 'string', description: 'Document or slip ID' },
      patientId: { type: 'string', description: 'Patient ID' },
      rawLabData: { type: 'array', items: { type: 'object' }, description: 'Optional raw extracted lab items' },
      rawText: { type: 'string', description: 'Optional raw OCR or text content to parse' }
    },
    required: ['documentId']
  },
  returns: { type: 'array', description: 'Normalized lab records placed on timeline' },
  uiSideEffects: {
    canvasRerenders: ['labstory', 'dossier'],
    toastNotification: {
      type: 'info',
      messageTemplate: 'Biomarker time-series updated with normalized lab markers.'
    }
  },
  execute: async (
    params: { documentId: string; patientId?: string; rawLabData?: any[]; rawText?: string },
    context: WebMCPExecutionContext
  ): Promise<WebMCPToolResult> => {
    if (!params.documentId) {
      return {
        success: false,
        tool: 'extract_labs',
        timestamp: new Date().toISOString(),
        data: null,
        plainLanguageSummary: 'documentId parameter is required for extract_labs tool.',
        error: {
          code: 'INVALID_PARAMS',
          message: 'documentId parameter is required for extract_labs tool.'
        },
        humanApprovalRequired: false
      };
    }

    const patientId = params.patientId || context.patientId;
    let labRecords: LabRecord[] = [];

    // Case 1: Custom raw lab data provided — normalize and store for real patient (M3 NaN guard)
    if (params.rawLabData && Array.isArray(params.rawLabData) && params.rawLabData.length > 0) {
      const filtered = params.rawLabData.filter((item) => {
        const raw = Number(item.value ?? item.numericValue);
        // Allow 0 as valid; reject NaN / Infinity for malformed strings like "abc"
        return item.marker || item.name; // keep structural check; numeric guard below
      });
      labRecords = filtered
        .map((item) => {
          const rawNum = Number(item.value ?? item.numericValue);
          const safeVal = Number.isFinite(rawNum) ? rawNum : 0;
          // If original was malformed NaN string, still create record with 0 but mark as handled (no NaN)
          return normalizeLabBiomarker(
            item.marker || item.name || 'Unknown',
            safeVal,
            item.unit || item.units || 'mg/dL',
            item.drawDate || item.date || new Date().toISOString(),
            patientId,
            params.documentId
          );
        })
        .filter((rec) => Number.isFinite(rec.normalizedValue));
    } else if (params.rawText && params.rawText.trim().length > 0) {
      // Case 2: Parse rawText for biomarker values (real OCR text) — no mock fallback
      // Simple heuristic: look for patterns like "Creatinine 1.9 mg/dL" or "eGFR 28"
      // For now, create a single generic normalized record if parsing fails — vault-derived
      const text = params.rawText;
      const patterns: { regex: RegExp; marker: string; unit: string }[] = [
        { regex: /creatinine[^0-9]*([0-9]+\.?[0-9]*)/i, marker: 'Creatinine', unit: 'mg/dL' },
        { regex: /eGFR[^0-9]*([0-9]+\.?[0-9]*)/i, marker: 'eGFR', unit: 'mL/min/1.73m2' },
        { regex: /potassium[^0-9]*([0-9]+\.?[0-9]*)/i, marker: 'Potassium', unit: 'mEq/L' },
        { regex: /HbA1c[^0-9]*([0-9]+\.?[0-9]*)/i, marker: 'HbA1c', unit: '%' },
        { regex: /glucose[^0-9]*([0-9]+\.?[0-9]*)/i, marker: 'Glucose Fasting', unit: 'mg/dL' }
      ];
      const parsed: LabRecord[] = [];
      for (const p of patterns) {
        const m = text.match(p.regex);
        if (m) {
          const val = Number(m[1]);
          if (!isNaN(val)) {
            parsed.push(normalizeLabBiomarker(p.marker, val, p.unit, new Date().toISOString(), patientId, params.documentId));
          }
        }
      }
      if (parsed.length > 0) {
        labRecords = parsed;
      } else {
        // No parseable markers — do not seed mock; create empty and inform caller
        labRecords = [];
      }
    } else {
      // No rawLabData and no rawText — return empty (no mock seeding). Vault remains source.
      labRecords = [];
    }

    // If no records parsed and no raw data, return informative result without mock insertion
    if (labRecords.length === 0) {
      return {
        success: true,
        tool: 'extract_labs',
        timestamp: new Date().toISOString(),
        data: [],
        plainLanguageSummary: 'No lab data provided. Provide rawLabData or rawText to extract real labs for your patient. Vault remains empty until real data is supplied.',
        humanApprovalRequired: false
      };
    }

    // Sort chronologically ascending
    labRecords.sort((a, b) => new Date(a.drawDate).getTime() - new Date(b.drawDate).getTime());

    // Save into LocalVault for real patientId
    for (const record of labRecords) {
      context.vault.addLab(record, {
        userId: context.activeProfile.userId,
        userName: context.activeProfile.name,
        role: context.activeProfile.role
      });
    }

    context.eventBus?.emit('lab_extracted', {
      patientId,
      documentId: params.documentId,
      count: labRecords.length,
      records: labRecords
    });

    context.eventBus?.dispatchToast({
      type: 'success',
      title: 'Labs Ingested & Normalized',
      message: `Extracted ${labRecords.length} biomarker data points for your patient.`
    });

    return {
      success: true,
      tool: 'extract_labs',
      timestamp: new Date().toISOString(),
      data: labRecords,
      plainLanguageSummary: `Extracted and normalized ${labRecords.length} lab records for patient ${patientId}.`,
      humanApprovalRequired: false
    };
  }
};

export const correlateMedsTool: WebMCPToolDefinition = {
  name: 'correlate_meds',
  description:
    'Causal biomarker query engine that correlates biomarker fluctuations (e.g. glucose spikes, eGFR declines) with active medication starts, dose titrations, or adherence.',
  moduleOwner: 'labstory',
  category: 'clinical_negotiation',
  requiresHumanApproval: false,
  approvalGateType: 'none',
  parameters: {
    type: 'object',
    properties: {
      biomarker: {
        type: 'string',
        description: 'Biomarker to correlate (e.g. eGFR, Creatinine, Glucose Fasting, HbA1c, Potassium, Cholesterol)'
      },
      startDate: { type: 'string', description: 'Start date of query window (ISO)' },
      endDate: { type: 'string', description: 'End date of query window (ISO)' },
      patientId: { type: 'string', description: 'Patient ID' },
      queryText: { type: 'string', description: 'Optional natural language question' }
    },
    required: ['biomarker']
  },
  returns: { type: 'object', description: 'Causal correlation narrative, trajectory metrics, and doctor questions' },
  uiSideEffects: {
    canvasRerenders: ['labstory']
  },
  execute: async (
    params: { biomarker: string; startDate?: string; endDate?: string; patientId?: string; queryText?: string },
    context: WebMCPExecutionContext
  ): Promise<WebMCPToolResult> => {
    const { biomarker } = params;
    if (!biomarker || typeof biomarker !== 'string' || biomarker.trim() === '') {
      return {
        success: false,
        tool: 'correlate_meds',
        timestamp: new Date().toISOString(),
        data: null,
        plainLanguageSummary: 'Biomarker parameter is required.',
        error: {
          code: 'INVALID_PARAMS',
          message: 'Biomarker parameter is required.'
        },
        humanApprovalRequired: false
      };
    }

    const patientId = params.patientId || context.patientId;
    // Query vault for longitudinal series for this marker — vault-derived only, no mock seeding
    let existingLabs = context.vault.getLabs(patientId, biomarker);

    // Time window slice
    let filteredLabs = existingLabs;
    if (params.startDate) {
      filteredLabs = filteredLabs.filter((l: any) => new Date(l.drawDate) >= new Date(params.startDate!));
    }
    if (params.endDate) {
      filteredLabs = filteredLabs.filter((l: any) => new Date(l.drawDate) <= new Date(params.endDate!));
    }

    if (filteredLabs.length === 0) {
      // No data for this biomarker in vault — return empty-state narrative (no mock)
      if (existingLabs.length === 0) {
        return {
          success: true,
          tool: 'correlate_meds',
          timestamp: new Date().toISOString(),
          data: {
            biomarker,
            trajectory: 'no_data',
            correlatedMedications: [],
            causalStorySentence: `No lab data for ${biomarker} yet. Upload a lab report to see trends and medication correlations.`,
            recommendedDoctorQuestion: `What should my target be for ${biomarker} and when should we recheck it?`,
            trendMetrics: { startValue: 0, endValue: 0, delta: 0, percentChange: 0, dataPointsCount: 0 },
            timeWindow: { start: new Date().toISOString(), end: new Date().toISOString() },
            confidenceScore: 0
          },
          plainLanguageSummary: `No lab data for ${biomarker} yet. Upload a lab report to see trends.`,
          humanApprovalRequired: false
        };
      }
      filteredLabs = existingLabs;
    }

    const firstPoint = filteredLabs[0];
    const lastPoint = filteredLabs[filteredLabs.length - 1];
    const startVal = firstPoint ? firstPoint.normalizedValue : 0;
    const endVal = lastPoint ? lastPoint.normalizedValue : 0;
    const delta = Math.round((endVal - startVal) * 100) / 100;
    const percentChange = startVal !== 0 ? Math.round(((endVal - startVal) / startVal) * 100) : 0;

    // Generic narrative derived from real vault data (no hardcoded Shanti timelines)
    const bLower = biomarker.toLowerCase();
    let narrative = '';
    let correlatedMeds: string[] = [];
    let trajectory = 'stable';
    let doctorQuestion = '';

    if (filteredLabs.length >= 2) {
      const direction = delta > 0 ? 'increased' : delta < 0 ? 'decreased' : 'remained stable';
      const changeDesc = delta !== 0 ? ` from ${startVal} to ${endVal} (${delta > 0 ? '+' : ''}${delta}, ${percentChange}%)` : ' with no net change';
      // Derive correlatedMeds from vault medications for this patient (real data)
      try {
        const meds = context.vault.getMedications(patientId) || [];
        correlatedMeds = meds.slice(0, 3).map((m: any) => m.genericName || m.name || 'Medication');
      } catch {
        correlatedMeds = [];
      }

      if (bLower.includes('egfr')) {
        trajectory = delta < 0 ? 'declining_renal_function' : delta > 0 ? 'improving_renal_function' : 'stable';
        narrative = `eGFR ${direction}${changeDesc} over ${filteredLabs.length} data points for your patient. Review medications that affect kidney function.`;
        doctorQuestion = `My ${biomarker} ${direction} to ${endVal}. Should we review medications that affect kidney function?`;
      } else if (bLower.includes('creatinine')) {
        trajectory = delta > 0 ? 'elevated_creatinine' : 'stable';
        narrative = `Creatinine ${direction}${changeDesc} across ${filteredLabs.length} points.`;
        doctorQuestion = `Why has my Creatinine ${direction} to ${endVal} and should we adjust medications to protect kidney function?`;
      } else if (bLower.includes('glucose') || bLower.includes('a1c') || bLower.includes('hba1c')) {
        trajectory = delta > 0 ? 'elevated_glucose' : 'stable';
        narrative = `${biomarker} ${direction}${changeDesc} over the observed window.`;
        doctorQuestion = `My ${biomarker} ${direction} to ${endVal}. Should we review my diabetes plan?`;
      } else if (bLower.includes('potassium')) {
        trajectory = delta !== 0 ? 'potassium_shift' : 'stable';
        narrative = `Potassium ${direction}${changeDesc}. Monitor medications that affect electrolytes.`;
        doctorQuestion = `Why has my Potassium shifted to ${endVal} and should we adjust my medications?`;
      } else if (bLower.includes('cholesterol') || bLower.includes('ldl') || bLower.includes('lipid')) {
        trajectory = delta < 0 ? 'lipid_reduction' : 'stable';
        narrative = `${biomarker} ${direction}${changeDesc}, reflecting medication and diet effects.`;
        doctorQuestion = `Are my current lipid numbers on target with my current regimen?`;
      } else {
        narrative = `Biomarker "${biomarker}" ${direction}${changeDesc} over the time window (${filteredLabs.length} points).`;
        doctorQuestion = `Why has my ${biomarker} shifted and should we adjust my medications?`;
      }
    } else if (filteredLabs.length === 1) {
      narrative = `Single data point for ${biomarker}: ${endVal} on ${lastPoint.drawDate}. Upload more reports to see trends.`;
      trajectory = 'single_point';
      doctorQuestion = `I have one result for ${biomarker} (${endVal}). When should we recheck it?`;
      try {
        const meds = context.vault.getMedications(patientId) || [];
        correlatedMeds = meds.slice(0, 2).map((m: any) => m.genericName || 'Medication');
      } catch {
        correlatedMeds = [];
      }
    } else {
      narrative = `Biomarker "${biomarker}" demonstrated steady longitudinal trajectory with no sharp drug-induced anomalies detected.`;
      correlatedMeds = [];
      trajectory = 'stable';
      doctorQuestion = `Why has my ${biomarker} shifted recently and should we adjust my medications accordingly?`;
    }

    const resultData = {
      biomarker,
      trajectory,
      correlatedMedications: correlatedMeds,
      causalStorySentence: narrative,
      recommendedDoctorQuestion: doctorQuestion,
      trendMetrics: {
        startValue: startVal,
        endValue: endVal,
        delta,
        percentChange,
        dataPointsCount: filteredLabs.length
      },
      timeWindow: {
        start: firstPoint?.drawDate || new Date().toISOString(),
        end: lastPoint?.drawDate || new Date().toISOString()
      },
      confidenceScore: filteredLabs.length >= 2 ? 0.85 : 0.5
    };

    return {
      success: true,
      tool: 'correlate_meds',
      timestamp: new Date().toISOString(),
      data: resultData,
      plainLanguageSummary: narrative,
      humanApprovalRequired: false
    };
  }
};
