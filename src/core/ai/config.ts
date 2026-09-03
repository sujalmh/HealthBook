/**
 * Healthbook AI Core — Config
 * Runtime configuration with SettingsStore > Environment variables precedence.
 */

import type { AIConfig, AIProvider } from './types.ts';

const SETTINGS_STORE_KEYS = ['healthbook_settings', 'healthbook_ai_settings', 'healthbook_ai_config'] as const;
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

function readSettingsStoreOverrides(): Record<string, unknown> {
  const overrides: Record<string, unknown> = {};
  if (typeof localStorage === 'undefined') return overrides;

  for (const storeKey of SETTINGS_STORE_KEYS) {
    try {
      const raw = localStorage.getItem(storeKey);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          if (v !== undefined && v !== null && v !== '' && overrides[k] === undefined) {
            overrides[k] = v;
          }
        }
      }
    } catch { /* intentionally empty */ }
  }

  for (const k of SETTINGS_KEYS) {
    try {
      const v = localStorage.getItem(k) ?? localStorage.getItem(`healthbook_${k}`);
      if (v !== null && v !== '' && overrides[k] === undefined) {
        overrides[k] = v;
      }
    } catch { /* intentionally empty */ }
  }

  return overrides;
}

function resolveValue(overrides: Record<string, unknown>, env: Record<string, unknown>, key: string, fallback: unknown): unknown {
  if (overrides[key] !== undefined && overrides[key] !== null && overrides[key] !== '') {
    return overrides[key];
  }
  if (env[key] !== undefined && env[key] !== null && env[key] !== '') {
    return env[key];
  }
  return fallback;
}

function parseBoolean(val: unknown, fallback: boolean): boolean {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'boolean') return val;
  const s = String(val).trim().toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return fallback;
}

