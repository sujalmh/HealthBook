
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
export type DietFlags = DietFlagsInput;

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
    const systemPrompt = `You are a clinical pharmacology assistant. Resolve the generic name for a given drug brand or generic alias. Map proprietary trade names to their standard international non-proprietary generic counterparts. Return ONLY valid JSON with shape {"generic": string, "confidence": number, "reasoning": string}. Be precise. No markdown.`;
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
    const systemPrompt = `You are a clinical pharmacology assistant. Resolve the generic names for each of the following medications. Map brand and proprietary trade names to their standard international non-proprietary generic counterparts. Return ONLY valid JSON with shape {"mappings": [{"input": string, "generic": string}], "confidence": number, "reasoning": string}. Echo each input exactly. No markdown.`;
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
    const systemPrompt = `You are a clinical pharmacology specialist. Analyze drug-drug interactions for the provided medication list based on evidence-based pharmacology principles. Consider pharmacokinetic pathways (absorption, CYP450 metabolism, transport, renal excretion) and pharmacodynamic effects (additive toxicity, antagonism, synergy). Use Exa highlights as grounding when available.

Severity Grading Rubric:
- CONTRAINDICATED: Strictly prohibited co-administration due to life-threatening risks or catastrophic toxicity.
- MAJOR: Clinically significant combinations with high risk of adverse events or substantial loss of therapeutic efficacy that require avoiding the combination or selecting alternative therapy.
- MODERATE: Interactions that require clinical monitoring, dosage adjustments, or separation of administration timing.
- MINOR: Negligible or theoretical interactions without meaningful clinical consequence; do NOT report MINOR interactions.

Clinical Pragmatism Guidelines:
- Exercise clinical judgment and avoid hyper-skepticism or alarmism.
- Do NOT flag routine, guideline-directed, standard-of-care co-prescriptions (such as complementary multi-drug regimens for hypertension, diabetes, secondary cardiovascular prevention, or heart failure) as adverse conflicts unless an evidence-based severe contraindication exists.
- Exclude theoretical interactions lacking documented clinical consequence.
- Return ONLY clinically actionable interactions with confidence >= 0.70.

Return ONLY valid JSON with shape {"interactions": [{"drugA": string, "drugB": string, "severity": string, "mechanism": string, "clinicalGuidance": string, "confidence": number, "reasoning": string}]}. Include confidence 0-1 and grounded clinical reasoning. No markdown.`;
    const userText = `Medications: ${JSON.stringify(list)}${exaContext ? `\nExa evidence highlights: ${exaContext}` : ''}\nProvide JSON only with AI reasoning and confidence.`;
    try {
      const parsed = await callKnowledgeAI(systemPrompt, userText, schema);
      if (parsed && Array.isArray(parsed.interactions)) {
        return parsed.interactions
          .filter((it: any) => {
            if (!it || !it.drugA || !it.drugB) return false;
            const sev = (it.severity || '').toUpperCase();
            if (sev === 'MINOR') return false;
            if (typeof it.confidence === 'number' && it.confidence < 0.70) return false;
            return true;
          })
          .map((it: any) => ({
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
    const systemPrompt = `You are a clinical nutrition-pharmacology specialist. Analyze drug-diet and food-drug interactions for the provided medication list and patient diet profile based on verified clinical nutrition and pharmacokinetic principles. Consider food effects on bioavailability, nutrient-drug binding/chelation, dietary enzyme/transporter modulation, electrolyte balance, and metabolic incompatibility. Use Exa highlights when provided.

Severity Grading Rubric:
- CONTRAINDICATED: Severe or hazardous food/beverage incompatibility requiring strict avoidance.
- MAJOR: Clinically significant interaction requiring strict dietary avoidance or medication substitution.
- MODERATE: Meaningful interaction manageable via meal timing, consistent dietary intake, or routine monitoring.

Clinical Pragmatism Guidelines:
- Report only clinically meaningful dietary interactions that warrant actionable patient lifestyle guidance or specific meal separation timing.
- Do not flag trivial, non-actionable, or unproven food interactions.
- Return ONLY interactions with confidence >= 0.70.

Return ONLY valid JSON with shape {"dietInteractions": [{"drugName": string, "dietItem": string, "severity": string, "badgeText": string, "plateArcColor": string, "mechanism": string, "clinicalGuidance": string, "confidence": number, "reasoning": string}]}. Include grounded reasoning and confidence per badge. No markdown.`;
    try {
      const parsed = await callKnowledgeAI(systemPrompt, `Meds: ${JSON.stringify(list)}\nDiet: ${JSON.stringify(patientDiet)}${exaContext ? `\nExa highlights: ${exaContext}` : ''}\nReturn JSON only.`, schema);
      if (parsed && Array.isArray(parsed.dietInteractions)) {
        return parsed.dietInteractions
          .filter((b: any) => b && b.drugName && b.dietItem && (typeof b.confidence !== 'number' || b.confidence >= 0.70))
          .map((b: any) => ({
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
    const systemPrompt = `You are a clinical pharmacy specialist. Evaluate medication lists to detect duplicate active chemical ingredients across brand and generic products, as well as redundant same-class therapeutic duplications that increase toxicity risk without incremental benefit.
Clinical Principles:
1. Active Ingredient Duplication: Identify when multiple products contain the identical active moiety (e.g., a single-ingredient drug co-prescribed with a combination product containing the same molecule). Compute the cumulative daily dose and compare against standard maximum daily dosing ceilings established in clinical pharmacopeias. Flag as over-limit only when the combined total exceeds established maximum daily dosage guidelines.
2. Therapeutic Class Duplication: Flag co-prescriptions within the same narrow pharmacological class where co-administration is contraindicated or clinically redundant (e.g., multiple systemic agents of the same class causing additive organ toxicity).
3. Distinguish Rational Multi-Therapy: Do NOT flag intentional, guideline-directed combination regimens with complementary mechanisms of action as duplicates.
4. Confidence & Objectivity: Provide an objective confidence score (0.00 to 1.00) and grounded pharmacological rationale. For class-level duplications where milligram equivalencies are not directly additive, narrate medicine counts and clinical risk.

Return ONLY valid JSON with shape {"duplicateAlerts": [{"ingredient": string, "drugsInvolved": [{"name": string, "dose": string, "ingredientAmountMg": number}], "totalCumulativeDoseMg": number, "maxSafeDailyDoseMg": number, "isOverLimit": boolean, "plainNarration": string, "confidence": number, "reasoning": string}]}. No markdown.`;
    try {
      const parsed = await callKnowledgeAI(systemPrompt, `Meds: ${JSON.stringify(list)}\nReturn JSON only.`, schema);
      if (parsed && Array.isArray(parsed.duplicateAlerts)) {
        return parsed.duplicateAlerts
          .filter((a: any) => a && a.ingredient && (typeof a.confidence !== 'number' || a.confidence >= 0.70))
          .map((a: any) => ({
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
    const systemPrompt = `You are a clinical chronotherapy specialist. Given medications with current time slots and patient chronotype, suggest personalized timing shifts to optimize therapeutic efficacy, align with circadian pharmacokinetics, separate binding/chelating interactions by appropriate absorption windows, prevent nocturnal sleep disruption, and minimize adverse effects. Return ONLY valid JSON with shape {"proposedShifts": [{"medId": string, "medName": string, "fromSlot": string, "toSlot": string, "reason": string, "confidence": number}], "resolvedConflictsCount": number, "plainExplanation": string, "confidence": number}. Include confidence and grounded reasoning per shift. No markdown.`;
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
    const systemPrompt = `You are a clinical pharmacology educator. A patient missed a dose of the given medication. Estimate the clinical impact in plain language, the likely biomarker change with units, and a safe recovery protocol. Rules: NEVER advise taking two doses at once — the recovery protocol must say to take the missed dose as soon as remembered unless close to the next dose, and never double up. Evaluate pharmacological half-life, clearance kinetics, therapeutic window, and indication severity to explain the clinical consequence of the missed dose. Return ONLY valid JSON with shape {"medName": string, "clinicalImpactSummary": string, "projectedBiomarkerDelta": {"biomarker": string, "estimatedChange": string}, "recoveryProtocol": string, "confidence": number, "reasoning": string}. No markdown.`;
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

