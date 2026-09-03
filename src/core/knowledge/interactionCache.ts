
import type {
  DietBadge,
  DuplicateIngredientAlert,
  InteractionArc,
} from '../../types/pillmap.ts';

export const INTERACTION_ENGINE_VERSION = '2.0.0';

export interface DietFlags {
  drinksGrapefruitDaily?: boolean;
  frequentHighVitKGreens?: boolean;
  dairyBreakfast?: boolean;
  usesPotassiumSaltSubstitute?: boolean;
  alcoholFrequency?: string;
}

export interface RegimenMedInput {
  name: string;
  dose?: string;
  genericName?: string;
}

export interface StoredInteractionEvaluation {

  regimenHash: string;
  patientId: string;
  engineVersion: string;
  computedAt: string;

  medFingerprint: string[];
  dietFlags: DietFlags;
  arcs: InteractionArc[];
  dietBadges: DietBadge[];
  duplicateAlerts: DuplicateIngredientAlert[];

  medCount: number;
}

export function stableHash(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return hash.toString(36);
}

export function sanitizeForId(value: string): string {
  return (value || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'unknown';
}

export function deterministicArcId(drugA: string, drugB: string, severity: string, mechanism: string): string {
  const pair = [sanitizeForId(drugA), sanitizeForId(drugB)].sort().join('__');
  const h = stableHash(`${pair}|${severity}|${mechanism}`.toLowerCase()).slice(0, 8);
  return `arc_${pair}_${h}`;
}

export function deterministicDuplicateId(ingredient: string, drugNames: string[]): string {
  const drugs = [...drugNames].map(sanitizeForId).sort().join('__');
  const h = stableHash(`${ingredient.toLowerCase()}|${drugs}`).slice(0, 8);
  return `dup_${sanitizeForId(ingredient)}_${h}`;
}

export function fingerprintMeds(meds: RegimenMedInput[]): string[] {
  return meds
    .map((m) => {
      const name = (m.genericName || m.name || '').trim().toLowerCase();
      const dose = (m.dose || '').trim().toLowerCase();
      return dose ? `${name}@${dose}` : name;
    })
    .filter(Boolean)
    .sort();
}

function fingerprintDiet(flags: DietFlags): string {
  const ordered = {
    drinksGrapefruitDaily: !!flags.drinksGrapefruitDaily,
    frequentHighVitKGreens: !!flags.frequentHighVitKGreens,
    dairyBreakfast: !!flags.dairyBreakfast,
    usesPotassiumSaltSubstitute: !!flags.usesPotassiumSaltSubstitute,
    alcoholFrequency: (flags.alcoholFrequency || '').toLowerCase(),
  };
  return JSON.stringify(ordered);
}

export function buildRegimenHash(meds: RegimenMedInput[], dietFlags: DietFlags): string {
  const medFp = fingerprintMeds(meds).join('|');
  const dietFp = fingerprintDiet(dietFlags);
  return stableHash(`${INTERACTION_ENGINE_VERSION}|${medFp}|${dietFp}`);
}

export function interactionCacheId(patientId: string, regimenHash: string): string {
  return `ic_${sanitizeForId(patientId).slice(0, 32)}_${regimenHash}`;
}

const memo = new Map<string, StoredInteractionEvaluation>();
const MEMO_MAX = 50;

function memoKey(patientId: string, regimenHash: string): string {
  return `${patientId}::${regimenHash}`;
}

export function getMemoEvaluation(patientId: string, regimenHash: string): StoredInteractionEvaluation | undefined {
  return memo.get(memoKey(patientId, regimenHash));
}

export function setMemoEvaluation(entry: StoredInteractionEvaluation): void {
  memo.set(memoKey(entry.patientId, entry.regimenHash), entry);
  if (memo.size > MEMO_MAX) {
    const oldest = memo.keys().next().value as string | undefined;
    if (oldest) memo.delete(oldest);
  }
}

export function clearMemoEvaluation(patientId?: string): void {
  if (!patientId) {
    memo.clear();
    return;
  }
  for (const key of [...memo.keys()]) {
    if (key.startsWith(`${patientId}::`)) memo.delete(key);
  }
}

export function buildStoredEvaluation(args: {
  patientId: string;
  meds: RegimenMedInput[];
  dietFlags: DietFlags;
  arcs: InteractionArc[];
  dietBadges: DietBadge[];
  duplicateAlerts: DuplicateIngredientAlert[];
}): StoredInteractionEvaluation {
  const medFingerprint = fingerprintMeds(args.meds);
  const regimenHash = buildRegimenHash(args.meds, args.dietFlags);
  const entry: StoredInteractionEvaluation = {
    regimenHash,
    patientId: args.patientId,
    engineVersion: INTERACTION_ENGINE_VERSION,
    computedAt: new Date().toISOString(),
    medFingerprint,
    dietFlags: { ...args.dietFlags },
    arcs: args.arcs,
    dietBadges: args.dietBadges,
    duplicateAlerts: args.duplicateAlerts,
    medCount: args.meds.length,
  };
  setMemoEvaluation(entry);
  return entry;
}

export function isEvaluationFresh(
  entry: StoredInteractionEvaluation,
  meds: RegimenMedInput[],
  dietFlags: DietFlags,
  maxAgeMs = 1000 * 60 * 60 * 24 * 7,
): boolean {
  if (!entry) return false;
  if (entry.engineVersion !== INTERACTION_ENGINE_VERSION) return false;
  if (entry.regimenHash !== buildRegimenHash(meds, dietFlags)) return false;
  const age = Date.now() - new Date(entry.computedAt).getTime();
  if (!Number.isFinite(age) || age < 0 || age > maxAgeMs) return false;
  return true;
}

