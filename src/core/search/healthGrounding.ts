
import { searchExa, type ExaSearchResponse, type ExaCategory, type ExaSearchType } from './exaClient.ts';
import { isExaEnabled, getExaConfig } from './exaConfig.ts';

export interface GroundedInsight {
  query: string;
  summary?: string;
  results: Array<{
    title: string;
    url: string;
    highlights: string[];
    text?: string;
    publishedDate?: string | null;
    favicon?: string;
    score?: number;
  }>;
  citations: Array<{ url: string; title: string }>;
  groundingField?: string;
  confidence?: 'low' | 'medium' | 'high';
  costDollars?: number;
  requestId?: string;
  queriedAt: string;
}

export interface GroundLabOptions {
  marker?: string;
  value?: number;
  unit?: string;
  priorValue?: number;
  trend?: string;
  medications?: string[];
  patientContext?: string;
  forceLivecrawl?: boolean;
  numResults?: number;
  type?: ExaSearchType;
}

export interface GroundMedicationOptions {
  medNames: string[];
  patientLabs?: Array<{ marker: string; value: number; unit: string }>;
  dietHabits?: Record<string, unknown>;
  forceLivecrawl?: boolean;
  numResults?: number;
  type?: ExaSearchType;
}

export interface GroundConditionOptions {
  condition: string;
  labs?: Array<{ marker: string; value: unknown }>;
  medications?: string[];
  question?: string;
  type?: ExaSearchType;
}

function toCitations(resp: ExaSearchResponse): Array<{ url: string; title: string }> {
  if (resp.output?.grounding?.length) {
    const all: Array<{ url: string; title: string }> = [];
    for (const g of resp.output.grounding) {
      for (const c of g.citations) all.push(c);
    }
    if (all.length) return all;
  }
  return resp.results.map(r => ({ url: r.url, title: r.title })).slice(0, 8);
}

function toInsight(resp: ExaSearchResponse, query: string): GroundedInsight {
  return {
    query,
    summary: typeof resp.output?.content === 'string' ? resp.output.content : undefined,
    results: resp.results.map(r => ({
      title: r.title,
      url: r.url,
      highlights: r.highlights ?? [],
      text: r.text,
      publishedDate: r.publishedDate,
      favicon: r.favicon,
    })),
    citations: toCitations(resp),
    groundingField: resp.output?.grounding?.[0]?.field,
    confidence: resp.output?.grounding?.[0]?.confidence,
    costDollars: resp.costDollars?.total,
    requestId: resp.requestId,
    queriedAt: new Date().toISOString(),
  };
}

function trustedHealthDomains(): string[] {
  return [];
}

function disabledInsight(query: string, reason: string): GroundedInsight {
  return {
    query,
    results: [],
    citations: [],
    queriedAt: new Date().toISOString(),
    summary: reason,
  };
}

export async function isHealthGroundingAvailable(): Promise<boolean> {
  try {

    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 2000);
        const r = await fetch('/api/exa-proxy?health=1', { signal: controller.signal });
        clearTimeout(t);
        if (r.ok) {
          const j = await r.json().catch(() => null);
          if (j && typeof j.enabled === 'boolean') return j.enabled;
          if (j && typeof j.hasKey === 'boolean') return j.hasKey;
        }
      } catch {}
    }
  } catch {}
  try {
    return isExaEnabled(getExaConfig());
  } catch { return false; }
}

export async function groundBiomarkerLevels(opts: { marker: string; unit?: string; patientContext?: string; type?: ExaSearchType; numResults?: number }): Promise<GroundedInsight> {
  const marker = opts.marker.trim();
  const query = `${marker} ${opts.unit || ''} normal reference range low high critical values latest guidelines`.replace(/\s+/g,' ').trim();
  const available = await isHealthGroundingAvailable();
  if (!available) return disabledInsight(query, 'Biomarker grounding unavailable — configure EXA_API_KEY.');
  const resp = await searchExa({
    query,
    type: (opts.type as ExaSearchType) ?? 'auto',
    numResults: opts.numResults ?? 3,
    systemPrompt: 'You are a lab medicine evidence assistant. Provide authoritative reference ranges (normal, low, high, critical) for the biomarker. Prefer guideline sources. Avoid duplicates.',
    contents: { highlights: true },
  });
  return toInsight(resp, query);
}

