
import type {
  InteractionArc,
  DietBadge,
  DuplicateIngredientAlert,
  ScheduleSuggestionResult,
  MissedDoseSimulationResult,
  TimeSlot,
  DayOfWeek
} from '../../types/pillmap.ts';
import { callAI } from '../ai/client.ts';
import { isHealthGroundingAvailable } from '../search/healthGrounding.ts';
import { searchExa } from '../search/exaClient.ts';
import {
  INTERACTION_ENGINE_VERSION,
  deterministicArcId,
  deterministicDuplicateId,
} from './interactionCache.ts';

export const ENGINE_VERSION = INTERACTION_ENGINE_VERSION;

export class AIUnavailableError extends Error {
  public readonly code: 'AI_UNAVAILABLE' | 'AI_FAILED';
  constructor(message: string, code: 'AI_UNAVAILABLE' | 'AI_FAILED' = 'AI_FAILED') {
    super(message);
    this.name = 'AIUnavailableError';
    this.code = code;
  }
}

function toAIError(err: unknown, context: string): AIUnavailableError {
  const msg = err instanceof Error ? err.message : String(err);
  const code = /disabled|unconfigured|API key/i.test(msg) ? 'AI_UNAVAILABLE' : 'AI_FAILED';
  return new AIUnavailableError(`${context}: ${msg}`, code);
}

async function callKnowledgeAI(
  systemPrompt: string,
  userText: string,
  jsonSchema: any
): Promise<any | null> {
  try {
    return await callAI<any>(systemPrompt, userText, { schema: jsonSchema });
  } catch (err) {
    console.warn('[interactionEngine] AI knowledge call failed:', (err as any)?.message || err);
    return null;
  }
}

function severityToArcColor(severity: string): string {
  const s = (severity || '').toUpperCase();
  if (s === 'CONTRAINDICATED') return '#EF4444';
  if (s === 'MAJOR') return '#F97316';
  if (s === 'MODERATE') return '#EAB308';
  return '#22C55E';
}

function severityToPlateColor(severity: string): string {
  return severityToArcColor(severity);
}

function isVitest(): boolean {
  return typeof process !== 'undefined' && (process as any).env?.VITEST === 'true';
}

export interface DietFlagsInput {
  drinksGrapefruitDaily?: boolean;
  frequentHighVitKGreens?: boolean;
  dairyBreakfast?: boolean;
  usesPotassiumSaltSubstitute?: boolean;
  alcoholFrequency?: string;
}

