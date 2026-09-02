/**
 * CareCanvas AI Core — Client
 * Unified HTTP client for OpenAI-compatible endpoints (/chat/completions & /responses).
 */

import type { Fact } from '../../types/vault.ts';
import type { AICallOptions } from './types.ts';
import { getAIConfig, isAIEnabled, getAIEndpoint, getAIModel, isResponsesProvider } from './config.ts';
import { buildChatMessages, buildResponsesInput, isDataUrl, isVisionSupportedImage } from './vision.ts';
import { runDocumentOCR } from './ocr.ts';
import {
  FACT_EXTRACTION_JSON_SCHEMA,
  buildStructuredParams,
  validateStructuredFacts,
  parseJsonContent,
  extractTextFromProviderResponse,
} from './structured.ts';

const PROMPT_MEDICATIONS = `You are a clinical pharmacologist. Extract ALL active and discharge medications from this document.
Extract each medication as an object with exactly these 6 fields:
- name: Medication generic/brand name (e.g. Lisinopril, Atorvastatin, Sacubitril/valsartan, Carvedilol, Furosemide)
- category: "medication"
- value: Exact dosage, route (PO/IV), frequency (BID, QD, twice daily, once nightly etc.), timing (morning, evening, bedtime, with dinner/lunch/breakfast), and food instructions (e.g. "10 mg tablet PO once daily", "24/26 mg PO twice daily", "3.125 mg PO twice daily with food", "500 mg PO once daily with dinner")
- unit: Dosage unit (e.g. mg, mcg, mL, IU, "mg" for tablets, "IU" for vitamins)
- date: "" (medications have no single date; empty string)
- confidence: 0.95
- plainExplanation: Concise plain-language summary of route, frequency, and instructions (e.g. "Take 10 mg by mouth once daily.", "Take 24/26 mg by mouth twice daily.")
Return strictly JSON matching {"facts": [...]} where each fact has name/category/value/unit/confidence/plainExplanation. If none found, return {"facts": []}.
Example: {"facts": [{"name":"Lisinopril","category":"medication","value":"10 mg tablet PO once daily","unit":"mg","confidence":0.95,"plainExplanation":"Take 10 mg by mouth once daily."}]}`;

const PROMPT_LABS = `You are a clinical pathologist. Extract ALL laboratory tests and numeric biomarker values from this document.
Extract each lab test as an object with exactly these 6 fields:
- name: Standard lab name (e.g. HbA1c, Serum Creatinine, Creatinine, NT-proBNP, Sodium, Potassium, ALT, AST, Hemoglobin, LDL cholesterol, TSH, eGFR, Fasting glucose, Total cholesterol, Triglycerides, WBC)
- category: "lab"
- value: Measured numeric value or chronological readings (e.g. "1.1 mg/dL" or "06-Aug: 13.4, 11-Aug: 13.2" or "13.8 g/dL" or "196 mg/dL"). For tables with multiple dates, include all dates in value as "06-Aug: 13.4, 09-Aug: 13.1, 11-Aug: 13.2". Extract EVERY row in any lab table — do not omit cholesterol, triglycerides, creatinine, eGFR, ALT, AST, TSH, hemoglobin, glucose, HbA1c, NT-proBNP, sodium, potassium, WBC etc.
- unit: Standard clinical unit (e.g. mg/dL, %, pg/mL, mmol/L, mEq/L, g/dL, U/L, mIU/L, x10^9/L)
- date: The most recent reading date resolved to a full calendar date YYYY-MM-DD using document dates (e.g. admission/discharge date gives the year for "22-Aug"). Empty string if no date is given.
- confidence: 0.95
- plainExplanation: Clear explanation of reading and normal/abnormal status with reference range context (e.g. "Fasting glucose 102 mg/dL is mildly high (normal 70-99).", "LDL 118 mg/dL is above optimal <100.")
IMPORTANT: Do NOT extract vital signs (blood pressure, heart rate, temperature, weight, BMI, SpO2, respiratory rate) — those are handled by the vital category. Only extract true laboratory biomarkers (blood tests).
Return strictly JSON matching {"facts": [...]} where each fact has name/category/value/unit/confidence/plainExplanation. If none found, return {"facts": []}.
Example: {"facts": [{"name":"Hemoglobin","category":"lab","value":"13.8 g/dL","unit":"g/dL","confidence":0.95,"plainExplanation":"Hemoglobin 13.8 g/dL is within normal range (13.0-17.0)."},{"name":"LDL cholesterol","category":"lab","value":"118 mg/dL","unit":"mg/dL","confidence":0.95,"plainExplanation":"LDL cholesterol 118 mg/dL is above optimal (<100 mg/dL)."}]}`;