export async function groundLabTrend(opts: GroundLabOptions): Promise<GroundedInsight> {
  const marker = (opts.marker || 'lab').trim();
  const valStr = opts.value !== undefined ? `${opts.value} ${opts.unit || ''}`.trim() : '';
  const trend = opts.trend ? `trend: ${opts.trend}` : '';
  const meds = opts.medications?.length ? `medications: ${opts.medications.join(', ')}` : '';
  const ctx = opts.patientContext ? `context: ${opts.patientContext}` : '';
  const prior = opts.priorValue !== undefined ? `prior ${opts.priorValue}` : '';

  const query = `${marker} ${valStr} ${prior} ${trend} — what's latest interpretation, causes, and when to recheck? ${meds} ${ctx} evidence-based guidelines`.replace(/\s+/g,' ').trim();
  const available = await isHealthGroundingAvailable();
  if (!available) return disabledInsight(query, 'Health grounding unavailable — configure EXA_API_KEY in .env or Settings to enable web-grounded insights.');

  const resp = await searchExa({
    query,
    type: (opts.type as ExaSearchType) ?? 'auto',
    numResults: opts.numResults ?? 5,
    systemPrompt: 'You are a medical evidence assistant. Prefer authoritative official sources (CDC, NIH, PubMed, Mayo Clinic, WHO, FDA, Heart/Kidney/Diabetes associations) and recent guidelines. Avoid duplicates. Provide source diversity.',
    contents: {
      highlights: true,
      ...(opts.forceLivecrawl ? { maxAgeHours: 0 } : {}),
    },
  });
  return toInsight(resp, query);
}

export async function groundMedicationContext(opts: GroundMedicationOptions): Promise<GroundedInsight> {
  const medsQuery = opts.medNames.join(', ');
  const labStr = opts.patientLabs?.map(l => `${l.marker} ${l.value} ${l.unit}`).join('; ') || '';
  const dietStr = opts.dietHabits ? `diet: ${JSON.stringify(opts.dietHabits)}` : '';
  const query = `Clinical guidance for medications ${medsQuery}${labStr ? ` with labs ${labStr}` : ''} ${dietStr} — interactions, contraindications, monitoring per latest guidelines`.replace(/\s+/g,' ').trim();

  const available = await isHealthGroundingAvailable();
  if (!available) return disabledInsight(query, 'Medication grounding unavailable — enable EXA_API_KEY.');

  const resp = await searchExa({
    query,
    type: (opts.type as ExaSearchType) ?? 'auto',
    numResults: opts.numResults ?? 5,
    systemPrompt: 'You are a pharmacology evidence assistant. Prefer authoritative drug monographs (FDA DailyMed, NIH, PubMed) and highlight mechanism, severity, monitoring. Avoid duplicates.',
    contents: {
      highlights: true,
      ...(opts.forceLivecrawl ? { maxAgeHours: 0 } : {}),
    },
  });
  return toInsight(resp, query);
}

export async function groundConditionContext(opts: GroundConditionOptions): Promise<GroundedInsight> {
  const labs = opts.labs?.map(l => `${l.marker}: ${JSON.stringify(l.value)}`).join(', ') || '';
  const meds = opts.medications?.join(', ') || '';
  const q = opts.question ? ` Patient question: "${opts.question}"` : '';
  const query = `Patient has ${opts.condition}${labs ? ` labs ${labs}` : ''}${meds ? ` on ${meds}` : ''}.${q} Latest evidence-based management and questions to ask doctor.`.replace(/\s+/g,' ').trim();

  const available = await isHealthGroundingAvailable();
  if (!available) return disabledInsight(query, 'Condition grounding unavailable — configure EXA_API_KEY.');

  const resp = await searchExa({
    query,
    type: (opts.type as ExaSearchType) ?? ('deep-lite' as ExaSearchType),
    numResults: 5,
    systemPrompt: 'You are a clinical evidence assistant. Prefer authoritative official sources and recent guidelines; provide plain-language key points; avoid duplicates.',
    contents: { highlights: true },
  });
  return toInsight(resp, query);
}

