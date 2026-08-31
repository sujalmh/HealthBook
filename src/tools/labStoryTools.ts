/**
 * CareCanvas WebMCP Tools: LabStory Longitudinal Biomarker Causal Engine — AI Intelligence (M1)
 * Tools: extract_labs, correlate_meds
 * AI panel extraction via generic AI when enabled, preserving BIOMARKER_STANDARDS normalization.
 * Fallback regex only when disabled (Q10).
 * Never hardcoded provider literals — reads via config.
 */

import type { WebMCPToolDefinition, WebMCPExecutionContext, WebMCPToolResult } from '../types/webmcp.ts';
import type { LabRecord } from '../types/vault.ts';
import type { LongitudinalLabDataPoint } from '../fixtures/longitudinal_labs.ts';
import { convertToLabRecords } from '../fixtures/longitudinal_labs.ts';
import { extractWithAI } from '../core/ai/client.ts';
import { getAIConfig, isAIEnabled, getAIEndpoint, getAIModel } from '../core/ai/config.ts';
import { buildChatMessages, buildResponsesInput } from '../core/ai/vision.ts';
import { buildStructuredParams, parseJsonContent, extractTextFromProviderResponse } from '../core/ai/structured.ts';

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

function isVisionImage(value?: string): boolean {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('data:');
}

// Helper: fallback regex extraction (preserved for when AI disabled)
function fallbackRegexExtract(text: string, patientId: string, documentId: string): LabRecord[] {
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
        parsed.push(normalizeLabBiomarker(p.marker, val, p.unit, new Date().toISOString(), patientId, documentId));
      }
    }
  }
  return parsed;
}

async function aiExtractLabsViaClient(rawText: string, imageDataUrl: string | undefined, patientId: string, documentId: string): Promise<LabRecord[]> {
  const docType = 'lab_report';
  try {
    const aiFacts = await extractWithAI(rawText || '', imageDataUrl, docType, { patientId, documentId });
    // Filter for lab-relevant facts and convert via BIOMARKER_STANDARDS normalization (preserving standards)
    const labFacts = aiFacts.filter((f) => {
      const cat = (f.category || '').toLowerCase();
      const nameLower = (f.name || '').toLowerCase();
      if (cat === 'lab') return true;
      // also include known biomarker names even if mis-categorized
      return ['creatinine','egfr','gfr','potassium','hba1c','a1c','glucose','hemoglobin','cholesterol','ldl','hdl','triglyceride'].some(k => nameLower.includes(k));
    });
    if (labFacts.length === 0) return [];
    const labRecords: LabRecord[] = labFacts.map((f) => {
      // Derive numeric value robustly
      let rawVal: number = 0;
      if (typeof f.value === 'number' && Number.isFinite(f.value)) rawVal = f.value;
      else if (f.value && typeof f.value === 'object' && typeof (f.value as any).numericValue === 'number' && Number.isFinite((f.value as any).numericValue)) rawVal = (f.value as any).numericValue;
      else if (f.value && typeof f.value === 'object' && typeof (f.value as any).value === 'number' && Number.isFinite((f.value as any).value)) rawVal = (f.value as any).value;
      else {
        const str = typeof f.value === 'string' ? f.value : JSON.stringify(f.value ?? '');
        const m = str.match(/([0-9]+\.?[0-9]*)/);
        rawVal = m ? Number(m[1]) : 0;
      }
      if (!Number.isFinite(rawVal)) rawVal = 0;
      const unit = f.unit || '';
      const drawDate = (f as any).drawDate || f.timestamp || new Date().toISOString();
      const rec = normalizeLabBiomarker(f.name, rawVal, unit, drawDate, patientId, documentId);
      // Preserve grounded bbox if provided by AI (normalized 0-1000)
      if (f.boundingBox) rec.boundingBox = f.boundingBox as any;
      // Preserve confidence if present
      if ((f as any).confidence) (rec as any).confidence = (f as any).confidence;
      return rec;
    });
    return labRecords;
  } catch (err) {
    console.warn('[labStoryTools] AI lab extraction failed', (err as any)?.message || err);
    throw err;
  }
}