const PROMPT_CONDITIONS_VITALS = `You are an internal medicine physician. Extract ALL diagnosed conditions, cardiovascular findings, allergies, patient demographics, and vitals from this document.

Each fact MUST be a JSON object with exactly these fields:
- name: Specific entity name (e.g. "Arjun Rao", "Essential hypertension", "Penicillin", "Blood pressure", "LVEF 35%")
- category: One of "demographics", "condition", "allergy", "vital", "vital_sign" — use "demographics" for patient identifiers/dates/hospital/doctor, "condition" for diagnoses/history, "allergy" for allergies (use value "NKDA" if no allergies), "vital" or "vital_sign" for vitals ONLY (blood pressure, pulse/heart rate, SpO2, weight, BMI, temperature, respiratory rate) — NEVER extract laboratory biomarkers like eGFR, creatinine, glucose or HbA1c here, those belong to the "lab" category
- value: Primary value string (e.g. "62 years / Male", "Acute worsening of chronic heart failure (HFrEF)", "rash", "128/78 mmHg", "72 bpm", "74 kg", "35%")
- unit: Unit string or empty if not applicable (e.g. "mmHg", "bpm", "kg", "%", "")
- date: Resolved concrete calendar date YYYY-MM-DD for the fact, or "" when not applicable. Resolve relative dates using document dates (e.g. admission/discharge date gives the year for "20-Aug").
- confidence: 0.95
- plainExplanation: One concise sentence in plain language explaining the fact (e.g. "Patient is Arjun Rao, 62-year-old male.", "History of essential hypertension diagnosed 2021.", "Allergy to penicillin causes rash.", "Blood pressure 128/78 mmHg is within normal range.")

Return strictly JSON matching {"facts": [...]} where each fact has name/category/value/unit/confidence/plainExplanation. Never use a field called "fact". If none found, return {"facts": []}.
Example: {"facts": [{"name":"Alex Morgan","category":"demographics","value":"14 March 1981","unit":"","confidence":0.95,"plainExplanation":"Patient is Alex Morgan, born 14 March 1981."},{"name":"Essential hypertension","category":"condition","value":"diagnosed 2021","unit":"","confidence":0.95,"plainExplanation":"History of essential hypertension since 2021."},{"name":"Blood pressure","category":"vital","value":"128/78","unit":"mmHg","confidence":0.95,"plainExplanation":"Blood pressure is 128/78 mmHg, mildly elevated but controlled."}]}`;

