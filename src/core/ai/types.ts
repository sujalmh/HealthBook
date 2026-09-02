/**
 * CareCanvas AI Core — Types
 */

import type { Fact } from '../../types/vault.ts';

export type AIProvider = 'chat' | 'responses';

export type AIFactCategory =
  | 'medication'
  | 'lab'
  | 'allergy'
  | 'condition'
  | 'vital_sign'
  | 'supplement'
  | 'diet_habit'
  | string;

export interface AIConfig {
  enabled: boolean;
  provider: AIProvider;
  baseURL: string;
  apiKey: string;
  model: string;
  visionModel: string;
  structuredOutputs: boolean;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  ocrEnabled?: boolean;
  ocrApiKey?: string;
  ocrModel?: string;
  extractionPath?: 'ocr_then_ai' | 'direct_vision';
}

export interface AICallOptions {
  schema?: Record<string, unknown>;
  imageDataUrl?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  docType?: string;
  patientId?: string;
  documentId?: string;
  extractionPath?: 'ocr_then_ai' | 'direct_vision';
  onStepProgress?: (step: 'ocr' | 'ai' | 'done', message: string) => void;
}

export interface AIExtractedFact {
  name: string;
  category: AIFactCategory;
  value: unknown;
  unit?: string;
  confidence: number;
  plainExplanation: string;
  /** Resolved concrete calendar date (YYYY-MM-DD) for dated facts, empty string when not applicable */
  date?: string;
}

export interface AIStructuredFactsPayload {
  facts: AIExtractedFact[];
}

export interface AIMessageContentText {
  type: 'text';
  text: string;
}

export interface AIMessageContentImageUrl {
  type: 'image_url';
  image_url: { url: string };
}

export interface AIResponsesInputImage {
  type: 'input_image';
  image_url: string;
}

export interface AIResponsesInputText {
  type: 'input_text';
  text: string;
}

export type { Fact };
