/**
 * CareCanvas AI Core — Structured Outputs & Response Parsing
 * Generates JSON schema parameters and extracts structured output across providers.
 */

import type { AIConfig, AIExtractedFact } from './types.ts';

export const FACT_EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    facts: {
      type: 'array',
      description: 'Extracted clinical facts',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Fact name' },
          category: { type: 'string', description: 'Category: medication, lab, allergy, condition, vital_sign, supplement, diet_habit' },
          value: { type: 'string', description: 'Fact value' },
          unit: { type: 'string', description: 'Clinical unit' },
          confidence: { type: 'number', description: 'Confidence score' },
          plainExplanation: { type: 'string', description: 'Plain explanation' },
        },
        required: ['name', 'category', 'value', 'unit', 'confidence', 'plainExplanation'],
        additionalProperties: false,
      },
    },
  },
  required: ['facts'],
  additionalProperties: false,
};

export const STRUCTURED_SCHEMA_NAME = 'clinical_facts';

export function makeStrictSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;
  const copy = Array.isArray(schema) ? [...schema] : { ...schema };

  // Remove unsupported strict schema properties
  delete copy.minimum;
  delete copy.maximum;
  delete copy.minLength;
  delete copy.maxLength;
  delete copy.pattern;

  if (copy.type === 'object') {
    copy.additionalProperties = false;
    if (copy.properties && typeof copy.properties === 'object') {
      const newProps: Record<string, any> = {};
      for (const [k, v] of Object.entries(copy.properties)) {
        newProps[k] = makeStrictSchema(v);
      }
      copy.properties = newProps;
      if (!copy.required) {
        copy.required = Object.keys(copy.properties);
      }
    }
  } else if (copy.type === 'array' && copy.items) {
    copy.items = makeStrictSchema(copy.items);
  }

  return copy;
}

export function buildStructuredParams(
  provider: AIConfig['provider'],
  useStructured: boolean,
  schema: Record<string, any> = FACT_EXTRACTION_JSON_SCHEMA
): Record<string, any> {
  if (!useStructured) return {};

  if (provider === 'responses') {
    return {
      text: {
        format: {
          type: 'json_schema',
          name: STRUCTURED_SCHEMA_NAME,
          schema: makeStrictSchema(schema),
          strict: true,
        },
      },
    };
  }

  return {
    response_format: { type: 'json_object' },
  };
}

export function parseJsonContent<T = any>(content: string): T | null {
  if (!content || typeof content !== 'string') return null;
  let s = content.trim();

  // Strip markdown code fences if present
  if (s.startsWith('```')) {
    const firstNewline = s.indexOf('\n');
    const lastFence = s.lastIndexOf('```');
    if (firstNewline !== -1 && lastFence !== -1 && lastFence > firstNewline) {
      s = s.slice(firstNewline + 1, lastFence).trim();
    }
  }

  try {
    return JSON.parse(s) as T;
  } catch {
    // Extract first valid JSON object
    const startObj = s.indexOf('{');
    const endObj = s.lastIndexOf('}');
    if (startObj !== -1 && endObj !== -1 && endObj > startObj) {
      try {
        return JSON.parse(s.slice(startObj, endObj + 1)) as T;
      } catch {}
    }

    // Extract first valid JSON array
    const startArr = s.indexOf('[');
    const endArr = s.lastIndexOf(']');
    if (startArr !== -1 && endArr !== -1 && endArr > startArr) {
      try {
        return JSON.parse(s.slice(startArr, endArr + 1)) as T;
      } catch {}
    }

    return null;
  }
}

export function extractTextFromProviderResponse(json: any, provider?: AIConfig['provider']): string | null {
  if (!json || typeof json !== 'object') return null;

  // 1. Direct output_text string
  if (typeof json.output_text === 'string' && json.output_text.trim()) {
    return json.output_text.trim();
  }

  // 2. Chat completions choices format (OpenAI / OpenCode)
  if (Array.isArray(json.choices) && json.choices.length > 0) {
    const choice = json.choices[0];
    if (choice?.message?.content) {
      const c = choice.message.content;
      if (typeof c === 'string' && c.trim()) return c.trim();
      if (Array.isArray(c)) {
        const joined = c
          .map((p: any) => p.text ?? p.content ?? '')
          .filter(Boolean)
          .join('\n')
          .trim();
        if (joined) return joined;
      }
    }
    if (typeof choice?.text === 'string' && choice.text.trim()) return choice.text.trim();
  }

  // 3. Responses API format
  if (typeof json.output === 'string' && json.output.trim()) {
    return json.output.trim();
  }
  if (Array.isArray(json.output)) {
    for (const item of json.output) {
      if (!item) continue;
      if (typeof item === 'string' && item.trim()) return item.trim();
      if (typeof item.text === 'string' && item.text.trim()) return item.text.trim();
      if (typeof item.content === 'string' && item.content.trim()) return item.content.trim();
      if (Array.isArray(item.content)) {
        for (const part of item.content) {
          if (!part) continue;
          if (typeof part === 'string' && part.trim()) return part.trim();
          if (typeof part.text === 'string' && part.text.trim()) return part.text.trim();
          if (typeof part.content === 'string' && part.content.trim()) return part.content.trim();
        }
      }
    }
  }

  // 4. Top-level text/message fallbacks
  if (typeof json.content === 'string' && json.content.trim()) return json.content.trim();
  if (typeof json.text === 'string' && json.text.trim()) return json.text.trim();
  if (typeof json.response === 'string' && json.response.trim()) return json.response.trim();
  if (typeof json.message === 'string' && json.message.trim()) return json.message.trim();
  if (typeof json.result === 'string' && json.result.trim()) return json.result.trim();

  return null;
}

export function validateStructuredFacts(data: any): { valid: boolean; errors: string[]; facts: AIExtractedFact[] } {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Response must be an object'], facts: [] };
  }

  const rawFacts = Array.isArray(data) ? data : data.facts;
  if (!Array.isArray(rawFacts)) {
    return { valid: false, errors: ['facts must be an array'], facts: [] };
  }

  const validFacts: AIExtractedFact[] = [];
  for (let i = 0; i < rawFacts.length; i++) {
    const f = rawFacts[i];
    if (!f || typeof f !== 'object') continue;

    const name = typeof f.name === 'string' && f.name.trim() ? f.name.trim() : '';
    const category = typeof f.category === 'string' && f.category.trim() ? f.category.trim().toLowerCase() : 'medication';
    const rawConfidence = typeof f.confidence === 'number' ? f.confidence : 0.85;
    const confidence = Math.max(0.1, Math.min(1.0, Number.isFinite(rawConfidence) ? rawConfidence : 0.85));
    const plainExplanation = typeof f.plainExplanation === 'string' && f.plainExplanation.trim() ? f.plainExplanation.trim() : `${name} noted.`;
    const unit = typeof f.unit === 'string' ? f.unit.trim() : '';

    if (!name) {
      errors.push(`facts[${i}].name is missing`);
      continue;
    }

    validFacts.push({
      name,
      category,
      value: f.value ?? name,
      unit,
      confidence: Math.round(confidence * 100) / 100,
      plainExplanation,
    });
  }

  return {
    valid: errors.length === 0 && validFacts.length > 0,
    errors,
    facts: validFacts,
  };
}

// Backward compatibility alias for existing consumers
export const validateStructuredOutput = (data: any) => {
  const res = validateStructuredFacts(data);
  return { valid: res.valid, errors: res.errors, parsed: { facts: res.facts } };
};
