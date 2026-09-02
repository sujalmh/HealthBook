/**
 * CareCanvas Search Core — Exa Config
 * Runtime configuration with SettingsStore > env precedence, mirroring ai/config.ts
 * Handles EXA_API_KEY grounding toggle and grounding provider generically.
 */

export interface ExaConfig {
  enabled: boolean;
  apiKey: string;
  baseURL: string; // e.g. https://api.exa.ai or /api/exa-proxy (proxied)
  numResults: number; // default 5-10 per docs
  searchType: 'auto' | 'fast' | 'instant' | 'deep-lite' | 'deep' | 'deep-reasoning';
  maxAgeHours?: number; // omit = cached fallback; 0 = always livecrawl
  timeoutMs: number;
}

function readSettingsOverrides(): Record<string, any> {
  const o: Record<string, any> = {};
  if (typeof localStorage === 'undefined') return o;
  const keys = ['carecanvas_settings', 'carecanvas_ai_settings', 'carecanvas_ai_config'];
  for (const blob of keys) {
    try {
      const raw = localStorage.getItem(blob);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          if (v !== undefined && v !== null && v !== '' && o[k] === undefined) o[k] = v;
        }
      }
    } catch {}
  }
  const exaKeys = ['VITE_EXA_API_KEY', 'VITE_EXA_ENABLED', 'VITE_EXA_BASE_URL', 'EXA_API_KEY', 'VITE_EXA_NUM_RESULTS', 'VITE_EXA_SEARCH_TYPE', 'VITE_EXA_TIMEOUT_MS', 'VITE_EXA_MAX_AGE_HOURS'];
  for (const k of exaKeys) {
    try {
      const v = localStorage.getItem(k) ?? localStorage.getItem(`carecanvas_${k}`);
      if (v !== null && v !== '' && o[k] === undefined) o[k] = v;
    } catch {}
  }
  return o;
}

function resolveVal(overrides: Record<string, any>, env: Record<string, any>, key: string, fallback: any): any {
  if (overrides[key] !== undefined && overrides[key] !== null && overrides[key] !== '') return overrides[key];
  if (env[key] !== undefined && env[key] !== null && env[key] !== '') return env[key];
  return fallback;
}

function parseBoolean(val: any, fallback: boolean): boolean {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'boolean') return val;
  const s = String(val).trim().toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return fallback;
}

function parseNumber(val: any, fallback: number): number {
  if (val === undefined || val === null || val === '') return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

export function getExaConfig(): ExaConfig {
  const env: Record<string, any> = (() => {
    try {
      const metaEnv = (import.meta as any)?.env ?? {};
      const procEnv = typeof process !== 'undefined' ? (process as any).env ?? {} : {};
      return { ...procEnv, ...metaEnv };
    } catch { return {}; }
  })();
  const overrides = readSettingsOverrides();

  const enabledRaw = resolveVal(overrides, env, 'VITE_EXA_ENABLED', resolveVal(overrides, env, 'EXA_ENABLED', 'true'));
  const apiKeyRaw = resolveVal(overrides, env, 'VITE_EXA_API_KEY', '') || resolveVal(overrides, env, 'EXA_API_KEY', '') || resolveVal(overrides, env, 'VITE_EXA_KEY', '');
  const baseRaw = resolveVal(overrides, env, 'VITE_EXA_BASE_URL', '') || resolveVal(overrides, env, 'EXA_BASE_URL', 'https://api.exa.ai');
  const numRaw = resolveVal(overrides, env, 'VITE_EXA_NUM_RESULTS', '5');
  const typeRaw = resolveVal(overrides, env, 'VITE_EXA_SEARCH_TYPE', 'auto');
  const timeoutRaw = resolveVal(overrides, env, 'VITE_EXA_TIMEOUT_MS', '15000');
  const maxAgeRaw = resolveVal(overrides, env, 'VITE_EXA_MAX_AGE_HOURS', '');

  const enabled = parseBoolean(enabledRaw, true);
  const apiKey = String(apiKeyRaw ?? '').trim();
  const baseURL = String(baseRaw ?? 'https://api.exa.ai').trim().replace(/\/+$/, '') || 'https://api.exa.ai';
  const type = String(typeRaw || 'auto').trim().toLowerCase() as ExaConfig['searchType'];
  const validTypes: ExaConfig['searchType'][] = ['auto', 'fast', 'instant', 'deep-lite', 'deep', 'deep-reasoning'];
  const searchType = validTypes.includes(type) ? type : 'auto';
  const numResults = Math.min(100, Math.max(1, parseNumber(numRaw, 5)));
  const timeoutMs = parseNumber(timeoutRaw, 15000);
  const maxAgeHours = maxAgeRaw === '' || maxAgeRaw === undefined || maxAgeRaw === null ? undefined : parseNumber(maxAgeRaw, undefined as any);

  return { enabled, apiKey, baseURL, numResults, searchType, maxAgeHours, timeoutMs };
}

export function isExaEnabled(config?: ExaConfig): boolean {
  const c = config ?? getExaConfig();
  const hasKey = typeof c.apiKey === 'string' && c.apiKey.trim().length > 0;
  const isProxyBase = typeof c.baseURL === 'string' && (c.baseURL.startsWith('/api/') || c.baseURL.includes('exa-proxy'));
  // For proxy bases server injects key, so client doesn't need it; otherwise need key
  const hasKeyOrProxy = hasKey || isProxyBase;
  return c.enabled === true && hasKeyOrProxy && !!c.baseURL;
}

function isRealBrowser(): boolean {
  if (typeof window === 'undefined' || typeof window.location === 'undefined') return false;
  if (typeof process !== 'undefined' && (process as any).env?.VITEST === 'true') return false;
  return typeof window.location.origin === 'string' && window.location.origin.startsWith('http');
}

export function getExaEndpoint(config?: ExaConfig): string {
  const c = config ?? getExaConfig();
  const base = (c.baseURL || '').trim().replace(/\/+$/, '');
  if (!base) return '';
  // If base already ends with /search, keep it; else append /search
  const searchUrl = base.endsWith('/search') ? base : `${base}/search`;
  // In real browser, proxy exa.ai through same-origin /api/exa-proxy to avoid CORS and hide key
  if (isRealBrowser() && searchUrl.startsWith('https://api.exa.ai')) {
    return searchUrl.replace('https://api.exa.ai', '/api/exa-proxy');
  }
  return searchUrl;
}

export function getExaConfigSource(): { source: 'settings' | 'env'; overrides: Record<string, any> } {
  const o = readSettingsOverrides();
  return { source: Object.keys(o).filter(k => k.includes('EXA')).length > 0 ? 'settings' : 'env', overrides: o };
}
