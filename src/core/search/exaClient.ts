/**
 * CareCanvas Search Core — Exa Client
 * POST https://api.exa.ai/search with Authorization: Bearer <key>
 */

import { getExaConfig, isExaEnabled, getExaEndpoint } from './exaConfig.ts';

export type ExaSearchType = 'auto' | 'fast' | 'instant' | 'deep-lite' | 'deep' | 'deep-reasoning';
export type ExaCategory = 'company' | 'people' | 'publication' | 'news' | 'personal site' | 'financial report';

export interface ExaContentsParams {
  text?: boolean | { maxCharacters?: number; includeHtmlTags?: boolean; verbosity?: 'compact' | 'standard' | 'full'; includeSections?: string[]; excludeSections?: string[] };
  highlights?: boolean | { query?: string; dynamic?: boolean; maxCharacters?: number };
  summary?: boolean | { query?: string; schema?: Record<string, unknown> };
  livecrawlTimeout?: number;
  maxAgeHours?: number;
  subpages?: number;
  subpageTarget?: string | string[];
  extras?: { links?: number; imageLinks?: number };
}

export interface ExaSearchParams {
  query: string;
  type?: ExaSearchType;
  numResults?: number;
  category?: ExaCategory;
  userLocation?: string;
  includeDomains?: string[];
  excludeDomains?: string[];
  startPublishedDate?: string;
  endPublishedDate?: string;
  moderation?: boolean;
  additionalQueries?: string[];
  systemPrompt?: string;
  outputSchema?: Record<string, unknown>;
  contents?: ExaContentsParams;
}

export interface ExaSearchResult {
  title: string;
  url: string;
  id: string;
  publishedDate?: string | null;
  author?: string | null;
  image?: string;
  favicon?: string;
  text?: string;
  highlights?: string[];
  summary?: string;
  subpages?: unknown[];
  extras?: { links?: string[]; imageLinks?: string[] };
}

export interface ExaSearchResponse {
  requestId: string;
  results: ExaSearchResult[];
  output?: { content: string | Record<string, unknown>; grounding?: Array<{ field: string; citations: Array<{ url: string; title: string }>; confidence: 'low' | 'medium' | 'high' }> };
  costDollars?: { total: number };
}

export interface ExaClientOptions {
  timeoutMs?: number;
  apiKeyOverride?: string;
  signal?: AbortSignal;
  betaHeaders?: Record<string, string>;
}

export class ExaClientError extends Error {
  status?: number;
  body?: string;
  constructor(message: string, status?: number, body?: string) {
    super(message);
    this.name = 'ExaClientError';
    this.status = status;
    this.body = body;
  }
}

function validateParams(params: ExaSearchParams): string[] {
  const errors: string[] = [];
  if (!params.query || typeof params.query !== 'string' || !params.query.trim()) errors.push('query is required (non-empty string)');
  if (params.numResults !== undefined && (params.numResults < 1 || params.numResults > 100)) errors.push('numResults must be 1-100');
  if (params.category && !['company','people','publication','news','personal site','financial report'].includes(params.category)) errors.push('category invalid');
  if (params.type && !['auto','fast','instant','deep-lite','deep','deep-reasoning'].includes(params.type)) errors.push('type invalid');
  const anyP = params as unknown as Record<string, unknown>;
  if (anyP.text !== undefined && !params.contents) errors.push('text must be nested under contents, not top-level — use contents: { text: ... }');
  if (anyP.highlights !== undefined && !params.contents) errors.push('highlights must be nested under contents');
  if (anyP.summary !== undefined && !params.contents) errors.push('summary must be nested under contents');
  if (anyP.useAutoprompt !== undefined) errors.push('useAutoprompt is deprecated — remove it');
  if (anyP.includeUrls !== undefined || anyP.excludeUrls !== undefined) errors.push('use includeDomains/excludeDomains, not includeUrls/excludeUrls');
  if (anyP.livecrawl !== undefined) errors.push('livecrawl is deprecated — use contents.maxAgeHours: 0');
  if (anyP.numSentences !== undefined || anyP.highlightsPerUrl !== undefined || anyP.tokensNum !== undefined) errors.push('numSentences/highlightsPerUrl/tokensNum are deprecated');
  if ((params.category === 'company' || params.category === 'people') && (params.excludeDomains || params.startPublishedDate || params.endPublishedDate)) {
    errors.push(`category "${params.category}" does not support excludeDomains/startPublishedDate/endPublishedDate`);
  }
  if (params.outputSchema) {
    try {
      const propsCount = params.outputSchema.properties ? Object.keys(params.outputSchema.properties as Record<string, unknown>).length : 0;
      if (propsCount > 10) errors.push('outputSchema max total properties 10 exceeded');
      for (const v of Object.values((params.outputSchema.properties || {}) as Record<string, unknown>)) {
        const rec = v as Record<string, unknown>;
        if (rec && typeof rec === 'object' && rec.properties && typeof rec.properties === 'object') {
          for (const vv of Object.values(rec.properties as Record<string, unknown>)) {
            const rec2 = vv as Record<string, unknown>;
            if (rec2 && typeof rec2 === 'object' && rec2.properties) errors.push('outputSchema max nesting depth 2 exceeded');
          }
        }
      }
    } catch { /* intentionally empty */ }
  }
  return errors;
}

