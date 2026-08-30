/**
 * CareCanvas AI Core — Types
 * Generic typed contracts for multimodal extraction.
 * Vision+text single response + structured JSON generically.
 */

import type { Fact, BoundingBox } from '../../types/vault.ts';

export type AIProvider = 'chat' | 'responses';

export type AIFactCategory = 'medication' | 'lab' | 'allergy' | 'condition' | 'vital_sign' | 'supplement' | 'diet_habit' | string;

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

export interface AIBoundingBox extends BoundingBox {}

export interface AIExtractedFactInput {
  name: string;
  category: AIFactCategory;
  value: any;
  unit?: string;
  confidence: number;
  plainExplanation: string;
  boundingBox: AIBoundingBox;
  factKey?: string;
}

export interface AIExtractionRequest {
  rawText: string;
  imageDataUrl?: string;
  docType?: string;
  categories?: AIFactCategory[];
}

export interface AIExtractionResponse {
  facts: AIExtractedFactInput[];
  rawResponse?: any;
}

export interface AIStructuredExtractionPayload {
  facts: Array<{
    name: string;
    category: string;
    value: any;
    unit: string;
    confidence: number;
    plainExplanation: string;
    boundingBox: { pageIndex: number; x: number; y: number; width: number; height: number };
  }>;
}

// Re-export Fact for consumer convenience
export type ExtractedFact = Fact;

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
