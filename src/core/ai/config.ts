/**
 * CareCanvas AI Core — Config
 * Runtime configuration with SettingsStore > Environment variables precedence.
 * Standardizes endpoints for OpenAI-compatible providers (/chat/completions & /responses).
 */

import type { AIConfig, AIProvider } from './types.ts';

const SETTINGS_STORE_KEYS = ['carecanvas_settings', 'carecanvas_ai_settings', 'carecanvas_ai_config'] as const;
const VALID_PROVIDERS: AIProvider[] = ['chat', 'responses'];

const SETTINGS_KEYS = [
  'VITE_AI_ENABLED',
  'VITE_AI_PROVIDER',
  'VITE_AI_BASE_URL',
  'VITE_AI_API_KEY',
  'VITE_AI_MODEL',
  'VITE_AI_VISION_MODEL',
  'VITE_AI_STRUCTURED_OUTPUTS',
  'VITE_AI_TEMPERATURE',
  'VITE_AI_MAX_TOKENS',
  'VITE_AI_TIMEOUT_MS',
] as const;

function readSettingsStoreOverrides(): Record<string, any> {
  const overrides: Record<string, any> = {};
  if (typeof localStorage === 'undefined') return overrides;

  // 1. Read JSON blob settings
  for (const storeKey of SETTINGS_STORE_KEYS) {
    try {
      const raw = localStorage.getItem(storeKey);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          if (v !== undefined && v !== null && v !== '' && overrides[k] === undefined) {
            overrides[k] = v;
          }
        }
      }
    } catch {}
  }

  // 2. Read individual localStorage items
  for (const k of SETTINGS_KEYS) {
    try {
      const v = localStorage.getItem(k) ?? localStorage.getItem(`carecanvas_${k}`);
      if (v !== null && v !== '' && overrides[k] === undefined) {
        overrides[k] = v;
      }
    } catch {}
  }

  return overrides;
}

function resolveValue(overrides: Record<string, any>, env: Record<string, any>, key: string, fallback: any): any {
  if (overrides[key] !== undefined && overrides[key] !== null && overrides[key] !== '') {
    return overrides[key];
  }
  if (env[key] !== undefined && env[key] !== null && env[key] !== '') {
    return env[key];
  }
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

function parseProvider(val: any, fallback: AIProvider): AIProvider {
  if (typeof val === 'string') {
    const p = val.trim().toLowerCase() as AIProvider;
    if (VALID_PROVIDERS.includes(p)) return p;
  }
  return fallback;
}

export function getAIConfig(): AIConfig {
  const env: Record<string, any> = (() => {
    try {
      const metaEnv = (import.meta as any)?.env ?? {};
      const procEnv = typeof process !== 'undefined' ? (process as any).env ?? {} : {};
      return { ...procEnv, ...metaEnv };
    } catch {
      return {};
    }
  })();

  const overrides = readSettingsStoreOverrides();

  const enabledRaw = resolveValue(overrides, env, 'VITE_AI_ENABLED', 'false');
  const providerRaw = resolveValue(overrides, env, 'VITE_AI_PROVIDER', 'chat');
  const baseURLRaw = resolveValue(overrides, env, 'VITE_AI_BASE_URL', '');
  const apiKeyRaw = resolveValue(overrides, env, 'VITE_AI_API_KEY', '');
  const modelRaw = resolveValue(overrides, env, 'VITE_AI_MODEL', '');
  const visionModelRaw = resolveValue(overrides, env, 'VITE_AI_VISION_MODEL', '');
  const structuredRaw = resolveValue(overrides, env, 'VITE_AI_STRUCTURED_OUTPUTS', 'true');
  const temperatureRaw = resolveValue(overrides, env, 'VITE_AI_TEMPERATURE', '0.1');
  const maxTokensRaw = resolveValue(overrides, env, 'VITE_AI_MAX_TOKENS', '8192');
  const timeoutRaw = resolveValue(overrides, env, 'VITE_AI_TIMEOUT_MS', '120000');

  const enabled = parseBoolean(enabledRaw, false);
  const baseURL = String(baseURLRaw ?? '').trim().replace(/\/+$/, '');
  let provider = parseProvider(providerRaw, 'chat');

  if (baseURL.includes('opencode.ai') || baseURL.endsWith('/responses')) {
    provider = 'responses';
  } else if (baseURL.endsWith('/chat/completions')) {
    provider = 'chat';
  }

  const apiKey = String(apiKeyRaw ?? '').trim();
  const model = String(modelRaw ?? '').trim();
  const visionModel = String(visionModelRaw ?? '').trim() || model;

  return {
    enabled,
    provider,
    baseURL,
    apiKey,
    model,
    visionModel,
    structuredOutputs: parseBoolean(structuredRaw, true),
    temperature: parseNumber(temperatureRaw, 0.1),
    maxTokens: parseNumber(maxTokensRaw, provider === 'responses' ? 16384 : 8192),
    timeoutMs: parseNumber(timeoutRaw, 120000),
  };
}

export function isAIEnabled(config?: AIConfig): boolean {
  const c = config ?? getAIConfig();
  const hasKey = typeof c.apiKey === 'string' && c.apiKey.trim().length > 0;
  const hasBase = typeof c.baseURL === 'string' && c.baseURL.trim().length > 0;
  const model = getAIModel(c);
  const hasModel = typeof model === 'string' && model.trim().length > 0;
  return c.enabled === true && hasKey && hasBase && hasModel;
}

export function isResponsesProvider(config?: AIConfig): boolean {
  const c = config ?? getAIConfig();
  if (c.provider === 'responses') return true;
  if (typeof c.baseURL === 'string' && (c.baseURL.includes('opencode.ai') || c.baseURL.trim().replace(/\/+$/, '').endsWith('/responses'))) return true;
  return false;
}

function isRealBrowser(): boolean {
  if (typeof window === 'undefined' || typeof window.location === 'undefined') return false;
  if (typeof process !== 'undefined' && (process as any).env?.VITEST === 'true') return false;
  return typeof window.location.origin === 'string' && window.location.origin.startsWith('http');
}

export function getAIEndpoint(config?: AIConfig): string {
  const c = config ?? getAIConfig();
  const base = (c.baseURL || '').trim().replace(/\/+$/, '');
  if (!base) return '';

  let fullUrl: string;
  if (base.endsWith('/responses') || base.endsWith('/chat/completions')) {
    fullUrl = base;
  } else {
    fullUrl = isResponsesProvider(c) ? `${base}/responses` : `${base}/chat/completions`;
  }

  // In browser, proxy opencode.ai calls through same-origin /api/ai-proxy to avoid CORS preflight failures
  if (isRealBrowser() && fullUrl.startsWith('https://opencode.ai/')) {
    return fullUrl.replace('https://opencode.ai/', '/api/ai-proxy/');
  }

  return fullUrl;
}

export function getAIModel(config?: AIConfig, forVision: boolean = false): string {
  const c = config ?? getAIConfig();
  if (forVision && c.visionModel && c.visionModel.trim() !== '') return c.visionModel.trim();
  if (c.model && c.model.trim() !== '') return c.model.trim();
  return isResponsesProvider(c) ? 'muse-spark-1.2-contributor' : 'deepseek-v4-flash-vision-exp';
}

export function getAIConfigSource(): { source: 'settings' | 'env'; overrides: Record<string, any> } {
  const overrides = readSettingsStoreOverrides();
  return {
    source: Object.keys(overrides).length > 0 ? 'settings' : 'env',
    overrides,
  };
}
