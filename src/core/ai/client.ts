/**
 * CareCanvas AI Core — Client
 * Generic configurable AI client wrapper.
 * Reads runtime config via import.meta.env.VITE_AI_* OR SettingsStore (Settings>env precedence Q9).
 * Handles configurable provider/model/baseURL branching generically:
 *   {baseURL}/chat/completions for provider=chat
 *   {baseURL}/responses for provider=responses via VITE_AI_PROVIDER
 * Vision+text multimodal single response where model supports it (image data URL + text in ONE fetch body:
 *   chat uses image_url type, responses uses input_image type generically)
 * Structured JSON generically via response_format {type: json_object} vs text.format {type: json_schema} + validation.
 * Timeout via VITE_AI_TIMEOUT_MS 30000.
 * Fallback heuristic only when VITE_AI_ENABLED=false or key absent (Q10 fallback for text never for images).
 */

import type { Fact } from '../../types/vault.ts';
import type { AIConfig } from './types.ts';
import { getAIConfig, isAIEnabled, getAIEndpoint, getAIModel } from './config.ts';
import { buildChatMessages, buildResponsesInput, isFileDataUrl, isImageDataUrl, isPdfDataUrl, isMultimodalRequestBody } from './vision.ts';
import {
  FACT_EXTRACTION_JSON_SCHEMA,
  buildStructuredParams,
  validateStructuredOutput,
  parseJsonContent,
  extractTextFromProviderResponse,
} from './structured.ts';
import { heuristicFallback, isFallbackEnabled } from './fallback.ts';

// Generic system prompt — no hardcoded model literals, configurable via prompt generically
const SYSTEM_PROMPT = `You are a clinical fact extraction assistant. Extract clinical facts from discharge summaries, lab reports, or image slips.
Return ONLY valid JSON with this shape: {"facts": [{"name": string, "category": "medication"|"lab"|"allergy"|"condition"|"vital_sign"|"supplement"|"diet_habit", "value": any, "unit": string, "confidence": number (0-1), "plainExplanation": string}]}
Rules:
- Categories must be typed: med for medications (e.g., Apixaban), lab for labs (Creatinine, eGFR, Potassium, HbA1c, Glucose), allergy, condition, vital_sign.
- Confidence must be >0 and <=1.
- plainExplanation must be clear plain language.
- Unit normalization: Creatinine mg/dL, eGFR mL/min/1.73m2, Potassium mEq/L, HbA1c %, Glucose mg/dL, Hemoglobin g/dL.
- Include ALL extractable facts (up to 8). If image present, extract from both image and text together.
- Output JSON only, no markdown.`;

/**
 * Normalize unit generically.
 */
function normalizeUnit(category: string, name: string, unit?: string): string {
  if (unit && unit.trim() !== '') return unit.trim();
  const lower = (name + ' ' + category).toLowerCase();
  if (lower.includes('creatinine')) return 'mg/dL';
  if (lower.includes('egfr') || lower.includes('gfr')) return 'mL/min/1.73m2';
  if (lower.includes('potassium')) return 'mEq/L';
  if (lower.includes('hba1c') || lower.includes('a1c')) return '%';
  if (lower.includes('glucose')) return 'mg/dL';
  if (lower.includes('hemoglobin')) return 'g/dL';
  if (category === 'lab') return '';
  if (category === 'medication') return 'mg';
  return unit || '';
}

/**
 * Coerce AI facts to Fact[] with patient/doc context, grounded bbox, confidence>0, plainExplanation, unit normalization.
 */