const PROMPT_CARE_SAFETY = `You are a post-discharge care coordinator. Extract ALL diet/lifestyle rules, follow-up appointments, due tests, questions, and red-flag danger signs from this document.

Each fact MUST be a JSON object with exactly these fields:
- name: Short descriptive title (e.g. "Low-sodium diet", "Cardiology follow-up", "Repeat lab panel (Month 6)", "Sudden weight gain >1.5kg")
- category: One of "diet_habit", "followup", "due_card", "question", "danger_sign" — use "diet_habit" for diet/fluid/activity rules, "followup" for scheduled clinic visits with dates, "due_card" for prescribed future lab tests with timing, "question" for any implied patient question, "danger_sign" for red-flag symptoms that require urgent care
- value: Full detail string (e.g. "Avoid excessive processed/high-salt foods. Follow clinician's fluid plan.", "Cardiology review with renal function and electrolytes", "Repeat fasting lipid panel and HbA1c", "Chest pain or worsening shortness of breath")
- unit: Empty string "" (unless a lab test panel specifies unit)
- date: REQUIRED for every "due_card" and "followup" fact — the RESOLVED concrete calendar date YYYY-MM-DD when the test/visit is due. Resolve relative schedules against document dates: e.g. discharge date 22-Aug-2026 + "Month 6 post-discharge" = "2027-02-22"; "in 7-14 days" from discharge = "2026-09-05" (use mid-range). If a schedule has MULTIPLE dates (e.g. "every 6 months at Month 6, 12, and 18"), create ONE fact per date, each with its own resolved date. Use "" only when the document truly gives no anchor date.
- confidence: 0.95
- plainExplanation: One concise plain-language sentence (e.g. "Follow a low-sodium diet and limit fluids as advised.", "See your cardiologist within 1-2 weeks.", "Need to repeat HbA1c and lipid tests in 3 months.")

Return strictly JSON matching {"facts": [...]} where each fact has name/category/value/unit/confidence/plainExplanation. Never use a field called "fact". If none found, return {"facts": []}.
Example: {"facts": [{"name":"Low-sodium diet","category":"diet_habit","value":"Avoid excessive processed/high-salt foods","unit":"","confidence":0.95,"plainExplanation":"Follow a low-sodium diet and avoid high-salt processed foods."},{"name":"Cardiology follow-up","category":"followup","value":"Cardiology/Internal Medicine review in 7–14 days","unit":"","confidence":0.95,"plainExplanation":"Follow up with cardiology in 1-2 weeks with blood tests."}]}`;

const CATEGORY_PROMPTS = [
  { name: 'Medications', prompt: PROMPT_MEDICATIONS },
  { name: 'Labs & Biomarkers', prompt: PROMPT_LABS },
  { name: 'Diagnoses, Vitals & Allergies', prompt: PROMPT_CONDITIONS_VITALS },
  { name: 'Diet, Follow-ups & Safety', prompt: PROMPT_CARE_SAFETY },
];