function buildRequestBody(params: ExaSearchParams, defaults: { type: ExaSearchType; numResults: number; maxAgeHours?: number }): Record<string, unknown> {
  const body: Record<string, unknown> = {
    query: params.query.trim(),
    type: params.type ?? defaults.type,
    numResults: params.numResults ?? defaults.numResults,
  };
  if (params.category) body.category = params.category;
  if (params.userLocation) body.userLocation = params.userLocation;
  if (params.includeDomains && params.includeDomains.length) body.includeDomains = params.includeDomains;
  if (params.excludeDomains && params.excludeDomains.length) body.excludeDomains = params.excludeDomains;
  if (params.startPublishedDate) body.startPublishedDate = params.startPublishedDate;
  if (params.endPublishedDate) body.endPublishedDate = params.endPublishedDate;
  if (params.moderation !== undefined) body.moderation = params.moderation;
  if (params.additionalQueries && params.additionalQueries.length) body.additionalQueries = params.additionalQueries;
  if (params.systemPrompt) body.systemPrompt = params.systemPrompt;
  if (params.outputSchema) body.outputSchema = params.outputSchema;

  if (params.contents) {
    const c: Record<string, unknown> = {};
    if (params.contents.text !== undefined) c.text = params.contents.text;
    if (params.contents.highlights !== undefined) c.highlights = params.contents.highlights;
    if (params.contents.summary !== undefined) c.summary = params.contents.summary;
    if (params.contents.livecrawlTimeout !== undefined) c.livecrawlTimeout = params.contents.livecrawlTimeout;
    if (params.contents.maxAgeHours !== undefined) c.maxAgeHours = params.contents.maxAgeHours;
    else if (defaults.maxAgeHours !== undefined) c.maxAgeHours = defaults.maxAgeHours;
    if (params.contents.subpages !== undefined) c.subpages = params.contents.subpages;
    if (params.contents.subpageTarget !== undefined) c.subpageTarget = params.contents.subpageTarget;
    if (params.contents.extras !== undefined) c.extras = params.contents.extras;
    if (Object.keys(c).length > 0) body.contents = c;
  } else if (defaults.maxAgeHours !== undefined) {
    body.contents = { maxAgeHours: defaults.maxAgeHours };
  }

  return body;
}

function resolveAuthHeader(config: ReturnType<typeof getExaConfig>, options?: ExaClientOptions): string {
  if (options?.apiKeyOverride && String(options.apiKeyOverride).trim()) {
    return `Bearer ${String(options.apiKeyOverride).trim()}`;
  }
  if (typeof localStorage !== 'undefined') {
    const k = localStorage.getItem('VITE_EXA_API_KEY') || localStorage.getItem('carecanvas_VITE_EXA_API_KEY') || localStorage.getItem('EXA_API_KEY');
    if (k && k.trim()) return `Bearer ${k.trim()}`;
  }
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, unknown> })?.env ?? {};
    const fallback = (metaEnv.VITE_EXA_API_KEY as string) || (metaEnv.EXA_API_KEY as string);
    if (fallback && String(fallback).trim()) return `Bearer ${String(fallback).trim()}`;
  } catch { /* intentionally empty */ }
  if (config.apiKey && String(config.apiKey).trim()) {
    return `Bearer ${String(config.apiKey).trim()}`;
  }
  try {
    const proc = (globalThis as unknown as { process?: { env?: Record<string, string> } }).process;
    const procKey = proc?.env?.EXA_API_KEY || proc?.env?.VITE_EXA_API_KEY || '';
    if (procKey && procKey.trim()) return `Bearer ${procKey.trim()}`;
  } catch { /* intentionally empty */ }
  return '';
}

