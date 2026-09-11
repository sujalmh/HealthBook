
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
Extract each medication as a structured fact object with exactly these fields:
- name: Medication generic or brand name as documented.
- category: "medication"
- value: Complete administration regimen including strength/dose, route (oral, parenteral, etc.), administration frequency, diurnal timing (morning, midday, evening, bedtime), and food/meal instructions.
- unit: Standard dosage unit (e.g., mg, mcg, mL, IU, units).
- date: "" (empty string for continuous or scheduled medication regimens).
- confidence: Extraction confidence score between 0.00 and 1.00.
- plainExplanation: Concise, clear plain-language summary explaining how and when the patient should take the medication.
Return strictly JSON matching {"facts": [...]} where each fact has name, category, value, unit, confidence, plainExplanation. If no medications are found, return {"facts": []}.`;

const PROMPT_LABS = `You are a clinical pathologist. Extract ALL laboratory diagnostic tests, panels, and numeric biomarker readings from this document.
Extract each laboratory finding as a structured fact object with exactly these fields:
- name: Standard clinical biomarker or panel name as documented.
- category: "lab"
- value: Measured quantitative value, reference status, or chronological readings. For multi-date trend tables, record all chronological measurements in the value string. Extract all diagnostic blood, urine, and biochemical analyte rows.
- unit: Standard clinical measurement unit.
- date: The measurement date resolved to a full calendar date YYYY-MM-DD using document anchor dates. Empty string if no date is specified.
- confidence: Extraction confidence score between 0.00 and 1.00.
- plainExplanation: Clear explanation of the result, noting whether the value is within, above, or below standard physiological reference thresholds.
Scope Distinction: Do NOT extract bedside vital signs (blood pressure, pulse, temperature, oxygen saturation, respiratory rate) under this category; extract only laboratory diagnostic analytes.
Return strictly JSON matching {"facts": [...]} where each fact has name, category, value, unit, confidence, plainExplanation. If no laboratory findings are present, return {"facts": []}.`;

const PROMPT_CONDITIONS_VITALS = `You are an internal medicine physician. Extract ALL diagnosed conditions, cardiovascular findings, allergies, patient demographics, and vitals from this document.

Each fact MUST be a JSON object with exactly these fields:
- name: Specific clinical entity name, diagnosis, allergy substance, or vital sign parameter.
- category: One of "demographics", "condition", "allergy", "vital", "vital_sign" — use "demographics" for patient identifiers/dates/hospital/doctor, "condition" for clinical diagnoses and medical history, "allergy" for documented drug or environmental allergies (record "NKDA" if documented as no known drug allergies), and "vital" or "vital_sign" for physiological vital signs ONLY (blood pressure, pulse/heart rate, oxygen saturation, body weight, BMI, temperature, respiratory rate). Do NOT extract laboratory blood analytes under this category.
- value: Clinical finding, stage, reaction description, or measured vital reading.
- unit: Measurement unit string or empty string if not applicable.
- date: Resolved calendar date YYYY-MM-DD for the observation or diagnosis, or empty string when not specified.
- confidence: Extraction confidence score between 0.00 and 1.00.
- plainExplanation: One concise sentence in plain language explaining the clinical finding or observation.

Return strictly JSON matching {"facts": [...]} where each fact has name, category, value, unit, confidence, plainExplanation. Never use a field called "fact". If none found, return {"facts": []}.`;

const PROMPT_CARE_SAFETY = `You are a post-discharge care coordinator. Extract ALL diet/lifestyle instructions, follow-up clinic appointments, future scheduled diagnostic tests, patient questions, and red-flag danger symptoms from this document.

Each fact MUST be a JSON object with exactly these fields:
- name: Short descriptive title for the care plan item, scheduled visit, diagnostic order, or symptom warning.
- category: One of "diet_habit", "followup", "due_card", "question", "danger_sign" — use "diet_habit" for dietary, fluid, or activity restrictions; "followup" for scheduled or recommended clinic appointments; "due_card" for ordered future diagnostic tests or monitoring labs; "question" for unresolved patient inquiries; "danger_sign" for acute red-flag symptoms requiring emergency medical contact.
- value: Comprehensive clinical instructions and details.
- unit: Measurement unit if applicable, otherwise empty string "".
- date: Required for every "due_card" and "followup" fact — calculate the resolved calendar date YYYY-MM-DD by applying documented time intervals relative to the document discharge or encounter anchor date. If a schedule specifies multiple recurring intervals, generate a distinct fact for each scheduled date. Use empty string "" only when no anchor date is documented.
- confidence: Extraction confidence score between 0.00 and 1.00.
- plainExplanation: One concise plain-language sentence explaining the action or warning for the patient.

Return strictly JSON matching {"facts": [...]} where each fact has name, category, value, unit, confidence, plainExplanation. Never use a field called "fact". If none found, return {"facts": []}.`;

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
      const raw = localStorage.getItem('healthbook_active_user');
      if (raw) {
        const parsed = JSON.parse(raw) as unknown as { userId?: unknown; id?: unknown; patientId?: unknown };
        const p = parsed as { userId?: unknown; id?: unknown; patientId?: unknown };
        const val = p?.userId ?? p?.id ?? p?.patientId;
        if (typeof val === 'string' && val.trim()) return val.trim();
        if (typeof val === 'string') return val;
      }
    }
  } catch {  }
  return 'patient-unknown';
}