export async function callAI<T = unknown>(
  systemPrompt: string,
  userText: string,
  options?: AICallOptions
): Promise<T> {
  const config = getAIConfig();
  if (!isAIEnabled(config)) {
    throw new Error('AI is disabled or unconfigured — please check Settings or configure .env API key');
  }

  const endpoint = getAIEndpoint(config);
  const isVision = !!options?.imageDataUrl && isDataUrl(options.imageDataUrl);
  const model = getAIModel(config, isVision);

  if (!endpoint || !model) {
    throw new Error('AI endpoint or model could not be determined');
  }

  const isResp = isResponsesProvider(config);
  const structuredParams = buildStructuredParams(
    config.provider,
    config.structuredOutputs,
    options?.schema
  );

  const maxTokens = Math.max(options?.maxTokens || config.maxTokens || 4096, isResp ? 16384 : 8192);
  const temperature = options?.temperature ?? config.temperature ?? 0.1;

  let requestBody: Record<string, unknown>;
  if (isResp) {
    const input = buildResponsesInput(systemPrompt, userText, options?.imageDataUrl);
    requestBody = {
      model,
      input,
      temperature,
      max_output_tokens: maxTokens,
      reasoning: { effort: 'low' },
      ...structuredParams,
    };
  } else {
    const messages = buildChatMessages(systemPrompt, userText, options?.imageDataUrl);
    requestBody = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      ...structuredParams,
    };
  }

  const timeoutMs = options?.timeoutMs || config.timeoutMs || 120000;
  const controller = new AbortController();
  const fetchSignal = controller.signal;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    // Omit Authorization entirely when the client has no key — serverless
    // proxies inject the server-side key only when the header is absent/bare.
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.apiKey && config.apiKey.trim()) headers.Authorization = `Bearer ${config.apiKey.trim()}`;
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: fetchSignal,
    });
  } catch (err: unknown) {
    const e = err as { name?: string };
    if (e?.name === 'AbortError') {
      throw new Error(`AI request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`AI API request failed (${response.status} ${response.statusText}): ${text.slice(0, 400)}`);
  }

  const json = await response.json().catch(() => null) as unknown;
  if (!json) {
    throw new Error('AI API returned an empty or invalid JSON response');
  }

  const textContent = extractTextFromProviderResponse(json, config.provider);
  if (!textContent) {
    if (typeof json === 'object' && json !== null && !('choices' in (json as object)) && !('output' in (json as object))) {
      return json as T;
    }
    throw new Error('No text content could be extracted from the AI response payload');
  }

  const parsed = parseJsonContent<T>(textContent);
  if (!parsed) {
    throw new Error('AI response text content could not be parsed into valid JSON');
  }

  return parsed;
}

export async function extractWithAI(
  rawText: string,
  imageDataUrl?: string,
  docType?: string,
  context?: {
    patientId?: string;
    documentId?: string;
    extractionPath?: 'ocr_then_ai' | 'direct_vision';
    onStepProgress?: (step: 'ocr' | 'ai' | 'done', message: string) => void;
    timeoutMs?: number;
  }
): Promise<Fact[]> {
  const patientId = context?.patientId || derivePatientId();
  const documentId = context?.documentId || `doc_ai_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
  const config = getAIConfig();
  const extractionPath = context?.extractionPath || config.extractionPath || 'ocr_then_ai';

  let effectiveText = rawText?.trim() || '';
  let effectiveImageDataUrl: string | undefined = undefined;

  if (extractionPath === 'ocr_then_ai' && imageDataUrl) {
    if (context?.onStepProgress) {
      context.onStepProgress('ocr', 'Running high-precision Mistral OCR document pre-processing (preserving tables & structure)...');
    }
    try {
      const ocrResult = await runDocumentOCR(imageDataUrl, {
        apiKey: config.ocrApiKey,
        model: config.ocrModel,
        patientId,
      });
      if (ocrResult.markdown && ocrResult.markdown.trim().length > 0) {
        effectiveText = effectiveText
          ? `${effectiveText}\n\n${ocrResult.markdown}`
          : ocrResult.markdown;
      }
    } catch (err) {
      console.warn('[extractWithAI] OCR pre-processing notice:', err);
    }
  }

  if (imageDataUrl && isVisionSupportedImage(imageDataUrl)) {
    effectiveImageDataUrl = imageDataUrl;
  } else if (imageDataUrl && !effectiveText) {
    console.warn('[extractWithAI] No OCR text and no vision image for PDF — skipping manual pdfjs fallback (OCR-only pipeline)');
  }

  if (context?.onStepProgress) {
    context.onStepProgress('ai', 'Synthesizing categorical clinical facts with AI (4 parallel categories)...');
  }

  const promptDocContext = docType ? ` Document type: ${docType}.` : '';
  const userText = `${effectiveText ? effectiveText.slice(0, 16000) : 'Extract clinical facts from this document image.'}${promptDocContext}`;

  const categoryTasks = CATEGORY_PROMPTS.map(async (cat) => {
    try {
      const response = await callAI<{ facts: unknown[] }>(
        cat.prompt,
        userText,
        {
          imageDataUrl: effectiveImageDataUrl,
          schema: FACT_EXTRACTION_JSON_SCHEMA,
          docType,
          patientId,
          documentId,
          timeoutMs: context?.timeoutMs || 45000,
        }
      );
      const validated = validateStructuredFacts(response);
      const factsFromResponse = (response as unknown as { facts?: unknown[] })?.facts;
      if (validated.facts.length > 0) return validated.facts;
      if (Array.isArray(response)) return response as unknown[];
      if (Array.isArray(factsFromResponse)) return factsFromResponse as unknown[];
      return [];
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[extractWithAI] Parallel category "${cat.name}" extraction notice:`, msg);
      return [];
    }
  });

  const settledResults = await Promise.allSettled(categoryTasks);
  const aggregatedFacts: unknown[] = [];
  const seenFactKeys = new Set<string>();

  for (const res of settledResults) {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      for (const f of res.value) {
        if (!f || typeof f !== 'object') continue;
        const obj = f as { category?: unknown; name?: unknown; date?: unknown };
        const key = `${String(obj.category || '').toLowerCase()}_${String(obj.name || '').toLowerCase()}${obj.date ? '_' + String(obj.date) : ''}`;
        if (!seenFactKeys.has(key)) {
          seenFactKeys.add(key);
          aggregatedFacts.push(f);
        }
      }
    }
  }

  if (context?.onStepProgress) {
    context.onStepProgress('done', `Extracted ${aggregatedFacts.length} clinical facts across 4 categories.`);
  }

  const mapped = mapToVaultFacts(aggregatedFacts, patientId, documentId, docType);
  return mapped;
}

function normalizeUnit(category: string, name: string, unit?: string): string {
  if (unit && unit.trim() !== '') return unit.trim();
  const lower = (name + ' ' + category).toLowerCase();
  if (lower.includes('creatinine')) return 'mg/dL';
  if (lower.includes('egfr') || lower.includes('gfr')) return 'mL/min/1.73m2';
  if (lower.includes('potassium')) return 'mEq/L';
  if (lower.includes('hba1c') || lower.includes('a1c')) return '%';
  if (lower.includes('glucose')) return 'mg/dL';
  if (lower.includes('hemoglobin')) return 'g/dL';
  if (category === 'medication') return 'mg';
  return unit || '';
}

function mapToVaultFacts(
  aiFacts: unknown[],
  patientId: string,
  documentId: string,
  docType?: string
): Fact[] {
  return aiFacts.map((f, idx) => {
    const obj = (f && typeof f === 'object' ? f : {}) as { name?: unknown; category?: unknown; confidence?: unknown; plainExplanation?: unknown; value?: unknown; unit?: unknown };
    const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim().slice(0, 100) : `Fact ${idx + 1}`;
    const category = typeof obj.category === 'string' && obj.category.trim() ? obj.category.trim().toLowerCase() : 'medication';
    const rawConfidence = typeof obj.confidence === 'number' ? obj.confidence : 0.88;
    const confidence = Math.max(0.2, Math.min(1.0, Number.isFinite(rawConfidence) ? rawConfidence : 0.88));
    const plainExplanation = typeof obj.plainExplanation === 'string' && obj.plainExplanation.trim()
      ? obj.plainExplanation.trim().slice(0, 300)
      : `${name} noted.`;
    const unit = normalizeUnit(category, name, typeof obj.unit === 'string' ? obj.unit : undefined);
    const aiDate = typeof (obj as { date?: unknown }).date === 'string' ? (obj as { date: string }).date.trim() : '';
    const date = /^\d{4}-\d{2}-\d{2}/.test(aiDate) ? aiDate.slice(0, 10) : undefined;

    return {
      id: `fact_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      patientId,
      category: category as unknown as Fact['category'],
      name,
      value: ((obj.value as unknown) ?? name) as unknown as Fact['value'],
      unit,
      date,
      confidence: Math.round(confidence * 100) / 100,
      status: 'unconfirmed' as const,
      sourceDocId: documentId,
      plainExplanation,
      author: 'system_ai',
      timestamp: new Date().toISOString(),
      metadata: docType ? { docType } : undefined,
    };
  });
}

function derivePatientId(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('carecanvas_active_user');
      if (raw) {
        const parsed = JSON.parse(raw) as unknown as { userId?: unknown; id?: unknown; patientId?: unknown };
        const p = parsed as { userId?: unknown; id?: unknown; patientId?: unknown };
        const val = p?.userId ?? p?.id ?? p?.patientId;
        if (typeof val === 'string' && val.trim()) return val.trim();
        if (typeof val === 'string') return val;
      }
    }
  } catch { /* intentionally empty */ }
  return 'patient-unknown';
}
