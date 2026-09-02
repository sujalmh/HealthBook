/**
 * CareCanvas Core: Interaction Cache — persistent derived-data store.
 *
 * Problem it fixes:
 * - Pill interactions / diet badges / duplicate alerts were pure functions
 *   re-executed on every PillMap load (PillMapView.recalculateEvaluations),
 *   on every check_interactions tool call, and on every RxBridge flag check.
 * - Result IDs used Date.now()+Math.random(), so results were un-storable,
 *   un-diffable, and caused render churn.
 *
 * Design:
 * - Supabase Postgres (`interaction_cache` table) is the system-of-record for
 *   derived evaluations. LocalVault `interactionCache` Map is a write-through
 *   cache (same pattern as meds/labs). An in-process memo avoids duplicate
 *   compute within a single session.
 * - Cache key = stable content hash of the regimen (sorted generic names +
 *   doses + diet flags + ENGINE_VERSION). Any med add/update/remove bumps the
 *   fingerprint, so stale entries are never served.
 * - IDs are deterministic (`arc_<a>_<b>_<hash>`, `dup_<ingredient>_<hash>`),
 *   so stored rows compare equal across loads and can be diffed for animated
 *   PillMap updates.
 *
 * Ownership: core/knowledge (interactionEngine v2). Depends on nothing.
 */

import type {
  DietBadge,
  DuplicateIngredientAlert,
  InteractionArc,
} from '../../types/pillmap.ts';

/** Bump when fixture rules or engine logic change — invalidates all stored rows. */
export const INTERACTION_ENGINE_VERSION = '2.0.0';

/** Canonical diet flags subset that affects evaluation. */
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
  /** Stable fingerprint — also the Supabase PK suffix (`ic_<patient>_<hash>`). */
  regimenHash: string;
  patientId: string;
  engineVersion: string;
  computedAt: string;
  /** Sorted generic names that produced this evaluation. */
  medFingerprint: string[];
  dietFlags: DietFlags;
  arcs: InteractionArc[];
  dietBadges: DietBadge[];
  duplicateAlerts: DuplicateIngredientAlert[];
  /** Number of meds evaluated — guards against empty-regimen cache poisoning. */
  medCount: number;
}

// ------------------------------------------------------------------
// Stable hashing (cyrb53, no dependencies)
// ------------------------------------------------------------------

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

/** Deterministic arc id — stable for the same drug pair + severity + mechanism. */
export function deterministicArcId(drugA: string, drugB: string, severity: string, mechanism: string): string {
  const pair = [sanitizeForId(drugA), sanitizeForId(drugB)].sort().join('__');
  const h = stableHash(`${pair}|${severity}|${mechanism}`.toLowerCase()).slice(0, 8);
  return `arc_${pair}_${h}`;
}

/** Deterministic duplicate-alert id — stable for the same ingredient + drugs. */
export function deterministicDuplicateId(ingredient: string, drugNames: string[]): string {
  const drugs = [...drugNames].map(sanitizeForId).sort().join('__');
  const h = stableHash(`${ingredient.toLowerCase()}|${drugs}`).slice(0, 8);
  return `dup_${sanitizeForId(ingredient)}_${h}`;
}

/** Normalize a med list into a sorted, lower-cased fingerprint. */
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

/**
 * Build the stable regimen hash for a patient evaluation.
 * Includes engine version so rule updates invalidate old rows automatically.
 */
export function buildRegimenHash(meds: RegimenMedInput[], dietFlags: DietFlags): string {
  const medFp = fingerprintMeds(meds).join('|');
  const dietFp = fingerprintDiet(dietFlags);
  return stableHash(`${INTERACTION_ENGINE_VERSION}|${medFp}|${dietFp}`);
}

/** Canonical Supabase / vault PK for a stored evaluation. */
export function interactionCacheId(patientId: string, regimenHash: string): string {
  return `ic_${sanitizeForId(patientId).slice(0, 32)}_${regimenHash}`;
}

// ------------------------------------------------------------------
// In-process memo (single-session fast path; vault/Supabase is durable)
// ------------------------------------------------------------------

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

/** Build a storable evaluation from freshly computed engine outputs. */
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

/** Guard: stored entry is usable only if version + med set match. */
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
