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

const SYSTEM_FACT_EXTRACTION_PROMPT = `You are an expert clinical data extraction assistant. Extract ALL medical and healthcare facts from the provided document into a complete, structured array of categorical facts to populate the patient's entire health companion.

Categories to extract:
- "demographics": Patient name, age, gender, blood group, hospital, consultant doctor, admission date, discharge date.
- "medication": All active and discontinued medications with exact dose, frequency (BID, QD, etc.), route (PO/IV), timing (morning, evening, bedtime), and food instructions.
- "lab": All laboratory test values, diagnostic biomarkers, units, and reference flags (HIGH, LOW, NORMAL, CRITICAL).
- "condition": All diagnosed medical conditions, chronic illnesses, and clinical findings.
- "allergy": Documented allergies (or NKDA if none).
- "vital": Vitals like blood pressure, pulse, SpO2, weight, and temperature.
- "diet_habit": Diet instructions (low sodium, fluid limits, avoid grapefruit, etc.).
- "followup": Scheduled follow-up appointments, clinic visits, and doctor review timelines.
- "due_card": Prescribed future or repeat lab tests to be done at home or clinic.
- "question": Relevant questions for the patient to ask their doctor.
- "danger_sign": Warning symptoms and red-flag thresholds mentioned in the papers.

For any field not mentioned or not applicable, provide "null" or an empty string. Output strictly valid JSON matching the schema.`;

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
    if (err?.name === 'AbortError') {
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

  const json = await response.json().catch(() => null);
  if (!json) {
    throw new Error('AI API returned an empty or invalid JSON response');
  }

  // Extract raw string content from provider response shape
  const textContent = extractTextFromProviderResponse(json, config.provider);
  if (!textContent) {
    // If provider directly returned the target object shape
    if (typeof json === 'object' && !json.choices && !json.output) {
      return json as T;
    }
    console.error('[AI Text Extraction Failed. Raw JSON:]', JSON.stringify(json, null, 2));
    throw new Error('No text content could be extracted from the AI response payload');
  }

  // Parse JSON from text
  const parsed = parseJsonContent<T>(textContent);
  if (!parsed) {
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

  // Path A: High-Precision OCR Pre-Processing First (Mistral OCR with client-side fallback)
  if (extractionPath === 'ocr_then_ai' && imageDataUrl) {
    if (context?.onStepProgress) {
      context.onStepProgress('ocr', 'Running high-precision Mistral OCR document pre-processing...');
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
    context.onStepProgress('ai', 'Synthesizing categorical clinical facts with AI...');
  }

  const promptDocContext = docType ? ` Document type: ${docType}.` : '';
  const userText = `${effectiveText ? effectiveText.slice(0, 16000) : 'Extract all clinical facts from this document image.'}${promptDocContext}`;

  const response = await callAI<{ facts: any[] }>(
    SYSTEM_FACT_EXTRACTION_PROMPT,
    userText,
    {
      imageDataUrl: effectiveImageDataUrl,
      schema: FACT_EXTRACTION_JSON_SCHEMA,
      docType,
      patientId,
      documentId,
      timeoutMs: context?.timeoutMs,
    }
  );

  const validated = validateStructuredFacts(response);
  const extractedFacts = validated.facts.length > 0 ? validated.facts : (Array.isArray(response) ? response : response.facts || []);

  if (context?.onStepProgress) {
    context.onStepProgress('done', `Extracted ${extractedFacts.length} clinical facts.`);
  }

  return mapToVaultFacts(extractedFacts, patientId, documentId, docType);
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
