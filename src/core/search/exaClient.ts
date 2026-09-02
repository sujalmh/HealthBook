/**
 * CareCanvas Search Core — Exa Client
 * Implements https://exa.ai/docs/reference/search-best-practices correctly.
 *
 * Correctness per docs:
 * - POST https://api.exa.ai/search with Authorization: Bearer <key>
 * - Parameters: query (required), type, numResults, category, includeDomains, excludeDomains, startPublishedDate etc.
 * - Contents nested under `contents` object: { text, highlights, summary, livecrawlTimeout, maxAgeHours, subpages }
 * - highlights: true for agent workflows (token efficient), text for deep research with maxCharacters
 * - livecrawl via contents.maxAgeHours: 0 (not `livecrawl: "always"` — deprecated)
 * - No deprecated params: useAutoprompt, includeUrls, excludeUrls, numSentences, highlightsPerUrl, tokensNum
 */

import { getExaConfig, isExaEnabled, getExaEndpoint } from './exaConfig.ts';

export type ExaSearchType = 'auto' | 'fast' | 'instant' | 'deep-lite' | 'deep' | 'deep-reasoning';
export type ExaCategory = 'company' | 'people' | 'publication' | 'news' | 'personal site' | 'financial report';

export interface ExaContentsParams {
  text?: boolean | { maxCharacters?: number; includeHtmlTags?: boolean; verbosity?: 'compact' | 'standard' | 'full'; includeSections?: string[]; excludeSections?: string[] };
  highlights?: boolean | { query?: string; dynamic?: boolean; maxCharacters?: number };
  summary?: boolean | { query?: string; schema?: Record<string, any> };
  livecrawlTimeout?: number; // default 10000
  maxAgeHours?: number; // 0 = always livecrawl, -1 = never, omit = fallback
  subpages?: number;
  subpageTarget?: string | string[];
  extras?: { links?: number; imageLinks?: number };
}

export interface ExaSearchParams {
  query: string;
  type?: ExaSearchType;
  numResults?: number; // 1-100 default 10
  category?: ExaCategory;
  userLocation?: string; // ISO country e.g. US
  includeDomains?: string[];
  excludeDomains?: string[];
  startPublishedDate?: string; // ISO 8601
  endPublishedDate?: string;
  moderation?: boolean;
  additionalQueries?: string[];
  systemPrompt?: string;
  outputSchema?: Record<string, any>; // JSON schema for output.content, depth <=2, props <=10
  contents?: ExaContentsParams;
  // Stream? we default false; streaming needs SSE handle, not used for grounding now
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
  subpages?: any[];
  extras?: { links?: string[]; imageLinks?: string[] };
}

export interface ExaSearchResponse {
  requestId: string;
  results: ExaSearchResult[];
  output?: { content: string | Record<string, any>; grounding?: Array<{ field: string; citations: Array<{ url: string; title: string }>; confidence: 'low' | 'medium' | 'high' }> };
  costDollars?: { total: number };
  // For non-deep types without outputSchema, output is absent
}