export function normalizeMedName(name: string): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export class ClinicalInteractionEngine {

  public static async resolveGenericName(drugName: string): Promise<string> {
    const trimmed = (drugName || '').trim();
    if (!trimmed) return trimmed;
    const schema = {
      type: 'object',
      properties: {
        generic: { type: 'string', description: 'Resolved generic name' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reasoning: { type: 'string' }
      },
      required: ['generic', 'confidence', 'reasoning'],
      additionalProperties: false,
    } as any;
    const systemPrompt = `You are a clinical pharmacology assistant. Resolve the generic name for a given drug brand or generic alias. Return ONLY valid JSON with shape {"generic": string, "confidence": number, "reasoning": string}. Be precise, handle compounds like "Apixaban (Eliquis)" -> "Apixaban". No markdown.`;
    try {
      const parsed = await callKnowledgeAI(systemPrompt, `Drug name: "${trimmed}"\nReturn JSON only.`, schema);
      if (parsed && typeof parsed.generic === 'string' && parsed.generic.trim() !== '') {
        return parsed.generic.trim();
      }
      throw new AIUnavailableError(`Could not resolve a generic name for "${trimmed}"`);
    } catch (e) {
      if (e instanceof AIUnavailableError) throw e;
      throw toAIError(e, 'Generic-name resolution failed');
    }
  }

  public static async resolveGenerics(names: string[]): Promise<Record<string, string>> {
    const unique = [...new Set((names || []).map((n) => (n || '').trim()).filter(Boolean))];
    if (unique.length === 0) return {};
    const schema = {
      type: 'object',
      properties: {
        mappings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              input: { type: 'string' },
              generic: { type: 'string' },
            },
            required: ['input', 'generic'],
            additionalProperties: false,
          },
        },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reasoning: { type: 'string' },
      },
      required: ['mappings', 'confidence', 'reasoning'],
      additionalProperties: false,
    } as any;
    const systemPrompt = `You are a clinical pharmacology assistant. Resolve the generic names for each of the following medications. Handle brand/generic aliases and compounds like "Apixaban (Eliquis)" -> "Apixaban". Return ONLY valid JSON with shape {"mappings": [{"input": string, "generic": string}], "confidence": number, "reasoning": string}. Echo each input exactly. No markdown.`;
    try {
      const parsed = await callKnowledgeAI(systemPrompt, `Medications: ${JSON.stringify(unique)}\nReturn JSON only.`, schema);
      const map: Record<string, string> = {};
      if (parsed && Array.isArray(parsed.mappings)) {
        for (const m of parsed.mappings) {
          if (m && typeof m.input === 'string' && typeof m.generic === 'string' && m.generic.trim() !== '') {
            map[m.input] = m.generic.trim();
          }
        }
      }
      for (const n of unique) {
        if (!map[n]) map[n] = n;
      }
      return map;
    } catch (e) {
      if (e instanceof AIUnavailableError) throw e;
      throw toAIError(e, 'Batch generic-name resolution failed');
    }
  }

  public static async checkDrugInteractions(medNames: string[]): Promise<InteractionArc[]> {
    const list = (medNames || []).map((n) => (n || '').trim()).filter(Boolean);
    if (list.length < 2) return [];

    let exaContext = '';
    if (!isVitest() && await isHealthGroundingAvailable()) {
      try {
        const q = `drug interaction ${list.join(' ')} mechanism severity guidance`;
        const exaRes = await searchExa({ query: q, type: 'auto', numResults: 2, contents: { highlights: true }, systemPrompt: 'Prefer authoritative drug monographs (FDA, NIH, PubMed).' });
        exaContext = exaRes.results.flatMap(r => r.highlights || []).slice(0, 3).join(' | ').slice(0, 800);
      } catch {}
    }
    const schema = {
      type: 'object',
      properties: {
        interactions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              drugA: { type: 'string' },
              drugB: { type: 'string' },
              severity: { type: 'string', enum: ['CONTRAINDICATED', 'MAJOR', 'MODERATE', 'MINOR'] },
              mechanism: { type: 'string' },
              clinicalGuidance: { type: 'string' },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              arcColor: { type: 'string' },
              reasoning: { type: 'string' }
            },
            required: ['drugA', 'drugB', 'severity', 'mechanism', 'clinicalGuidance', 'confidence', 'arcColor', 'reasoning'],
            additionalProperties: false,
          }
        }
      },
      required: ['interactions'],
      additionalProperties: false,
    } as any;
    const systemPrompt = `You are a clinical pharmacology specialist. Analyze drug-drug interactions for the provided medication list. Consider brand/generic aliases, mechanisms (e.g., CYP450, bleeding risk, additive hypotension, potassium retention, chelation), severity grading, and clinical guidance. Use the provided Exa highlights as grounding when available. Grading rubric — CONTRAINDICATED only for label-contraindicated co-use; MAJOR for avoid-combinations (dual anticoagulation, serotonergic crisis risk, strong CYP3A4/P-gp induction collapsing DOAC levels, ACEi plus potassium-retaining drugs); MODERATE for monitor-and-manage pairs (dose-dependent fish-oil bleed risk, ACE inhibitor plus NSAID renal effects, ginkgo plus warfarin, levothyroxine plus calcium/iron separation issues). Prefer MAJOR over CONTRAINDICATED unless co-use is never acceptable. Return ONLY valid JSON with shape {"interactions": [{"drugA": string, "drugB": string, "severity": string, "mechanism": string, "clinicalGuidance": string, "confidence": number, "reasoning": string}]}. Include confidence 0-1 and grounded reasoning per interaction. No markdown.`;
    const userText = `Medications: ${JSON.stringify(list)}${exaContext ? `\nExa evidence highlights: ${exaContext}` : ''}\nProvide JSON only with AI reasoning and confidence.`;
    try {
      const parsed = await callKnowledgeAI(systemPrompt, userText, schema);
      if (parsed && Array.isArray(parsed.interactions)) {
        return parsed.interactions.map((it: any) => ({
          id: deterministicArcId(it.drugA || 'drugA', it.drugB || 'drugB', it.severity || 'MODERATE', it.mechanism || it.reasoning || 'AI-assessed'),
          drugA: it.drugA,
          drugB: it.drugB,
          severity: (it.severity || 'MODERATE') as any,
          arcColor: it.arcColor || severityToArcColor(it.severity),
          mechanism: it.mechanism || it.reasoning || 'AI-assessed interaction mechanism',
          clinicalGuidance: it.clinicalGuidance || 'Consult clinician for monitoring guidance.',
          affectedSlots: [{ day: 'monday', slot: 'morning' }],
          ...(it.confidence !== undefined ? { confidence: it.confidence } : {}),
        } as any));
      }
      throw new AIUnavailableError('Drug interaction analysis returned no usable result');
    } catch (e) {
      if (e instanceof AIUnavailableError) throw e;
      throw toAIError(e, 'Drug interaction analysis failed');
    }
  }

  public static async checkDietInteractions(
    medNames: string[],
    patientDiet: DietFlagsInput
  ): Promise<DietBadge[]> {
    const list = (medNames || []).map((n) => (n || '').trim()).filter(Boolean);
    if (list.length === 0) return [];
    let exaContext = '';
    if (!isVitest() && await isHealthGroundingAvailable()) {
      try {
        const q = `drug food interaction ${list.join(' ')} diet ${JSON.stringify(patientDiet)}`;
        const exaRes = await searchExa({ query: q, type: 'auto', numResults: 2, contents: { highlights: true }, systemPrompt: 'Prefer authoritative nutrition-pharmacology sources.' });
        exaContext = exaRes.results.flatMap(r => r.highlights || []).slice(0, 2).join(' | ').slice(0, 600);
      } catch {}
    }
    const schema = {
      type: 'object',
      properties: {
        dietInteractions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              drugName: { type: 'string' },
              dietItem: { type: 'string' },
              severity: { type: 'string', enum: ['CONTRAINDICATED', 'MAJOR', 'MODERATE'] },
              badgeText: { type: 'string' },
              plateArcColor: { type: 'string' },
              mechanism: { type: 'string' },
              clinicalGuidance: { type: 'string' },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              reasoning: { type: 'string' }
            },
            required: ['drugName', 'dietItem', 'severity', 'badgeText', 'plateArcColor', 'mechanism', 'clinicalGuidance', 'confidence', 'reasoning'],
            additionalProperties: false,
          }
        }
      },
      required: ['dietInteractions'],
      additionalProperties: false,
    } as any;
    const systemPrompt = `You are a clinical nutrition-pharmacology specialist. Analyze drug-diet interactions for the medication list and patient diet profile (grapefruit daily, Vit K greens, dairy breakfast, potassium salt substitutes, alcohol). Use Exa highlights when provided. Reference points: atorvastatin plus grapefruit — a typical glass raises levels ~37%, only excessive intake above ~1.2L/day matters (moderate, dose-aware, not absolute avoidance); simvastatin plus grapefruit is stricter (major, avoid); levothyroxine needs an empty stomach 30-60 minutes before breakfast with calcium/iron separated by 4 hours; metronidazole plus alcohol is contraindicated during therapy and for 3 days after (including propylene glycol); warfarin needs consistent vitamin K intake, not elimination; ACE inhibitors plus potassium salt substitutes risk hyperkalemia. Return ONLY valid JSON with shape {"dietInteractions": [{"drugName": string, "dietItem": string, "severity": string, "badgeText": string, "plateArcColor": string, "mechanism": string, "clinicalGuidance": string, "confidence": number, "reasoning": string}]}. Include grounded reasoning and confidence per badge. No markdown.`;
    try {
      const parsed = await callKnowledgeAI(systemPrompt, `Meds: ${JSON.stringify(list)}\nDiet: ${JSON.stringify(patientDiet)}${exaContext ? `\nExa highlights: ${exaContext}` : ''}\nReturn JSON only.`, schema);
      if (parsed && Array.isArray(parsed.dietInteractions)) {
        return parsed.dietInteractions.map((b: any) => ({
          id: `diet_${(b.drugName || 'drug').replace(/[^a-z0-9]/gi, '_')}_${(b.dietItem || 'diet').replace(/[^a-z0-9]/gi, '_')}`,
          drugName: b.drugName,
          dietItem: b.dietItem,
          severity: b.severity,
          badgeText: b.badgeText,
          plateArcColor: b.plateArcColor || severityToPlateColor(b.severity),
          mechanism: b.mechanism || b.reasoning,
          clinicalGuidance: b.clinicalGuidance,
        } as DietBadge));
      }
      throw new AIUnavailableError('Drug-diet analysis returned no usable result');
    } catch (e) {
      if (e instanceof AIUnavailableError) throw e;
      throw toAIError(e, 'Drug-diet analysis failed');
    }
  }

  public static async checkDuplicateIngredients(meds: { name: string; dose?: string }[]): Promise<DuplicateIngredientAlert[]> {
    const list = (meds || []).filter((m) => m && m.name && m.name.trim() !== '');
    if (list.length < 2) return [];
    const schema = {
      type: 'object',
      properties: {
        duplicateAlerts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              ingredient: { type: 'string' },
              drugsInvolved: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, dose: { type: 'string' }, ingredientAmountMg: { type: 'number' } } } },
              totalCumulativeDoseMg: { type: 'number' },
              maxSafeDailyDoseMg: { type: 'number' },
              isOverLimit: { type: 'boolean' },
              plainNarration: { type: 'string' },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              reasoning: { type: 'string' }
            },
            required: ['ingredient', 'drugsInvolved', 'totalCumulativeDoseMg', 'maxSafeDailyDoseMg', 'isOverLimit', 'plainNarration', 'confidence', 'reasoning'],
            additionalProperties: false,
          }
        }
      },
      required: ['duplicateAlerts'],
      additionalProperties: false,
    } as any;
    const systemPrompt = `You are a clinical pharmacy specialist. Detect duplicate active ingredients across brand/generic meds (e.g., Acetaminophen in Tylenol plus Percocet, Ibuprofen overlap, NSAID class co-use). Compute cumulative mg and max safe dose, flag over-limit. Reference ceilings: acetaminophen 4000mg per 24h across all sources, ibuprofen prescription max 3200mg per day, atorvastatin max 80mg per day, metformin max 2550mg per day. Same-class pairs (e.g. two NSAIDs) count as duplication even without shared molecules. For class-level duplicates, narrate counts of medicines rather than milligrams. Return ONLY valid JSON with shape {"duplicateAlerts": [{"ingredient": string, "drugsInvolved": [{"name": string, "dose": string, "ingredientAmountMg": number}], "totalCumulativeDoseMg": number, "maxSafeDailyDoseMg": number, "isOverLimit": boolean, "plainNarration": string, "confidence": number, "reasoning": string}]}. Include confidence and grounded reasoning. No markdown.`;
    try {
      const parsed = await callKnowledgeAI(systemPrompt, `Meds: ${JSON.stringify(list)}\nReturn JSON only.`, schema);
      if (parsed && Array.isArray(parsed.duplicateAlerts)) {
        return parsed.duplicateAlerts.map((a: any) => ({
          id: deterministicDuplicateId(a.ingredient || 'ing', (a.drugsInvolved || []).map((d: any) => d?.name || 'drug')),
          ingredient: a.ingredient,
          drugsInvolved: a.drugsInvolved,
          totalCumulativeDoseMg: a.totalCumulativeDoseMg,
          maxSafeDailyDoseMg: a.maxSafeDailyDoseMg,
          isOverLimit: a.isOverLimit,
          plainNarration: a.plainNarration || (a.reasoning ? `${a.ingredient}: ${a.reasoning}` : `Duplicate ${a.ingredient}`),
        } as DuplicateIngredientAlert));
      }
      throw new AIUnavailableError('Duplicate-ingredient analysis returned no usable result');
    } catch (e) {
      if (e instanceof AIUnavailableError) throw e;
      throw toAIError(e, 'Duplicate-ingredient analysis failed');
    }
  }

  public static async suggestSchedule(
    meds: { id: string; name: string; currentSlot: TimeSlot }[],
    chronotype: 'early_bird' | 'night_owl' | 'standard' = 'standard'
  ): Promise<ScheduleSuggestionResult> {
    const list = (meds || []).filter((m) => m && m.name);
    if (list.length === 0) {
      return { chronotype, proposedShifts: [], resolvedConflictsCount: 0, plainExplanation: 'No medications to schedule.' };
    }
    const schema = {
      type: 'object',
      properties: {
        proposedShifts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              medId: { type: 'string' },
              medName: { type: 'string' },
              fromSlot: { type: 'string', enum: ['morning', 'noon', 'evening', 'bedtime'] },
              toSlot: { type: 'string', enum: ['morning', 'noon', 'evening', 'bedtime'] },
              reason: { type: 'string' },
              confidence: { type: 'number', minimum: 0, maximum: 1 }
            },
            required: ['medId', 'medName', 'fromSlot', 'toSlot', 'reason', 'confidence'],
            additionalProperties: false,
          }
        },
        resolvedConflictsCount: { type: 'number' },
        plainExplanation: { type: 'string' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reasoning: { type: 'string' }
      },
      required: ['proposedShifts', 'resolvedConflictsCount', 'plainExplanation', 'confidence', 'reasoning'],
      additionalProperties: false,
    } as any;
    const systemPrompt = `You are a clinical chronotherapy specialist. Given medications with current time slots and patient chronotype, suggest personalized timing shifts to optimize efficacy and minimize interactions (e.g., statins at bedtime for overnight cholesterol synthesis, diuretics in the morning to prevent nighttime urination, separate calcium from levothyroxine by 4 hours). Return ONLY valid JSON with shape {"proposedShifts": [{"medId": string, "medName": string, "fromSlot": string, "toSlot": string, "reason": string, "confidence": number}], "resolvedConflictsCount": number, "plainExplanation": string, "confidence": number}. Include confidence and grounded reasoning per shift. No markdown.`;
    try {
      const parsed = await callKnowledgeAI(systemPrompt, `Meds: ${JSON.stringify(list)}\nChronotype: ${chronotype}\nReturn JSON only.`, schema);
      if (parsed && Array.isArray(parsed.proposedShifts)) {
        return {
          chronotype,
          proposedShifts: parsed.proposedShifts.map((s: any) => ({
            medId: s.medId,
            medName: s.medName,
            fromSlot: s.fromSlot,
            toSlot: s.toSlot,
            reason: s.reason,
          })),
          resolvedConflictsCount: parsed.resolvedConflictsCount ?? parsed.proposedShifts.length,
          plainExplanation: parsed.plainExplanation || `Optimized schedule for ${chronotype.replace('_', ' ')}.`,
        };
      }
      throw new AIUnavailableError('Schedule analysis returned no usable result');
    } catch (e) {
      if (e instanceof AIUnavailableError) throw e;
      throw toAIError(e, 'Schedule analysis failed');
    }
  }

  public static async simulateAdherence(medName: string, missedSlot: { day: DayOfWeek; slot: TimeSlot }): Promise<MissedDoseSimulationResult> {
    const name = (medName || '').trim();
    if (!name) throw new AIUnavailableError('Medication name is required for adherence simulation');
    const schema = {
      type: 'object',
      properties: {
        medName: { type: 'string' },
        clinicalImpactSummary: { type: 'string' },
        projectedBiomarkerDelta: {
          type: 'object',
          properties: {
            biomarker: { type: 'string' },
            estimatedChange: { type: 'string' },
          },
          required: ['biomarker', 'estimatedChange'],
          additionalProperties: false,
        },
        recoveryProtocol: { type: 'string' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reasoning: { type: 'string' },
      },
      required: ['medName', 'clinicalImpactSummary', 'recoveryProtocol', 'confidence', 'reasoning'],
      additionalProperties: false,
    } as any;
    const systemPrompt = `You are a clinical pharmacology educator. A patient missed a dose of the given medication. Estimate the clinical impact in plain language, the likely biomarker change with units, and a safe recovery protocol. Rules: NEVER advise taking two doses at once — the recovery protocol must say to take the missed dose as soon as remembered unless close to the next dose, and never double up. Consider drug half-life and indication (e.g., anticoagulants lose protection within hours; blood-pressure meds rebound; metformin raises glucose). Return ONLY valid JSON with shape {"medName": string, "clinicalImpactSummary": string, "projectedBiomarkerDelta": {"biomarker": string, "estimatedChange": string}, "recoveryProtocol": string, "confidence": number, "reasoning": string}. No markdown.`;
    try {
      const parsed = await callKnowledgeAI(systemPrompt, `Medication: ${name}\nMissed: ${missedSlot.day} ${missedSlot.slot}\nReturn JSON only.`, schema);
      if (parsed && typeof parsed.clinicalImpactSummary === 'string' && typeof parsed.recoveryProtocol === 'string') {
        return {
          medName: parsed.medName || name,
          missedSlot,
          clinicalImpactSummary: parsed.clinicalImpactSummary,
          projectedBiomarkerDelta: parsed.projectedBiomarkerDelta,
          recoveryProtocol: parsed.recoveryProtocol,
          doNotDoubleDoseWarning: true,
        };
      }
      throw new AIUnavailableError(`Adherence simulation returned no usable result for "${name}"`);
    } catch (e) {
      if (e instanceof AIUnavailableError) throw e;
      throw toAIError(e, 'Adherence simulation failed');
    }
  }
}