function parseNumber(val: unknown, fallback: number): number {
  if (val === undefined || val === null || val === '') return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function parseProvider(val: unknown, fallback: AIProvider): AIProvider {
  if (typeof val === 'string') {
    const p = val.trim().toLowerCase() as AIProvider;
    if (VALID_PROVIDERS.includes(p)) return p;
  }
  return fallback;
}

export function getAIConfig(): AIConfig {
  // IMPORTANT: this must reference the exact static token `import.meta.env` —
  // optional-chained/cast forms like `(import.meta as X)?.env` survive the
  // production build as a runtime access, so Vite never bakes the VITE_* vars
  // and the browser bundle always sees an empty env (prod "AI not configured").
  const env: Record<string, unknown> = (() => {
    try {
      const metaEnv = import.meta.env ?? {};
      const procEnv = typeof globalThis !== 'undefined' && 'process' in globalThis
        ? ((globalThis as unknown as { process?: { env?: Record<string, unknown> } }).process?.env ?? {})
        : {};
      return { ...procEnv, ...metaEnv };
    } catch {
      return {};
    }
  })();

  const overrides = readSettingsStoreOverrides();

  const enabledRaw = resolveValue(overrides, env, 'VITE_AI_ENABLED', 'true');
  const providerRaw = resolveValue(overrides, env, 'VITE_AI_PROVIDER', 'responses');
  const baseURLRaw = resolveValue(overrides, env, 'VITE_AI_BASE_URL', 'https://opencode.ai/zen/go/v1/responses');
  const apiKeyRaw =
    resolveValue(overrides, env, 'VITE_AI_API_KEY', '') ||
    resolveValue(overrides, env, 'AI_API_KEY', '') ||
    resolveValue(overrides, env, 'OPENAI_API_KEY', '') ||
    resolveValue(overrides, env, 'GEMINI_API_KEY', '');
  const modelRaw = resolveValue(overrides, env, 'VITE_AI_MODEL', 'muse-spark-1.2-contributor');
  const visionModelRaw = resolveValue(overrides, env, 'VITE_AI_VISION_MODEL', 'muse-spark-1.2-contributor');
  const structuredRaw = resolveValue(overrides, env, 'VITE_AI_STRUCTURED_OUTPUTS', 'true');
  const temperatureRaw = resolveValue(overrides, env, 'VITE_AI_TEMPERATURE', '0.1');
  const maxTokensRaw = resolveValue(overrides, env, 'VITE_AI_MAX_TOKENS', '16384');
  const timeoutRaw = resolveValue(overrides, env, 'VITE_AI_TIMEOUT_MS', '120000');
  const ocrApiKeyRaw = resolveValue(overrides, env, 'VITE_OCR_API_KEY', '') || resolveValue(overrides, env, 'OCR_API_KEY', '') || resolveValue(overrides, env, 'MISTRAL_API_KEY', '');
  const ocrModelRaw = resolveValue(overrides, env, 'VITE_OCR_MODEL', 'mistral-ocr-latest');
  const ocrEnabledRaw = resolveValue(overrides, env, 'VITE_OCR_ENABLED', 'true');
  const extractionPathRaw = resolveValue(overrides, env, 'VITE_EXTRACTION_PATH', 'ocr_then_ai');

  const enabled = parseBoolean(enabledRaw, true);
  const baseURL = String(baseURLRaw ?? 'https://opencode.ai/zen/go/v1/responses').trim().replace(/\/+$/, '');
  let provider = parseProvider(providerRaw, 'responses');

  if (baseURL.includes('opencode.ai') || baseURL.endsWith('/responses')) {
    provider = 'responses';
  } else if (baseURL.endsWith('/chat/completions')) {
    provider = 'chat';
  }

  const apiKey = String(apiKeyRaw ?? '').trim();
  const model = String(modelRaw ?? 'muse-spark-1.2-contributor').trim();
  const visionModel = String(visionModelRaw ?? '').trim() || model;
  const ocrApiKey = String(ocrApiKeyRaw ?? '').trim();
  const ocrModel = String(ocrModelRaw ?? 'mistral-ocr-latest').trim();
  const ocrEnabled = parseBoolean(ocrEnabledRaw, true);
  const extractionPath = extractionPathRaw === 'direct_vision' ? 'direct_vision' : 'ocr_then_ai';

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
    ocrEnabled,
    ocrApiKey,
    ocrModel,
    extractionPath,
  };
}

export function isAIEnabled(_config?: AIConfig): boolean {
  // AI is the primary pipeline and is always enabled
  return true;
}

export function isResponsesProvider(config?: AIConfig): boolean {
  const c = config ?? getAIConfig();
  if (c.provider === 'responses') return true;
  if (typeof c.baseURL === 'string' && (c.baseURL.includes('opencode.ai') || c.baseURL.trim().replace(/\/+$/, '').endsWith('/responses'))) return true;
  return false;
}

function isRealBrowser(): boolean {
  if (typeof window === 'undefined' || typeof window.location === 'undefined') return false;
  const proc = (globalThis as unknown as { process?: { env?: Record<string, unknown> } }).process;
  if (proc?.env?.VITEST === 'true') return false;
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

  if (isRealBrowser() && fullUrl.startsWith('https://opencode.ai/')) {
    return fullUrl.replace('https://opencode.ai/', '/api/ai-proxy/');
  }

  return fullUrl;
}

export function getAIModel(config?: AIConfig, forVision: boolean = false): string {
  const c = config ?? getAIConfig();
  if (forVision && c.visionModel && c.visionModel.trim() !== '') return c.visionModel.trim();
  if (c.model && c.model.trim() !== '') return c.model.trim();
  // Config-driven fallback: single source of truth for default models (literal appears only here)
  return isResponsesProvider(c) ? 'muse-spark-1.2-contributor' : 'deepseek-v4-flash-vision-exp';
}

export function getAIConfigSource(): { source: 'settings' | 'env'; overrides: Record<string, unknown> } {
  const overrides = readSettingsStoreOverrides();
  return {
    source: Object.keys(overrides).length > 0 ? 'settings' : 'env',
    overrides,
  };
}
