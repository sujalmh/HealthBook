/**
 * CareCanvas AI Core — Client
 * Single unified HTTP communication client for all OpenAI-compatible endpoints (/chat/completions & /responses).
 * Features:
 * - Unified multimodal body composition (chat image_url vs responses input_image)
 * - Structured JSON schema enforcement with resilient fallback parsing
 * - AbortController signal lifecycle with configurable timeouts
 * - Dedicated extraction & normalization pipeline for Vault facts
 */

import type { Fact } from '../../types/vault.ts';
import type { AIConfig, AICallOptions } from './types.ts';
import { getAIConfig, isAIEnabled, getAIEndpoint, getAIModel, isResponsesProvider } from './config.ts';
import { buildChatMessages, buildResponsesInput, isDataUrl, isVisionSupportedImage } from './vision.ts';
import { processPdfData } from './pdf.ts';
import { runDocumentOCR } from './ocr.ts';
import {
  FACT_EXTRACTION_JSON_SCHEMA,
  buildStructuredParams,
  validateStructuredFacts,
  parseJsonContent,
  extractTextFromProviderResponse,
} from './structured.ts';

const PROMPT_MEDICATIONS = `You are a clinical pharmacologist. Extract ALL active and discharge medications from this document.
Extract each medication as an object with:
- name: Medication generic/brand name
- category: "medication"
- value: Exact dosage, route (PO/IV), frequency (BID, QD, etc.), timing (morning, evening, bedtime), and food instructions
- unit: Dosage unit (e.g. mg, mcg, mL)
- confidence: 0.95
- plainExplanation: Concise summary of route, frequency, and instructions.
Return strictly JSON matching {"facts": [...]}. If none found, return {"facts": []}.`;

const PROMPT_LABS = `You are a clinical pathologist. Extract ALL laboratory tests, numeric biomarker values, and diagnostic readings from this document.
Extract each lab test as an object with:
- name: Standard lab name (e.g. HbA1c, Serum Creatinine, NT-proBNP, Sodium, Potassium, ALT, AST, Hemoglobin)
- category: "lab"
- value: Measured numeric value or chronological readings (e.g. "1.1 mg/dL" or "06-Aug: 13.4, 11-Aug: 13.2")
- unit: Standard clinical unit (e.g. mg/dL, %, pg/mL, mEq/L, g/dL)
- confidence: 0.95
- plainExplanation: Clear explanation of reading and normal/abnormal status.
Return strictly JSON matching {"facts": [...]}. If none found, return {"facts": []}.`;

const PROMPT_CONDITIONS_VITALS = `You are an internal medicine physician. Extract ALL diagnosed conditions, cardiovascular findings, allergies, patient demographics, and vitals from this document.
Categories:
- "demographics": Patient name, age, gender, blood group, hospital, consultant doctor, admission/discharge dates.
- "condition": Primary & secondary diagnoses, cardiac ejection fraction (e.g. LVEF 30-35%), CAD, Heart Failure, etc.
- "allergy": Documented drug/food allergies (or NKDA).
- "vital": Blood pressure, pulse, SpO2, weight, BMI, temperature.
Return strictly JSON matching {"facts": [...]}. If none found, return {"facts": []}.`;

const PROMPT_CARE_SAFETY = `You are a post-discharge care coordinator. Extract ALL diet/lifestyle rules, follow-up appointments, due tests, questions, and red-flag danger signs from this document.
Categories:
- "diet_habit": Low sodium rules, fluid limits, daily morning weight logging, etc.
- "followup": Scheduled clinic visits, cardiology reviews, and doctor timelines.
- "due_card": Prescribed future/repeat lab tests (e.g. Repeat Creatinine/K+ in 7 days).
- "question": Recommended questions for the patient to ask their doctor.
- "danger_sign": Warning symptoms (e.g. sudden weight gain >1.5kg, chest pain, worsening shortness of breath).
Return strictly JSON matching {"facts": [...]}. If none found, return {"facts": []}.`;

const CATEGORY_PROMPTS = [
  { name: 'Medications', prompt: PROMPT_MEDICATIONS },
  { name: 'Labs & Biomarkers', prompt: PROMPT_LABS },
  { name: 'Diagnoses, Vitals & Allergies', prompt: PROMPT_CONDITIONS_VITALS },
  { name: 'Diet, Follow-ups & Safety', prompt: PROMPT_CARE_SAFETY },
];

