/**
 * CareCanvas Fact Verification — web-evidence verification inside the AI pipeline.
 *
 * Runs as the step AFTER text extraction (extract_fact): for each clinically
 * verifiable fact (lab, medication, condition, allergy) it fetches authoritative
 * web evidence via Exa and asks the AI to verify the extracted claim against
 * that evidence. The verdict is attached to the fact as `fact.verification`
 * so the review UI (FactStreamView) can show it before the patient approves.
 *
 * Guarantees:
 * - Never throws and never blocks extraction: any failure marks facts
 *   unverifiable and the pipeline continues.
 * - Bounded: max 6 unique evidence queries, 3 results each, one AI verdict call.
 */

import type { Fact, FactVerification } from '../../types/vault.ts';
import { isHealthGroundingAvailable } from './healthGrounding.ts';
import { searchExa } from './exaClient.ts';
import { callAI } from '../ai/client.ts';
import { getAIConfig, isAIEnabled } from '../ai/config.ts';

export const VERIFICATION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      description: 'One verdict per extracted fact',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Fact name exactly as given in the facts list' },
          status: { type: 'string', description: 'verified, needs_review, or unverifiable', enum: ['verified', 'needs_review', 'unverifiable'] },
          note: { type: 'string', description: 'One-sentence plain-language verdict, e.g. how the value compares to the referenced normal range' },
        },
        required: ['name', 'status', 'note'],
        additionalProperties: false,
      },
    },
  },
  required: ['verdicts'],
  additionalProperties: false,
} as const;

const VERIFICATION_SYSTEM_PROMPT = `You are a meticulous medical fact-checker verifying facts extracted from a patient's clinical document.
You are given extracted facts and web evidence highlights from authoritative medical sources.
For each fact, judge whether the web evidence SUPPORTS the fact's claim (value within/beyond reference range, dosage plausibility, condition/description accuracy):
- "verified": evidence is consistent with the fact.
- "needs_review": evidence contradicts the fact or the value looks implausible/out of the plausible range for that measurement.
- "unverifiable": evidence does not address the fact (e.g. patient-specific instructions, no reference data found).
Be conservative: only mark "verified" when the evidence genuinely addresses the claim. Keep each note to one clear sentence a patient can read.`;

const VERIFIABLE_CATEGORIES = ['lab', 'medication', 'condition', 'allergy'];
const MAX_EVIDENCE_QUERIES = 6;
const MAX_VERIFIABLE_FACTS = 12;

function buildQueryForFact(fact: Fact): string {
  const value = typeof fact.value === 'string' ? fact.value : JSON.stringify(fact.value ?? '');
  const unit = fact.unit || '';
  const cat = String(fact.category || '').toLowerCase();
  if (cat.includes('lab')) {
    return `${fact.name} ${value} ${unit} normal reference range interpretation`.replace(/\s+/g, ' ').trim();
  }
  if (cat.includes('med')) {
    return `${fact.name} ${value} typical dosage side effects interactions monitoring`.replace(/\s+/g, ' ').trim();
  }
  if (cat.includes('allerg')) {
    return `${fact.name} allergy symptoms cross-reactivity management`.replace(/\s+/g, ' ').trim();
  }
  return `${fact.name} condition symptoms diagnosis treatment latest guidelines`.replace(/\s+/g, ' ').trim();
}

function isVerifiable(fact: Fact): boolean {
  const cat = String(fact.category || '').toLowerCase();
  if (!VERIFIABLE_CATEGORIES.some((c) => cat.includes(c))) return false;
  const value = typeof fact.value === 'string' ? fact.value.trim() : '';
  if (cat.includes('allerg') && value.toUpperCase() === 'NKDA') return false;
  return !!fact.name?.trim();
}

interface EvidenceBundle {
  key: string;
  highlights: string[];
  citations: Array<{ url: string; title: string }>;
}

async function fetchEvidenceBundle(fact: Fact): Promise<EvidenceBundle | null> {
  const query = buildQueryForFact(fact);
  try {
    const resp = await searchExa({
      query,
      type: 'fast',
      numResults: 3,
      systemPrompt: 'You are a medical evidence assistant. Prefer authoritative official sources (CDC, NIH, PubMed, Mayo, WHO, FDA) and recent guidelines. Avoid duplicates.',
      contents: { highlights: true },
    });
    const highlights = resp.results
      .flatMap((r) => (r.highlights ?? []).slice(0, 2).map((h) => `[${r.title || r.url}] ${h.trim().slice(0, 400)}`))
      .slice(0, 6);
    if (highlights.length === 0) return null;
    return {
      key: `${String(fact.category).toLowerCase()}|${fact.name.toLowerCase()}`,
      highlights,
      citations: resp.results.map((r) => ({ url: r.url, title: r.title })),
    };
  } catch {
    return null;
  }
}

