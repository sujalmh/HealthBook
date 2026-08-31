/**
 * CareCanvas AI Core — Structured
 * Generic structured JSON handling via response_format {type: json_object}
 * vs text.format {type: json_schema} generically (not tied to single provider field).
 * Includes validation generically — Zod-like manual validation (stdlib only, no external dep).
 */

import type { AIConfig } from './types.ts';

// Generic structured schema for fact extraction — strict mode requires additionalProperties:false at every object level
export const FACT_EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    facts: {
      type: 'array',
      description: 'Extracted clinical facts',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Fact name, e.g., Apixaban, Creatinine' },
          category: {
            type: 'string',
            enum: ['medication', 'lab', 'allergy', 'condition', 'vital_sign', 'supplement', 'diet_habit'],
            description: 'Typed category',
          },
          // Strict requires explicit type — use string for value, AI should stringify numbers/objects
          value: { type: 'string', description: 'Fact value as string — e.g., "13.8" or "10 mg daily" or JSON-stringified object' },
          unit: { type: 'string', description: 'Unit normalized, e.g., mg/dL, mEq/L' },
          confidence: { type: 'number', minimum: 0, maximum: 1, description: 'Confidence 0-1' },
          plainExplanation: { type: 'string', description: 'Plain language explanation' },
        },
        required: ['name', 'category', 'value', 'confidence', 'plainExplanation'],
        additionalProperties: false,
      },
    },
  },
  required: ['facts'],
  additionalProperties: false,
};

// Lightweight JSON schema name
export const STRUCTURED_SCHEMA_NAME = 'fact_extraction';

// For chat: response_format json_object
export function buildChatStructuredParams(useStructured: boolean): Record<string, any> {
  if (!useStructured) return {};
  // generic structured mode not tied to single provider field — response_format for chat
  return {
    response_format: { type: 'json_object' },
  };
}

// For responses: text.format json_schema
export function buildResponsesStructuredParams(useStructured: boolean, schema: any = FACT_EXTRACTION_JSON_SCHEMA): Record<string, any> {
  if (!useStructured) return {};
  // generic structured mode — text.format for responses
  return {
    text: {
      format: {
        type: 'json_schema',
        name: STRUCTURED_SCHEMA_NAME,
        schema,
        strict: true,
      },
    },
  };
}

/**
 * Generic structured params builder branching via provider.
 */
export function buildStructuredParams(
  provider: AIConfig['provider'],
  useStructured: boolean,
  schema: any = FACT_EXTRACTION_JSON_SCHEMA
): Record<string, any> {
  if (provider === 'responses') {
    return buildResponsesStructuredParams(useStructured, schema);
  }
  return buildChatStructuredParams(useStructured);
}

/**
 * Validate structured output — Zod validation generically (stdlib manual).
 * Checks facts array shape, confidence>0, etc. (bbox removed)
 * Returns { valid, errors, parsed }
 */
export function validateStructuredOutput(data: any): { valid: boolean; errors: string[]; parsed: any } {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Root must be object'], parsed: null };
  }
  // Handle both {facts: [...]} and direct array
  const facts = Array.isArray(data) ? data : data.facts;
  if (!Array.isArray(facts)) {
    return { valid: false, errors: ['facts must be array'], parsed: null };
  }
  for (let i = 0; i < facts.length; i++) {
    const f = facts[i];
    if (!f.name || typeof f.name !== 'string' || f.name.trim().length === 0) {
      errors.push(`facts[${i}].name missing`);
    }
    if (!f.category || typeof f.category !== 'string') {
      errors.push(`facts[${i}].category missing`);
    }
    if (f.confidence === undefined || typeof f.confidence !== 'number' || f.confidence <= 0 || f.confidence > 1) {
      errors.push(`facts[${i}].confidence must be >0 and <=1`);
    }
    if (!f.plainExplanation || typeof f.plainExplanation !== 'string' || f.plainExplanation.trim().length === 0) {
      errors.push(`facts[${i}].plainExplanation missing`);
    }
    if (f.unit !== undefined && typeof f.unit !== 'string') {
      errors.push(`facts[${i}].unit must be string`);
    }
  }
  return { valid: errors.length === 0, errors, parsed: { facts } };
}

/**
 * Try to parse JSON string robustly — handles markdown code fences.
 */
export function parseJsonContent(content: string): any {
  if (!content || typeof content !== 'string') return null;
  let s = content.trim();
  // Strip markdown fences if present
  if (s.startsWith('```')) {
    const firstNewline = s.indexOf('\n');
    const lastFence = s.lastIndexOf('```');
    if (firstNewline !== -1 && lastFence !== -1 && lastFence > firstNewline) {
      s = s.slice(firstNewline + 1, lastFence).trim();
    }
  }
  try {
    return JSON.parse(s);
  } catch {
    // Try to extract first JSON object
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(s.slice(start, end + 1));
      } catch {}
    }
    // Try array
    const aStart = s.indexOf('[');
    const aEnd = s.lastIndexOf(']');
    if (aStart !== -1 && aEnd !== -1 && aEnd > aStart) {
      try {
        return JSON.parse(s.slice(aStart, aEnd + 1));
      } catch {}
    }
    return null;
  }
}

/**
 * Extract text content from provider-specific response shapes.
 * Handles chat: choices[0].message.content
 * Handles responses: output[0].content[0].text or output_text
 */
export function extractTextFromProviderResponse(json: any, provider: AIConfig['provider']): string | null {
  if (!json || typeof json !== 'object') return null;
  // Chat completions
  if (provider === 'chat' || json.choices) {
    const choice = json.choices?.[0];
    if (choice?.message?.content) {
      const c = choice.message.content;
      if (typeof c === 'string') return c;
      if (Array.isArray(c)) {
        // content may be array with text parts
        return c
          .map((p: any) => p.text ?? p.content ?? '')
          .join('\n')
          .trim();
      }
    }
    if (choice?.text) return choice.text;
  }
  // Responses API
  if (provider === 'responses' || json.output) {
    if (typeof json.output_text === 'string' && json.output_text.trim() !== '') return json.output_text;
    if (Array.isArray(json.output)) {
      for (const item of json.output) {
        if (item?.content && Array.isArray(item.content)) {
          for (const part of item.content) {
            if (part.type === 'output_text' && part.text) return part.text;
            if (part.type === 'text' && part.text) return part.text;
          }
        }
      }
    }
  }
  // Fallback generic search
  if (typeof json.content === 'string') return json.content;
  if (typeof json.text === 'string') return json.text;
  return null;
}
