/**
 * CareCanvas AI Core — Types
 * Strongly-typed contracts for multimodal AI extraction and knowledge inference.
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
}

export interface AICallOptions {
  schema?: Record<string, any>;
  imageDataUrl?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  docType?: string;
  patientId?: string;
  documentId?: string;
}

export interface AIExtractedFact {
  name: string;
  category: AIFactCategory;
  value: any;
  unit?: string;
  confidence: number;
  plainExplanation: string;
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
