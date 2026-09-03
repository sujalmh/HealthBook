
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
          name: { type: 'string', description: 'Fact name (e.g. Lisinopril, Hemoglobin, Alex Morgan, Blood pressure, Low-sodium diet)' },
          category: { type: 'string', description: 'Category: medication, lab, allergy, condition, demographics, vital, vital_sign, supplement, diet_habit, followup, due_card, question, danger_sign' },
          value: { type: 'string', description: 'Fact value (dosage/text, numeric reading, or detail string)' },
          unit: { type: 'string', description: 'Clinical unit (e.g. mg, mg/dL, mmHg, %, or empty)' },
          date: { type: 'string', description: 'Resolved concrete calendar date YYYY-MM-DD for dated facts (lab draw date, due-card due date, follow-up visit date) — resolve relative schedules using document dates like the discharge date; empty string when not applicable' },
          confidence: { type: 'number', description: 'Confidence score 0..1' },
          plainExplanation: { type: 'string', description: 'Plain language explanation' },
        },
        required: ['name', 'category', 'value', 'unit', 'date', 'confidence', 'plainExplanation'],
        additionalProperties: false,
      },
    },
  },
  required: ['facts'],
  additionalProperties: false,
} as const;

export const STRUCTURED_SCHEMA_NAME = 'clinical_facts';

export function makeStrictSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== 'object') return schema;
  const src = schema as Record<string, unknown>;
  const copy: Record<string, unknown> = Array.isArray(src) ? [...(src as unknown[])] as unknown as Record<string, unknown> : { ...src };

  delete (copy as Record<string, unknown>).minimum;
  delete (copy as Record<string, unknown>).maximum;
  delete (copy as Record<string, unknown>).minLength;
  delete (copy as Record<string, unknown>).maxLength;
  delete (copy as Record<string, unknown>).pattern;

  if (copy.type === 'object') {
    (copy as Record<string, unknown>).additionalProperties = false;
    if (copy.properties && typeof copy.properties === 'object') {
      const newProps: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(copy.properties as Record<string, unknown>)) {
        newProps[k] = makeStrictSchema(v);
      }
      copy.properties = newProps;
      if (!copy.required) {
        copy.required = Object.keys(copy.properties as Record<string, unknown>);
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
  schema: Record<string, unknown> = FACT_EXTRACTION_JSON_SCHEMA as unknown as Record<string, unknown>
): Record<string, unknown> {
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

function cleanJsonString(raw: string): string {
  let s = raw.trim();
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  s = s.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();
  s = s.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '').trim();

  const fenceMatch = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    s = fenceMatch[1].trim();
  }

  s = s.replace(/,\s*([}\]])/g, '$1');

  return s;
}

export function parseJsonContent<T = unknown>(content: string): T | null {
  if (!content || typeof content !== 'string') return null;

  const cleaned = cleanJsonString(content);

  try {
    return JSON.parse(cleaned) as T;
  } catch {  }

  const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let match;
  while ((match = fenceRegex.exec(content)) !== null) {
    if (match[1]) {
      const blockClean = cleanJsonString(match[1]);
      try {
        return JSON.parse(blockClean) as T;
      } catch {  }
    }
  }

  const startObj = cleaned.indexOf('{');
  const endObj = cleaned.lastIndexOf('}');
  if (startObj !== -1 && endObj !== -1 && endObj > startObj) {
    const candidate = cleaned.slice(startObj, endObj + 1).replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(candidate) as T;
    } catch {  }
  }

  const startArr = cleaned.indexOf('[');
  const endArr = cleaned.lastIndexOf(']');
  if (startArr !== -1 && endArr !== -1 && endArr > startArr) {
    const candidate = cleaned.slice(startArr, endArr + 1).replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(candidate) as T;
    } catch {  }
  }

  try {
    const genericMatch = cleaned.match(/"generic"\s*:\s*"([^"]+)"/i);
    if (genericMatch) {
      const confMatch = cleaned.match(/"confidence"\s*:\s*([\d.]+)/i);
      const reasonMatch = cleaned.match(/"reasoning"\s*:\s*"([^"]+)"/i);
      return {
        generic: genericMatch[1],
        confidence: confMatch ? parseFloat(confMatch[1]) : 0.95,
        reasoning: reasonMatch ? reasonMatch[1] : 'Extracted by AI',
      } as unknown as T;
    }
  } catch {  }

  return null;
}