export interface ExaClientOptions {
  timeoutMs?: number;
  apiKeyOverride?: string;
  signal?: AbortSignal;
  betaHeaders?: Record<string, string>; // e.g. for dynamic highlights
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

/**
 * Validate params per docs — catches common LLM mistakes early.
 */
function validateParams(params: ExaSearchParams): string[] {
  const errors: string[] = [];
  if (!params.query || typeof params.query !== 'string' || !params.query.trim()) errors.push('query is required (non-empty string)');
  if (params.numResults !== undefined && (params.numResults < 1 || params.numResults > 100)) errors.push('numResults must be 1-100');
  if (params.category && !['company','people','publication','news','personal site','financial report'].includes(params.category)) errors.push('category invalid');
  if (params.type && !['auto','fast','instant','deep-lite','deep','deep-reasoning'].includes(params.type)) errors.push('type invalid');
  // Common mistakes: top-level text/highlights/summary without contents wrapper
  const anyP = params as any;
  if (anyP.text !== undefined && !params.contents) errors.push('text must be nested under contents, not top-level — use contents: { text: ... }');
  if (anyP.highlights !== undefined && !params.contents) errors.push('highlights must be nested under contents');
  if (anyP.summary !== undefined && !params.contents) errors.push('summary must be nested under contents');
  if (anyP.useAutoprompt !== undefined) errors.push('useAutoprompt is deprecated — remove it');
  if (anyP.includeUrls !== undefined || anyP.excludeUrls !== undefined) errors.push('use includeDomains/excludeDomains, not includeUrls/excludeUrls');
  if (anyP.livecrawl !== undefined) errors.push('livecrawl is deprecated — use contents.maxAgeHours: 0');
  if (anyP.numSentences !== undefined || anyP.highlightsPerUrl !== undefined || anyP.tokensNum !== undefined) errors.push('numSentences/highlightsPerUrl/tokensNum are deprecated');
  // Category restrictions: company/people disable many filters
  if ((params.category === 'company' || params.category === 'people') && (params.excludeDomains || params.startPublishedDate || params.endPublishedDate)) {
    errors.push(`category "${params.category}" does not support excludeDomains/startPublishedDate/endPublishedDate`);
  }
  // OutputSchema depth check (max depth 2, max props 10)
  if (params.outputSchema) {
    try {
      const propsCount = params.outputSchema.properties ? Object.keys(params.outputSchema.properties).length : 0;
      if (propsCount > 10) errors.push('outputSchema max total properties 10 exceeded');
      // depth check shallow
      for (const v of Object.values((params.outputSchema.properties || {}) as Record<string, any>)) {
        if (v && typeof v === 'object' && v.properties && typeof v.properties === 'object') {
          for (const vv of Object.values(v.properties as Record<string, any>)) {
            if (vv && typeof vv === 'object' && vv.properties) errors.push('outputSchema max nesting depth 2 exceeded');
          }
        }
      }
    } catch {}
  }
  return errors;
}

function buildRequestBody(params: ExaSearchParams, defaults: { type: ExaSearchType; numResults: number; maxAgeHours?: number }): Record<string, any> {
  const body: Record<string, any> = {
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

  // Contents — ensure nesting under contents, not top-level
  if (params.contents) {
    const c: Record<string, any> = {};
    if (params.contents.text !== undefined) c.text = params.contents.text;
    if (params.contents.highlights !== undefined) c.highlights = params.contents.highlights;
    if (params.contents.summary !== undefined) c.summary = params.contents.summary;
    if (params.contents.livecrawlTimeout !== undefined) c.livecrawlTimeout = params.contents.livecrawlTimeout;
    // maxAgeHours: explicit from params.contents wins, else default from config if defined, else omit for fallback
    if (params.contents.maxAgeHours !== undefined) c.maxAgeHours = params.contents.maxAgeHours;
    else if (defaults.maxAgeHours !== undefined) c.maxAgeHours = defaults.maxAgeHours;
    if (params.contents.subpages !== undefined) c.subpages = params.contents.subpages;
    if (params.contents.subpageTarget !== undefined) c.subpageTarget = params.contents.subpageTarget;
    if (params.contents.extras !== undefined) c.extras = params.contents.extras;
    // Only include contents if at least one key
    if (Object.keys(c).length > 0) body.contents = c;
  } else if (defaults.maxAgeHours !== undefined) {
    // If no contents but default maxAgeHours set, still need contents wrapper
    body.contents = { maxAgeHours: defaults.maxAgeHours };
  }

  // Default: if no contents at all and no text/highlights/summary needed, recommend highlights for agent workflows
  // Callers should explicitly set contents.highlights = true for token efficiency unless they need full text
  if (!body.contents) {
    // Leave empty — will use Exa default (no extra content fetch, fastest). For grounding we recommend highlights.
    // Do NOT auto-add highlights to avoid surprising token cost; let healthGrounding decide.
  }

  return body;
}

/**
 * Core search — follows Exa docs token efficiency guidance:
 * - Use highlights for agent workflows (multi-step, factual questions) — 10x fewer tokens
 * - Use text for deep research when full context needed, capped via maxCharacters
 * - Omit maxAgeHours for cached fallback (fast); set 0 only when freshness required
 */
export async function searchExa(
  params: ExaSearchParams,
  options?: ExaClientOptions
): Promise<ExaSearchResponse> {
  const config = getExaConfig();
  // Allow search even if not fully enabled if caller passes apiKeyOverride or proxy base (server injects key)
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

  // Determine auth header: prefer override, then localStorage/browser key, then via proxy (no header needed)
  let authHeader = '';
  if (options?.apiKeyOverride && String(options.apiKeyOverride).trim()) {
    authHeader = `Bearer ${String(options.apiKeyOverride).trim()}`;
  } else if (typeof localStorage !== 'undefined') {
    // Try VITE_EXA_API_KEY variants from localStorage (Settings)
    const k = localStorage.getItem('VITE_EXA_API_KEY') || localStorage.getItem('carecanvas_VITE_EXA_API_KEY') || localStorage.getItem('EXA_API_KEY');
    if (k && k.trim()) authHeader = `Bearer ${k.trim()}`;
  }
  // Also try import.meta.env as fallback (local dev)
  if (!authHeader) {
    try {
      const metaEnv = (import.meta as any)?.env ?? {};
      const fallback = metaEnv.VITE_EXA_API_KEY || metaEnv.EXA_API_KEY;
      if (fallback && String(fallback).trim()) authHeader = `Bearer ${String(fallback).trim()}`;
    } catch {}
  }
  // Fallback to config apiKey (covers process.env.EXA_API_KEY in node, and VITE_EXA_API_KEY via config)
  if (!authHeader && config.apiKey && String(config.apiKey).trim()) {
    authHeader = `Bearer ${String(config.apiKey).trim()}`;
  }
  // Also fallback to process.env directly for node environments where import.meta.env not populated
  if (!authHeader) {
    try {
      const procKey = (typeof process !== 'undefined' ? (process as any).env?.EXA_API_KEY || (process as any).env?.VITE_EXA_API_KEY : '') as string;
      if (procKey && procKey.trim()) authHeader = `Bearer ${procKey.trim()}`;
    } catch {}
  }
  // If endpoint is proxy (/api/exa-proxy/*), server will inject key if auth missing — we still send if we have one
  // If endpoint is direct https://api.exa.ai/search and no key, let proxy error handle it but warn
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
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') throw new ExaClientError(`Exa request timed out after ${timeoutMs}ms`, 504);
    throw new ExaClientError(err?.message || 'Exa fetch failed', undefined, String(err));
  }
  clearTimeout(timer);

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    let msg = txt.slice(0, 800);
    try {
      const j = JSON.parse(txt);
      msg = j.error || j.message || msg;
    } catch {}
    throw new ExaClientError(`Exa API error (${resp.status} ${resp.statusText}): ${msg}`, resp.status, txt);
  }

  const json = await resp.json().catch(() => null) as ExaSearchResponse | null;
  if (!json) throw new ExaClientError('Exa returned invalid JSON', 500);
  if (!Array.isArray(json.results)) throw new ExaClientError('Exa response missing results array', 500);
  return json;
}

/**
 * Convenience: search with highlights (recommended for agent workflows per docs).
 * Token-efficient — returns query-relevant excerpts only.
 */
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

/**
 * Convenience: deep research with full text capped.
 */
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

/**
 * Combine highlights + text strategically — highlights for quick answer, fallback to text when needed.
 * Per docs: Combine modes strategically — request both in same call.
 */
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