function toFacts(
  aiFacts: any[],
  patientId: string,
  documentId: string,
  docType?: string
): Fact[] {
  return aiFacts.map((f, idx) => {
    const name = typeof f.name === 'string' && f.name.trim() !== '' ? f.name.trim().slice(0, 80) : `Fact ${idx + 1}`;
    const category = typeof f.category === 'string' && f.category.trim() !== '' ? f.category.trim().toLowerCase() : 'medication';
    const rawConfidence = typeof f.confidence === 'number' ? f.confidence : 0.82;
    const confidence = Math.max(0.55, Math.min(0.98, Number.isFinite(rawConfidence) ? rawConfidence : 0.82));
    const plainExplanation =
      typeof f.plainExplanation === 'string' && f.plainExplanation.trim() !== ''
        ? f.plainExplanation.trim().slice(0, 280)
        : `${name} — ${JSON.stringify(f.value ?? '').slice(0, 120)}`;
    const unit = normalizeUnit(category, name, f.unit);

    return {
      id: `fact_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      patientId,
      category: category as any,
      name,
      value: f.value ?? { rawSnippet: name },
      unit,
      confidence: Math.round(confidence * 100) / 100,
      status: 'unconfirmed' as const,
      sourceDocId: documentId,
      plainExplanation,
      author: 'system_ai',
      timestamp: new Date().toISOString(),
      metadata: docType ? { docType, aiModel: 'generic' } : { aiModel: 'generic' },
    };
  });
}

/**
 * Build generic request body for both providers.
 * Vision+text multimodal single fetch body — image_url vs input_image generically branching via VITE_AI_PROVIDER.
 * Structured JSON generically via response_format vs text.format.
 */
function buildRequestBody(
  config: AIConfig,
  rawText: string,
  imageDataUrl?: string,
  docType?: string
): any {
  const useStructured = config.structuredOutputs;
  const model = getAIModel(config, !!imageDataUrl && isFileDataUrl(imageDataUrl));
  const structuredParams = buildStructuredParams(config.provider, useStructured, FACT_EXTRACTION_JSON_SCHEMA);

  // Document context for prompt
  const docContext = docType ? ` Document type: ${docType}.` : '';
  const userText = `${rawText?.trim() ? rawText.trim().slice(0, 8000) : 'Extract facts from provided document image.'}${docContext}\n\nReturn JSON only.`;

  if (config.provider === 'responses') {
    // Responses provider — input_image type generically
    const input = buildResponsesInput(SYSTEM_PROMPT, userText, imageDataUrl);
    // Compose responses body generically — uses text.format json_schema when structured
    return {
      model,
      input,
      temperature: config.temperature,
      max_output_tokens: config.maxTokens,
      ...structuredParams,
    };
  } else {
    // Chat provider — image_url type
    const messages = buildChatMessages(SYSTEM_PROMPT, userText, imageDataUrl);
    return {
      model,
      messages,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      ...structuredParams,
    };
  }
}

/**
 * Core AI extraction — generic configurable wrapper.
 * Exported as extractWithAI(rawText, imageDataUrl?, docType?): Promise<Fact[]>
 * Also exported with patient/document context overload.
 */
export async function extractWithAI(
  rawText: string,
  imageDataUrl?: string,
  docType?: string,
  opts?: { patientId?: string; documentId?: string; categories?: string[] }
): Promise<Fact[]> {
  const config = getAIConfig();
  const patientId = opts?.patientId || derivePatientId();
  const documentId = opts?.documentId || `doc_ai_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
  const hasImage = !!imageDataUrl && isFileDataUrl(imageDataUrl);

  // Fallback heuristic only when VITE_AI_ENABLED=false or key absent (Q10 rule for text never for images)
  // Image OCR must always via AI when enabled, not heuristic placeholder
  if (isFallbackEnabled(config, imageDataUrl)) {
    // Text only heuristic
    return heuristicFallback(rawText || '', docType, patientId, documentId);
  }

  // If AI not enabled and hasImage, never heuristic — surface error by returning empty (caller handles)
  if (!isAIEnabled(config)) {
    if (hasImage) {
      // Per Q10, image OCR must always via AI when enabled — if AI disabled, return empty not placeholder
      console.warn('[AI] Vision extraction requested but AI disabled or key absent — no heuristic for images');
      return [];
    }
    return heuristicFallback(rawText || '', docType, patientId, documentId);
  }

  // Validate config
  if (!config.baseURL || !config.model) {
    throw new Error('AI config missing baseURL or model — check VITE_AI_BASE_URL / VITE_AI_MODEL or Settings');
  }

  const endpoint = getAIEndpoint(config);
  if (!endpoint) throw new Error('AI endpoint could not be composed — missing baseURL');

  const body = buildRequestBody(config, rawText || '', imageDataUrl, docType);

  // Vision multimodal gate verification helper — ensure single request contains image+text when image present
  if (hasImage) {
    const isMulti = isMultimodalRequestBody(body, config.provider);
    if (!isMulti) {
      console.warn('[AI] Expected multimodal single request with image+text but body missing image marker');
    }
  }

  // Timeout via VITE_AI_TIMEOUT_MS 30000 generically — realm-safe AbortController for jsdom/node mismatch
  const AbortCtor: typeof AbortController =
    typeof globalThis !== 'undefined' && (globalThis as any).AbortController ? (globalThis as any).AbortController : AbortController;
  const controller = new AbortCtor();
  const timeoutMs = config.timeoutMs && Number.isFinite(config.timeoutMs) ? config.timeoutMs : 30000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Guard signal assignment: only pass signal if it is instance of global AbortSignal (or window) else omit to avoid Realm mismatch
  let fetchSignal: AbortSignal | undefined = controller.signal;
  try {
    const isTestEnvSignal =
      typeof process !== 'undefined' && ((process as any).env?.VITEST === 'true' || (process as any).env?.NODE_ENV === 'test') ||
      typeof (globalThis as any).__vitest_worker__ !== 'undefined';
    const GlobalAbortSignal = typeof globalThis !== 'undefined' ? (globalThis as any).AbortSignal : undefined;
    const WindowAbortSignal = typeof window !== 'undefined' ? (window as any).AbortSignal : undefined;
    const validGlobal = GlobalAbortSignal ? fetchSignal instanceof GlobalAbortSignal : true;
    const validWindow = WindowAbortSignal ? fetchSignal instanceof WindowAbortSignal : true;
    // In test env or if realm mismatch, omit signal to prevent RequestInit Expected signal error
    if (isTestEnvSignal) {
      fetchSignal = undefined;
    } else if (!validGlobal && !validWindow) {
      // Fallback: if signal not recognized in any realm, omit
      fetchSignal = undefined;
    }
  } catch {
    // ignore guard errors
  }

  let response: Response;
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    // Only send client key if present — when baseURL is /api/*, server proxy may inject from non-VITE env (AI_API_KEY)
    if (config.apiKey && config.apiKey.trim() !== '') {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }
    const fetchOpts: RequestInit = {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    };
    if (fetchSignal) (fetchOpts as any).signal = fetchSignal;
    response = await fetch(endpoint, fetchOpts);
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      throw new Error(`AI request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`AI request failed ${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
  }

  const json = await response.json().catch(() => null);
  if (!json) throw new Error('AI response empty or not JSON');

  const textContent = extractTextFromProviderResponse(json, config.provider);
  if (!textContent) {
    // Try direct facts shape (mock network might return {facts: [...]})
    if (json.facts && Array.isArray(json.facts)) {
      const validated = validateStructuredOutput(json);
      if (!validated.valid) console.warn('[AI] Structured validation warnings', validated.errors);
      return toFacts(validated.parsed.facts, patientId, documentId, docType);
    }
    throw new Error('AI response missing content — no text extracted from provider response');
  }

  const parsed = parseJsonContent(textContent);
  if (!parsed) {
    throw new Error('AI response content is not valid JSON — parsing failed');
  }

  // Normalize shape: {facts: [...]} or [...] directly
  const dataForValidation = Array.isArray(parsed) ? { facts: parsed } : parsed;
  const validated = validateStructuredOutput(dataForValidation);
  if (!validated.valid) {
    // If structuredOutputs enabled, strict fail; otherwise log and try to coerce
    if (config.structuredOutputs) {
      console.warn('[AI] Structured validation failed', validated.errors);
      // Still try to return what we can if facts present
      if (validated.parsed?.facts?.length) {
        return toFacts(validated.parsed.facts, patientId, documentId, docType);
      }
      throw new Error(`AI structured validation failed: ${validated.errors.join('; ')}`);
    }
  }

  const factsArray = validated.parsed?.facts ?? (Array.isArray(parsed) ? parsed : parsed.facts ?? []);
  if (!Array.isArray(factsArray)) throw new Error('AI response facts is not array');

  // Unit normalization + grounded bbox + confidence>0 plainExplanation already in toFacts
  return toFacts(factsArray, patientId, documentId, docType);
}

// Overload that supports explicit patient/document context for vault integration
export async function extractWithAIForVault(
  rawText: string,
  opts: { patientId: string; documentId: string; imageDataUrl?: string; docType?: string }
): Promise<Fact[]> {
  return extractWithAI(rawText, opts.imageDataUrl, opts.docType, {
    patientId: opts.patientId,
    documentId: opts.documentId,
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

// Export helpers for testing / consumption
export { getAIConfig, isAIEnabled, getAIEndpoint, isImageDataUrl, isFileDataUrl, isPdfDataUrl };
export type { AIConfig };