export async function searchExa(
  params: ExaSearchParams,
  options?: ExaClientOptions
): Promise<ExaSearchResponse> {
  const config = getExaConfig();
  const enabled = isExaEnabled(config) || !!options?.apiKeyOverride;
  if (!enabled && !getExaEndpoint(config).startsWith('/api/')) {
    throw new ExaClientError('Exa search is disabled or not configured — set EXA_API_KEY and EXA_BASE_URL (or use /api/exa-proxy with server EXA_API_KEY)', 401);
  }

  const errs = validateParams(params);
  if (errs.length > 0) throw new ExaClientError(`Invalid Exa params: ${errs.join('; ')}`, 400);

  const endpoint = getExaEndpoint(config);
  if (!endpoint) throw new ExaClientError('Exa endpoint not configured', 500);

  const body = buildRequestBody(params, {
    type: config.searchType,
    numResults: config.numResults,
    maxAgeHours: config.maxAgeHours,
  });

  const timeoutMs = options?.timeoutMs ?? config.timeoutMs ?? 15000;
  const controller = new AbortController();
  const signal = options?.signal ?? controller.signal;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const authHeader = resolveAuthHeader(config, options);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers.Authorization = authHeader;
  if (options?.betaHeaders) {
    for (const [k, v] of Object.entries(options.betaHeaders)) headers[k] = v;
  }

  let resp: Response;
  try {
    resp = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });
  } catch (err: unknown) {
    clearTimeout(timer);
    const e = err as { name?: string; message?: string };
    if (e?.name === 'AbortError') throw new ExaClientError(`Exa request timed out after ${timeoutMs}ms`, 504);
    throw new ExaClientError(e?.message || 'Exa fetch failed', undefined, String(err));
  }
  clearTimeout(timer);

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    let msg = txt.slice(0, 800);
    try {
      const j = JSON.parse(txt) as Record<string, unknown>;
      msg = (j.error as string) || (j.message as string) || msg;
    } catch { /* intentionally empty */ }
    throw new ExaClientError(`Exa API error (${resp.status} ${resp.statusText}): ${msg}`, resp.status, txt);
  }

  const json = await resp.json().catch(() => null) as ExaSearchResponse | null;
  if (!json) throw new ExaClientError('Exa returned invalid JSON', 500);
  if (!Array.isArray(json.results)) throw new ExaClientError('Exa response missing results array', 500);
  return json;
}

export async function searchWithHighlights(
  query: string,
  opts?: { numResults?: number; type?: ExaSearchType; category?: ExaCategory; includeDomains?: string[]; maxAgeHours?: number; systemPrompt?: string }
): Promise<ExaSearchResponse> {
  return searchExa({
    query,
    type: opts?.type ?? 'auto',
    numResults: opts?.numResults ?? 5,
    category: opts?.category,
    includeDomains: opts?.includeDomains,
    systemPrompt: opts?.systemPrompt,
    contents: {
      highlights: true,
      ...(opts?.maxAgeHours !== undefined ? { maxAgeHours: opts.maxAgeHours } : {}),
    },
  });
}

export async function searchWithText(
  query: string,
  opts?: { numResults?: number; maxCharacters?: number; type?: ExaSearchType; verbosity?: 'compact' | 'standard' | 'full' }
): Promise<ExaSearchResponse> {
  return searchExa({
    query,
    type: opts?.type ?? 'auto',
    numResults: opts?.numResults ?? 5,
    contents: {
      text: { maxCharacters: opts?.maxCharacters ?? 8000, verbosity: opts?.verbosity ?? 'standard' },
    },
  });
}

export async function searchWithHighlightsAndText(
  query: string,
  opts?: { numResults?: number; textMaxCharacters?: number }
): Promise<ExaSearchResponse> {
  return searchExa({
    query,
    numResults: opts?.numResults ?? 5,
    contents: {
      highlights: true,
      text: { maxCharacters: opts?.textMaxCharacters ?? 6000 },
    },
  });
}