export function extractTextFromProviderResponse(json: unknown, _provider?: AIConfig['provider']): string | null {
  if (!json || typeof json !== 'object') return null;
  const obj = json as Record<string, unknown>;

  if (typeof obj.output_text === 'string' && obj.output_text.trim()) {
    return obj.output_text.trim();
  }

  if (Array.isArray(obj.choices) && obj.choices.length > 0) {
    const choice = obj.choices[0] as Record<string, unknown>;
    const msg = choice?.message as Record<string, unknown> | undefined;
    if (msg?.content !== undefined) {
      const c = msg.content;
      if (typeof c === 'string' && c.trim()) return c.trim();
      if (Array.isArray(c)) {
        const joined = (c as Array<Record<string, unknown>>)
          .map(p => (p.text as string) ?? (p.content as string) ?? '')
          .filter(Boolean)
          .join('\n')
          .trim();
        if (joined) return joined;
      }
    }
    if (typeof choice?.text === 'string' && (choice.text as string).trim()) return (choice.text as string).trim();
  }

  if (typeof obj.output === 'string' && (obj.output as string).trim()) {
    return (obj.output as string).trim();
  }
  if (Array.isArray(obj.output)) {
    for (const item of obj.output as Array<Record<string, unknown>>) {
      if (!item) continue;
      if (item.type === 'message' || item.role === 'assistant') {
        if (typeof item.content === 'string' && (item.content as string).trim()) return (item.content as string).trim();
        if (typeof item.text === 'string' && (item.text as string).trim()) return (item.text as string).trim();
        if (Array.isArray(item.content)) {
          const parts = (item.content as Array<unknown>)
            .map(p => typeof p === 'string' ? p : ((p as Record<string, unknown>)?.text as string ?? (p as Record<string, unknown>)?.content as string ?? ''))
            .filter(Boolean);
          if (parts.length > 0) return (parts as string[]).join('\n').trim();
        }
      }
    }

    for (const item of obj.output as Array<Record<string, unknown>>) {
      if (!item || item.type === 'reasoning' || item.type === 'thought' || item.role === 'thought') continue;
      if (typeof item === 'string' && (item as string).trim()) return (item as string).trim();
      if (typeof item.text === 'string' && (item.text as string).trim()) return (item.text as string).trim();
      if (typeof item.content === 'string' && (item.content as string).trim()) return (item.content as string).trim();
      if (Array.isArray(item.content)) {
        for (const part of item.content as Array<Record<string, unknown>>) {
          if (!part || part.type === 'reasoning' || part.type === 'thought') continue;
          if (typeof part === 'string' && (part as unknown as string).trim()) return part as unknown as string;
          if (typeof part.text === 'string' && (part.text as string).trim()) return (part.text as string).trim();
          if (typeof part.content === 'string' && (part.content as string).trim()) return (part.content as string).trim();
        }
      }
    }
  }

  if (typeof obj.content === 'string' && obj.content.trim()) return obj.content.trim();
  if (typeof obj.text === 'string' && obj.text.trim()) return obj.text.trim();
  if (typeof obj.response === 'string' && obj.response.trim()) return obj.response.trim();
  if (typeof obj.message === 'string' && obj.message.trim()) return obj.message.trim();
  if (typeof obj.result === 'string' && obj.result.trim()) return obj.result.trim();

  return null;
}

export function validateStructuredFacts(data: unknown): { valid: boolean; errors: string[]; facts: AIExtractedFact[] } {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Response must be an object'], facts: [] };
  }

  const obj = data as Record<string, unknown>;
  const rawFacts = Array.isArray(data) ? data as unknown[] : obj.facts as unknown;
  if (!Array.isArray(rawFacts)) {
    return { valid: false, errors: ['facts must be an array'], facts: [] };
  }

  const validFacts: AIExtractedFact[] = [];
  for (let i = 0; i < rawFacts.length; i++) {
    const f = rawFacts[i] as Record<string, unknown>;
    if (!f || typeof f !== 'object') continue;

    const name = typeof f.name === 'string' && f.name.trim() ? f.name.trim() : '';
    const category = typeof f.category === 'string' && f.category.trim() ? f.category.trim().toLowerCase() : 'medication';
    const rawConfidence = typeof f.confidence === 'number' ? f.confidence : 0.85;
    const confidence = Math.max(0.1, Math.min(1.0, Number.isFinite(rawConfidence as number) ? rawConfidence as number : 0.85));
    const plainExplanation = typeof f.plainExplanation === 'string' && (f.plainExplanation as string).trim() ? (f.plainExplanation as string).trim() : `${name} noted.`;
    const unit = typeof f.unit === 'string' ? (f.unit as string).trim() : '';
    const date = typeof f.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test((f.date as string).trim()) ? (f.date as string).trim().slice(0, 10) : '';

    if (!name) {
      errors.push(`facts[${i}].name is missing`);
      continue;
    }

    validFacts.push({
      name,
      category,
      value: (f.value as unknown) ?? name,
      unit,
      date,
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

export const validateStructuredOutput = (data: unknown) => {
  const res = validateStructuredFacts(data);
  return { valid: res.valid, errors: res.errors, parsed: { facts: res.facts } };
};