/**
 * Verify extracted facts against web evidence and attach `fact.verification`
 * to each fact object in place. Safe to call with any fact list — facts that
 * are not web-verifiable (demographics, vitals, care instructions) are left
 * untouched.
 */
export async function verifyFactsWithWebEvidence(facts: Fact[]): Promise<void> {
  const verifiable = facts.filter(isVerifiable).slice(0, MAX_VERIFIABLE_FACTS);
  if (verifiable.length === 0) return;

  let groundingAvailable = false;
  try {
    groundingAvailable = await isHealthGroundingAvailable();
  } catch { groundingAvailable = false; }
  if (!groundingAvailable) return;

  // One evidence fetch per unique category+name — extracted docs repeat markers.
  const byKey = new Map<string, Fact>();
  for (const f of verifiable) {
    const key = `${String(f.category).toLowerCase()}|${f.name.toLowerCase()}`;
    if (!byKey.has(key)) byKey.set(key, f);
  }
  const uniqueFacts = Array.from(byKey.values()).slice(0, MAX_EVIDENCE_QUERIES);

  const bundles = await Promise.all(uniqueFacts.map(fetchEvidenceBundle));
  const evidenceByKey = new Map<string, EvidenceBundle>();
  for (const b of bundles) {
    if (b) evidenceByKey.set(b.key, b);
  }
  if (evidenceByKey.size === 0) return;

  const config = getAIConfig();
  if (!isAIEnabled(config)) return;

  const factsSection = verifiable
    .map((f, i) => {
      const value = typeof f.value === 'string' ? f.value : JSON.stringify(f.value ?? '');
      return `${i + 1}. name: ${f.name} | category: ${f.category} | value: ${value}${f.unit ? ` ${f.unit}` : ''} | extracted interpretation: ${f.plainExplanation || '—'}`;
    })
    .join('\n');

  const evidenceSection = Array.from(evidenceByKey.values())
    .map((b) => `Evidence for "${b.key}":\n${b.highlights.map((h) => `- ${h}`).join('\n')}`)
    .join('\n\n');

  const userText = `Extracted clinical facts:\n${factsSection}\n\nWeb evidence highlights:\n${evidenceSection}\n\nReturn one verdict per extracted fact (match by exact name).`;

  let verdicts: Array<{ name?: unknown; status?: unknown; note?: unknown }> = [];
  try {
    const parsed = await callAI<{ verdicts?: unknown }>(
      VERIFICATION_SYSTEM_PROMPT,
      userText,
      {
        schema: VERIFICATION_JSON_SCHEMA as unknown as Record<string, unknown>,
        temperature: 0,
        maxTokens: 4096,
        timeoutMs: 60000,
      }
    );
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { verdicts?: unknown }).verdicts)) {
      verdicts = (parsed as { verdicts: unknown[] }).verdicts as Array<{ name?: unknown; status?: unknown; note?: unknown }>;
    }
  } catch (err: unknown) {
    console.warn('[factVerification] AI verdict call failed — facts saved without verification:', err instanceof Error ? err.message : err);
    return;
  }

  const verdictByName = new Map<string, { status: FactVerification['status']; note: string }>();
  for (const v of verdicts) {
    if (!v || typeof v !== 'object') continue;
    const name = typeof v.name === 'string' ? v.name.trim().toLowerCase() : '';
    if (!name) continue;
    const rawStatus = String(v.status ?? '').toLowerCase();
    const status: FactVerification['status'] =
      rawStatus === 'verified' ? 'verified' :
      rawStatus === 'needs_review' ? 'needs_review' :
      'unverifiable';
    const note = typeof v.note === 'string' && v.note.trim() ? v.note.trim().slice(0, 300) : 'No verdict note returned.';
    verdictByName.set(name, { status, note });
  }

  const checkedAt = new Date().toISOString();
  for (const fact of verifiable) {
    const key = `${String(fact.category).toLowerCase()}|${fact.name.toLowerCase()}`;
    const bundle = evidenceByKey.get(key);
    const verdict = verdictByName.get(fact.name.toLowerCase());
    if (!verdict) continue;
    fact.verification = {
      status: verdict.status,
      note: verdict.note,
      sources: bundle ? bundle.citations.slice(0, 4) : [],
      checkedAt,
    };
  }
}