// AI causal narrative for correlate_meds via generic configurable provider (vision+text not needed, text only)
async function aiCorrelateNarrative(
  biomarker: string,
  filteredLabs: LabRecord[],
  correlatedMeds: string[],
  startVal: number,
  endVal: number,
  delta: number,
  percentChange: number
): Promise<{ trajectory: string; narrative: string; doctorQuestion: string; correlated: string[] } | null> {
  const config = getAIConfig();
  if (!isAIEnabled(config)) return null;
  const endpoint = getAIEndpoint(config);
  const model = getAIModel(config, false);
  if (!endpoint || !model) return null;
  try {
    const labsSummary = filteredLabs.slice(0, 8).map(l => `${l.marker}: ${l.normalizedValue} ${l.normalizedUnit} on ${l.drawDate} flag:${l.flag}`).join('; ');
    const medsSummary = correlatedMeds.join(', ') || 'none';
    const systemPrompt = `You are a clinical causal biomarker assistant. Given longitudinal lab data and medications, generate a concise causal narrative. Return ONLY valid JSON with shape {"trajectory": string, "causalStorySentence": string, "recommendedDoctorQuestion": string, "correlatedMedications": string[], "confidenceScore": number}. Trajectory should be one of declining_renal_function, improving_renal_function, elevated_creatinine, elevated_glucose, potassium_shift, lipid_reduction, stable etc. Causal story should reference direction and medication correlation plainly. No markdown.`;
    const userText = `Biomarker: ${biomarker}\nStart: ${startVal} End: ${endVal} Delta: ${delta} Percent: ${percentChange}% Points: ${filteredLabs.length}\nLabs: ${labsSummary}\nMedications: ${medsSummary}\nGenerate JSON only.`;
    const structuredSchema = {
      type: 'object',
      properties: {
        trajectory: { type: 'string' },
        causalStorySentence: { type: 'string' },
        recommendedDoctorQuestion: { type: 'string' },
        correlatedMedications: { type: 'array', items: { type: 'string' } },
        confidenceScore: { type: 'number' }
      },
      required: ['trajectory', 'causalStorySentence', 'recommendedDoctorQuestion'],
      additionalProperties: false,
    } as any;
    const useStructured = config.structuredOutputs;
    const structuredParams = buildStructuredParams(config.provider, useStructured, structuredSchema);
    let body: any;
    if (config.provider === 'responses') {
      const input = buildResponsesInput(systemPrompt, userText);
      body = { model, input, temperature: config.temperature, max_output_tokens: config.maxTokens, ...structuredParams };
    } else {
      const messages = buildChatMessages(systemPrompt, userText);
      body = { model, messages, temperature: config.temperature, max_tokens: config.maxTokens, ...structuredParams };
    }
    const AbortCtor: typeof AbortController =
      typeof globalThis !== 'undefined' && (globalThis as any).AbortController ? (globalThis as any).AbortController : AbortController;
    const controller = new AbortCtor();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs || 30000);
    let fetchSignal: AbortSignal | undefined = controller.signal;
    try {
      const isTestEnvSignal =
        typeof process !== 'undefined' && ((process as any).env?.VITEST === 'true' || (process as any).env?.NODE_ENV === 'test') ||
        typeof (globalThis as any).__vitest_worker__ !== 'undefined';
      const GlobalAbortSignal = typeof globalThis !== 'undefined' ? (globalThis as any).AbortSignal : undefined;
      const WindowAbortSignal = typeof window !== 'undefined' ? (window as any).AbortSignal : undefined;
      const validGlobal = GlobalAbortSignal ? fetchSignal instanceof GlobalAbortSignal : true;
      const validWindow = WindowAbortSignal ? fetchSignal instanceof WindowAbortSignal : true;
      if (isTestEnvSignal) fetchSignal = undefined;
      else if (!validGlobal && !validWindow) fetchSignal = undefined;
    } catch {}
    let response: Response;
    try {
      const headers: Record<string,string> = { 'Content-Type': 'application/json' };
      if (config.apiKey && config.apiKey.trim() !== '') headers.Authorization = `Bearer ${config.apiKey}`;
      const fetchOpts: RequestInit = { method: 'POST', headers, body: JSON.stringify(body) };
      if (fetchSignal) (fetchOpts as any).signal = fetchSignal;
      response = await fetch(endpoint, fetchOpts);
    } finally {
      clearTimeout(timeoutId);
    }
    if (!response.ok) {
      const t = await response.text().catch(() => '');
      throw new Error(`AI correlate failed ${response.status} ${t.slice(0, 300)}`);
    }
    const json = await response.json().catch(() => null);
    if (!json) return null;
    const textContent = extractTextFromProviderResponse(json, config.provider);
    if (!textContent) {
      if (json.trajectory && json.causalStorySentence) {
        return { trajectory: json.trajectory, narrative: json.causalStorySentence, doctorQuestion: json.recommendedDoctorQuestion, correlated: json.correlatedMedications || correlatedMeds };
      }
      return null;
    }
    const parsed = parseJsonContent(textContent);
    if (!parsed) return null;
    const data = parsed.trajectory ? parsed : parsed;
    if (data.trajectory && data.causalStorySentence) {
      return {
        trajectory: data.trajectory,
        narrative: data.causalStorySentence,
        doctorQuestion: data.recommendedDoctorQuestion || `Why has my ${biomarker} shifted and should we adjust my medications?`,
        correlated: Array.isArray(data.correlatedMedications) ? data.correlatedMedications : correlatedMeds,
      };
    }
    return null;
  } catch (err) {
    console.warn('[labStoryTools] AI correlate narrative failed, falling back to heuristic', (err as any)?.message || err);
    return null;
  }
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
    params: { documentId: string; patientId?: string; rawLabData?: any[]; rawText?: string; imageBlob?: string; imageDataUrl?: string },
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

    // Detect imageDataUrl for vision+text single request if provided (e.g., lab slip photo)
    const candidateImage = (params as any).imageDataUrl || (params as any).imageBlob || (params as any).image_blob;
    const imageDataUrl = typeof candidateImage === 'string' && isVisionImage(candidateImage) ? candidateImage : undefined;
    const hasImage = !!imageDataUrl;

    // Case 1: Custom raw lab data provided — normalize and store for real patient (M3 NaN guard)
    if (params.rawLabData && Array.isArray(params.rawLabData) && params.rawLabData.length > 0) {
      const filtered = params.rawLabData.filter((item) => {
        return item.marker || item.name; // keep structural check; numeric guard below
      });
      labRecords = filtered
        .map((item) => {
          const rawNum = Number(item.value ?? item.numericValue);
          const safeVal = Number.isFinite(rawNum) ? rawNum : 0;
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
    } else if ((params.rawText && params.rawText.trim().length > 0) || hasImage) {
      // Case 2: AI panel extraction when enabled, preserving BIOMARKER_STANDARDS normalization; fallback regex only when disabled
      const text = (params.rawText || '').trim();
      const config = getAIConfig();
      const aiEnabled = isAIEnabled(config);
      if (aiEnabled) {
        try {
          // Single multimodal request where applicable: rawText + imageDataUrl together
          const aiLabs = await aiExtractLabsViaClient(text, imageDataUrl, patientId, params.documentId);
          if (aiLabs.length > 0) {
            labRecords = aiLabs;
          } else {
            // AI returned empty — for image per Q10 return empty not heuristic placeholder, for text fallback to regex
            if (hasImage) {
              labRecords = [];
            } else {
              labRecords = fallbackRegexExtract(text, patientId, params.documentId);
            }
          }
        } catch {
          // AI failed — fallback regex only for text never for images per Q10
          if (hasImage) {
            labRecords = [];
          } else {
            labRecords = fallbackRegexExtract(text, patientId, params.documentId);
          }
        }
      } else {
        // AI disabled — fallback regex only for text never for images
        if (hasImage) {
          // image OCR must be via AI, return empty when disabled
          labRecords = [];
        } else {
          labRecords = fallbackRegexExtract(text, patientId, params.documentId);
        }
      }
      if (labRecords.length === 0 && !text && !hasImage) {
        labRecords = [];
      }
    } else {
      // No rawLabData and no rawText — return empty (no mock seeding). Vault remains source.
      labRecords = [];
    }

    // If no records parsed and no raw data, return informative result without mock insertion
    if (labRecords.length === 0) {
      // Distinguish image case for Q10 messaging
      if (hasImage && isAIEnabled(getAIConfig()) === false) {
        return {
          success: true,
          tool: 'extract_labs',
          timestamp: new Date().toISOString(),
          data: [],
          plainLanguageSummary: 'Vision extraction requested but AI disabled — no heuristic for images per Q10. Enable AI to process images.',
          humanApprovalRequired: false
        };
      }
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

    // Derive correlatedMeds from vault medications for this patient (real data)
    let correlatedMeds: string[] = [];
    try {
      const meds = context.vault.getMedications(patientId) || [];
      correlatedMeds = meds.slice(0, 3).map((m: any) => m.genericName || m.name || 'Medication');
    } catch {
      correlatedMeds = [];
    }

    // Try AI causal narrative when enabled, preserving BIOMARKER_STANDARDS metrics but using AI for story
    let aiNarrative: { trajectory: string; narrative: string; doctorQuestion: string; correlated: string[] } | null = null;
    if (isAIEnabled(getAIConfig())) {
      aiNarrative = await aiCorrelateNarrative(biomarker, filteredLabs, correlatedMeds, startVal, endVal, delta, percentChange);
    }

    if (aiNarrative) {
      const resultDataAI = {
        biomarker,
        trajectory: aiNarrative.trajectory,
        correlatedMedications: aiNarrative.correlated,
        causalStorySentence: aiNarrative.narrative,
        recommendedDoctorQuestion: aiNarrative.doctorQuestion,
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
        confidenceScore: 0.92
      };
      return {
        success: true,
        tool: 'correlate_meds',
        timestamp: new Date().toISOString(),
        data: resultDataAI,
        plainLanguageSummary: aiNarrative.narrative,
        humanApprovalRequired: false
      };
    }

    // Fallback heuristic template (preserved for when AI disabled per Q10)
    const bLower = biomarker.toLowerCase();
    let narrative = '';
    let trajectory = 'stable';
    let doctorQuestion = '';

    if (filteredLabs.length >= 2) {
      const direction = delta > 0 ? 'increased' : delta < 0 ? 'decreased' : 'remained stable';
      const changeDesc = delta !== 0 ? ` from ${startVal} to ${endVal} (${delta > 0 ? '+' : ''}${delta}, ${percentChange}%)` : ' with no net change';
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
    } else {
      narrative = `Biomarker "${biomarker}" demonstrated steady longitudinal trajectory with no sharp drug-induced anomalies detected.`;
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