/**
 * Universal AI calling engine for CareCanvas.
 * Handles chat and responses endpoints, multimodal images, JSON schemas, and error extraction.
 */
export async function callAI<T = any>(
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

  let requestBody: any;
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
  const controller = new (globalThis as any).AbortController();
  const fetchSignal = controller.signal;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  console.log('[AI] callAI request', {
    endpoint,
    model,
    provider: config.provider,
    isVision,
    isResp,
    temperature,
    maxTokens,
    systemPromptPreview: systemPrompt.slice(0, 300),
    userTextPreview: userText.slice(0, 600),
    requestBodyKeys: Object.keys(requestBody || {}),
  });

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: fetchSignal,
    });
  } catch (err: any) {
    console.log('[AI] fetch threw exception:', err?.message || err, err);
    if (err?.name === 'AbortError') {
      throw new Error(`AI request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  console.log(`[AI] response HTTP ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.log('[AI] Error response body:', text.slice(0, 2000));
    throw new Error(`AI API request failed (${response.status} ${response.statusText}): ${text.slice(0, 400)}`);
  }

  const json = await response.json().catch(() => null);
  console.log('[AI] Raw AI Response JSON:', JSON.stringify(json, null, 2));
  if (!json) {
    throw new Error('AI API returned an empty or invalid JSON response');
  }

  // Extract raw string content from provider response shape
  const textContent = extractTextFromProviderResponse(json, config.provider);
  console.log('[AI] Extracted textContent length:', textContent?.length || 0, 'preview:', (textContent || '').slice(0, 800));
  if (!textContent) {
    // If provider directly returned the target object shape
    if (typeof json === 'object' && !json.choices && !json.output) {
      console.log('[AI] Provider returned direct object shape — returning json as T', json);
      return json as T;
    }
    console.error('[AI Text Extraction Failed. Raw JSON:]', JSON.stringify(json, null, 2));
    console.log('[AI] Full failure JSON logged above');
    throw new Error('No text content could be extracted from the AI response payload');
  }

  // Parse JSON from text
  const parsed = parseJsonContent<T>(textContent);
  console.log('[AI] Parsed JSON content:', JSON.stringify(parsed, null, 2));
  if (!parsed) {
    console.log('[AI] parseJsonContent returned null for textContent:', textContent.slice(0, 2000));
    throw new Error('AI response text content could not be parsed into valid JSON');
  }

  return parsed;
}

/**
 * Standardized Clinical Fact Extraction.
 * Extracts medications, labs, conditions, and vitals from document text and/or images.
 */
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

  // Path A: High-Precision OCR Pre-Processing First (Mistral OCR with client-side fallback — preserving tables/blocks)
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

      console.log('[extractWithAI] OCRResult from runDocumentOCR:', JSON.stringify(ocrResult, null, 2));

      if (ocrResult.markdown && ocrResult.markdown.trim().length > 0) {
        effectiveText = effectiveText
          ? `${effectiveText}\n\n${ocrResult.markdown}`
          : ocrResult.markdown;
        console.log('[extractWithAI] effectiveText after OCR merge length:', effectiveText.length, 'preview:', effectiveText.slice(0, 600));
        if (ocrResult.tables && ocrResult.tables.length > 0) {
          console.log('[extractWithAI] Tables preserved:', ocrResult.tables.length);
        }
      } else {
        console.log('[extractWithAI] OCR returned empty markdown, keeping original effectiveText length:', effectiveText.length);
      }
    } catch (err) {
      console.warn('[extractWithAI] OCR pre-processing notice:', err);
      console.log('[extractWithAI] OCR exception full:', err);
    }
  }

  // Path B (or fallback when OCR returned no text): Direct Multimodal Vision
  if ((extractionPath === 'direct_vision' || !effectiveText) && imageDataUrl) {
    if (imageDataUrl.startsWith('data:application/pdf') || imageDataUrl.includes('application/pdf')) {
      try {
        const pdfResult = await processPdfData(imageDataUrl);
        if (pdfResult.text && !effectiveText) {
          effectiveText = pdfResult.text;
        }
        if (pdfResult.imagePreviewDataUrl && isVisionSupportedImage(pdfResult.imagePreviewDataUrl)) {
          effectiveImageDataUrl = pdfResult.imagePreviewDataUrl;
        }
      } catch (err) {
        console.warn('[extractWithAI] PDF extraction notice:', err);
      }
    } else if (isVisionSupportedImage(imageDataUrl)) {
      effectiveImageDataUrl = imageDataUrl;
    }
  }

  if (context?.onStepProgress) {
    context.onStepProgress('ai', 'Synthesizing categorical clinical facts with AI (4 parallel categories)...');
  }

  const promptDocContext = docType ? ` Document type: ${docType}.` : '';
  const userText = `${effectiveText ? effectiveText.slice(0, 16000) : 'Extract clinical facts from this document image.'}${promptDocContext}`;

  // Execute all 4 category extractions in parallel for maximum speed and accuracy
  console.log('[extractWithAI] Starting 4-category parallel extraction with userText length:', userText.length, 'hasImage:', !!effectiveImageDataUrl);
  const categoryTasks = CATEGORY_PROMPTS.map(async (cat) => {
    try {
      console.log(`[extractWithAI] ⏳ Calling AI for category "${cat.name}"`);
      const response = await callAI<{ facts: any[] }>(
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
      console.log(`[extractWithAI] ✅ AI raw response for "${cat.name}":`, JSON.stringify(response, null, 2));
      const validated = validateStructuredFacts(response);
      console.log(`[extractWithAI] Validated facts for "${cat.name}":`, validated.facts.length, validated.errors);
      return validated.facts.length > 0 ? validated.facts : (Array.isArray(response) ? response : response.facts || []);
    } catch (err) {
      console.warn(`[extractWithAI] Parallel category "${cat.name}" extraction notice:`, (err as any)?.message || err);
      console.log(`[extractWithAI] Category "${cat.name}" failed fully:`, err);
      return [];
    }
  });

  const settledResults = await Promise.allSettled(categoryTasks);
  console.log('[extractWithAI] All categories settled:', settledResults.map(r => r.status));
  settledResults.forEach((r, idx) => {
    console.log(`[extractWithAI] Category ${CATEGORY_PROMPTS[idx].name} result:`, r.status === 'fulfilled' ? JSON.stringify(r.value).slice(0, 800) : (r as any).reason);
  });
  const aggregatedFacts: any[] = [];
  const seenFactKeys = new Set<string>();

  for (const res of settledResults) {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      for (const f of res.value) {
        if (!f || typeof f !== 'object') continue;
        const key = `${(f.category || '').toLowerCase()}_${(f.name || '').toLowerCase()}`;
        if (!seenFactKeys.has(key)) {
          seenFactKeys.add(key);
          aggregatedFacts.push(f);
        }
      }
    }
  }

  console.log('[extractWithAI] Aggregated facts before vault mapping:', JSON.stringify(aggregatedFacts, null, 2));
  console.log('[extractWithAI] Total aggregated facts count:', aggregatedFacts.length);

  if (context?.onStepProgress) {
    context.onStepProgress('done', `Extracted ${aggregatedFacts.length} clinical facts across 4 categories.`);
  }

  const mapped = mapToVaultFacts(aggregatedFacts, patientId, documentId, docType);
  console.log('[extractWithAI] Final mapped Vault Facts:', JSON.stringify(mapped, null, 2));
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
  aiFacts: any[],
  patientId: string,
  documentId: string,
  docType?: string
): Fact[] {
  return aiFacts.map((f, idx) => {
    const name = typeof f.name === 'string' && f.name.trim() ? f.name.trim().slice(0, 100) : `Fact ${idx + 1}`;
    const category = typeof f.category === 'string' && f.category.trim() ? f.category.trim().toLowerCase() : 'medication';
    const rawConfidence = typeof f.confidence === 'number' ? f.confidence : 0.88;
    const confidence = Math.max(0.2, Math.min(1.0, Number.isFinite(rawConfidence) ? rawConfidence : 0.88));
    const plainExplanation = typeof f.plainExplanation === 'string' && f.plainExplanation.trim()
      ? f.plainExplanation.trim().slice(0, 300)
      : `${name} noted.`;
    const unit = normalizeUnit(category, name, f.unit);

    return {
      id: `fact_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      patientId,
      category: category as any,
      name,
      value: f.value ?? name,
      unit,
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
        const parsed = JSON.parse(raw);
        return parsed?.userId || parsed?.id || parsed?.patientId || 'patient-unknown';
      }
    }
  } catch {}
  return 'patient-unknown';
}