export async function groundHealthQuestion(
  question: string,
  opts?: { contextFacts?: string; category?: ExaCategory; type?: ExaSearchType; numResults?: number; forceLivecrawl?: boolean; includeDomains?: string[] }
): Promise<GroundedInsight> {
  const ctx = opts?.contextFacts ? ` Context: ${opts.contextFacts}` : '';
  const query = `${question}${ctx}`.trim();

  const available = await isHealthGroundingAvailable();
  if (!available) return disabledInsight(query, 'Web grounding unavailable — set EXA_API_KEY.');

  const resp = await searchExa({
    query,
    type: opts?.type ?? 'auto',
    numResults: opts?.numResults ?? 5,
    category: opts?.category,
    ...(opts?.includeDomains ? { includeDomains: opts.includeDomains } : {}),
    systemPrompt: 'You are a medical evidence assistant. Prefer authoritative official sources (CDC, NIH, PubMed, Mayo, WHO, FDA) and recent guidelines. Avoid duplicates; cite sources.',
    contents: {
      highlights: true,
      ...(opts?.forceLivecrawl ? { maxAgeHours: 0 } : {}),
    },
  });
  return toInsight(resp, query);
}

export async function groundStructuredSummary(
  query: string,
  outputSchema: Record<string, unknown>,
  opts?: { type?: ExaSearchType; numResults?: number; systemPrompt?: string }
): Promise<{ content: unknown; grounding?: unknown[]; results: ExaSearchResponse['results']; costDollars?: number; requestId: string }> {
  const available = await isHealthGroundingAvailable();
  if (!available) throw new Error('Grounding unavailable — EXA_API_KEY not configured');

  const resp = await searchExa({
    query,
    type: opts?.type ?? 'deep',
    numResults: opts?.numResults ?? 8,
    systemPrompt: opts?.systemPrompt ?? 'Prefer official sources; avoid duplicates; synthesize concise structured answer.',
    outputSchema,
    contents: { highlights: true },
  });
  return {
    content: (resp.output as unknown as { content?: unknown })?.content,
    grounding: (resp.output as unknown as { grounding?: unknown[] })?.grounding,
    results: resp.results,
    costDollars: resp.costDollars?.total,
    requestId: resp.requestId,
  };
}

export async function groundWithLivecrawl(query: string, numResults = 5): Promise<GroundedInsight> {
  const resp = await searchExa({
    query,
    type: 'fast',
    numResults,
    contents: { highlights: true, maxAgeHours: 0 },
  });
  return toInsight(resp, query);
}

export async function groundBatch(queries: string[], opts?: { type?: ExaSearchType; numResultsPerQuery?: number }): Promise<GroundedInsight[]> {
  const results: GroundedInsight[] = [];
  for (const q of queries.slice(0, 6)) {
    try {
      const insight = await groundHealthQuestion(q, { type: opts?.type ?? 'auto', numResults: opts?.numResultsPerQuery ?? 3 });
      results.push(insight);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ query: q, results: [], citations: [], queriedAt: new Date().toISOString(), summary: `Grounding failed: ${msg}` });
    }
  }
  return results;
}

export const HealthGrounding = {
  groundBiomarkerLevels,
  groundLabTrend,
  groundMedicationContext,
  groundConditionContext,
  groundHealthQuestion,
  groundStructuredSummary,
  groundWithLivecrawl,
  groundBatch,
  isAvailable: isHealthGroundingAvailable,
  trustedDomains: trustedHealthDomains,
};

