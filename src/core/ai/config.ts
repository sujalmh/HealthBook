/**
 * CareCanvas AI Core — Config
 * Generic configurable runtime config reading with Settings>env precedence.
 * Reads import.meta.env.VITE_AI_* OR SettingsStore via localStorage.
 * SettingsStore overrides import.meta.env if present (Q9).
 * Never hardcoded provider/model/baseURL literals — all via config.
 */

import type { AIConfig, AIProvider } from './types.ts';

// Keys for SettingsStore persistence — will be written by SettingsView in M3
const SETTINGS_STORE_KEYS = [
  'carecanvas_settings',
  'carecanvas_ai_settings',
  'carecanvas_ai_config',
];

// Valid provider literals handled generically
const VALID_PROVIDERS: AIProvider[] = ['chat', 'responses'];

/**
 * Read SettingsStore overrides from localStorage.
 * SettingsStore is owned by worker_settings (M3) but read here generically.
 * Precedence: SettingsStore > import.meta.env
 * Supports both JSON blob and individual VITE_AI_* keys in localStorage.
 */
function readSettingsStoreOverrides(): Record<string, any> {
  const overrides: Record<string, any> = {};
  // Check JSON blob stores
  for (const storeKey of SETTINGS_STORE_KEYS) {
    try {
      // VITE_AI config via SettingsStore
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(storeKey) : null;
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      // Support both flat and nested shapes: { VITE_AI_ENABLED: ..., VITE_AI_PROVIDER: ... } or { ai: { enabled: ... } }
      if (parsed && typeof parsed === 'object') {
        // Flat VITE_AI_* keys
        for (const k of Object.keys(parsed)) {
          if (k.startsWith('VITE_AI_')) {
            overrides[k] = parsed[k];
          }
        }
        // Nested ai config shape support
        if (parsed.ai && typeof parsed.ai === 'object') {
          for (const [k, v] of Object.entries(parsed.ai)) {
            const envKey = `VITE_AI_${k.toUpperCase()}`;
            if (overrides[envKey] === undefined) overrides[envKey] = v;
            // Also support direct keys like baseURL -> BASE_URL
            const altKey = `VITE_AI_${k
              .replace(/([A-Z])/g, '_$1')
              .toUpperCase()}`;
            if (overrides[altKey] === undefined) overrides[altKey] = v;
          }
        }
        // Direct keys without prefix fallback
        const directMap: Record<string, string> = {
          enabled: 'VITE_AI_ENABLED',
          provider: 'VITE_AI_PROVIDER',
          baseURL: 'VITE_AI_BASE_URL',
          baseUrl: 'VITE_AI_BASE_URL',
          apiKey: 'VITE_AI_API_KEY',
          model: 'VITE_AI_MODEL',
          visionModel: 'VITE_AI_VISION_MODEL',
          structuredOutputs: 'VITE_AI_STRUCTURED_OUTPUTS',
          temperature: 'VITE_AI_TEMPERATURE',
          maxTokens: 'VITE_AI_MAX_TOKENS',
          timeoutMs: 'VITE_AI_TIMEOUT_MS',
        };
        for (const [direct, envKey] of Object.entries(directMap)) {
          if (parsed[direct] !== undefined && overrides[envKey] === undefined) {
            overrides[envKey] = parsed[direct];
          }
        }
      }
    } catch {
      // ignore parse errors — treat as no override
    }
  }

  // Also check individual VITE_AI_* localStorage keys (Settings>env individual)
  const individualKeys = [
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
  ];
  // Treat "" as unset before individual fallback (fix WARN: "" !== undefined loses individual fallback)
  for (const k of Object.keys(overrides)) {
    if (overrides[k] === '') delete overrides[k];
  }
  try {
    if (typeof localStorage !== 'undefined') {
      for (const k of individualKeys) {
        const v = localStorage.getItem(k);
        // Use SettingsStore individual key if present (VITE_AI via localStorage)
        if (v !== null && v !== '') {
          // Only override if not already set from blob; treat "" as unset
          if (!overrides[k]) overrides[k] = v;
        }
      }
      // Also check VITE_AI_ via localStorage with prefix carecanvas_
      for (const k of individualKeys) {
        const alt = localStorage.getItem(`carecanvas_${k}`);
        if (alt !== null && alt !== '' && !overrides[k]) overrides[k] = alt;
      }
    }
  } catch {}

  return overrides;
}

/**
 * Helper to resolve a config value with Settings>env precedence.
 * Reads VITE_AI_* via SettingsStore first, then import.meta.env.
 */
function resolveConfigValue(
  settingsOverrides: Record<string, any>,
  env: Record<string, any>,
  viteKey: string,
  fallback: any = undefined
): any {
  // SettingsStore overrides import.meta.env if present (Q9)
  if (settingsOverrides[viteKey] !== undefined && settingsOverrides[viteKey] !== null && settingsOverrides[viteKey] !== '') {
    return settingsOverrides[viteKey];
  }
  // import.meta.env.VITE_AI_* generically
  const envVal = env[viteKey];
  if (envVal !== undefined && envVal !== null && envVal !== '') {
    return envVal;
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

/**
 * Get generic AI config with Settings>env precedence.
 * All values are configurable, no hardcoded literals for provider/model/baseURL.
 */
export function getAIConfig(): AIConfig {
  // import.meta.env.VITE_AI_* — Vite exposes only VITE_ prefix at build-time
  const env: Record<string, any> = (() => {
    try {
      // Access via import.meta.env generically
      const metaEnv = (import.meta as any)?.env ?? {};
      // Also fallback to process.env for Node/test contexts
      const procEnv = typeof process !== 'undefined' ? (process as any).env ?? {} : {};
      return { ...procEnv, ...metaEnv };
    } catch {
      return {};
    }
  })();

  const settingsOverrides = readSettingsStoreOverrides();

  // Resolve each VITE_AI_* with Settings>env precedence
  const enabledRaw = resolveConfigValue(settingsOverrides, env, 'VITE_AI_ENABLED', 'false');
  const providerRaw = resolveConfigValue(settingsOverrides, env, 'VITE_AI_PROVIDER', 'chat');
  const baseURLRaw = resolveConfigValue(settingsOverrides, env, 'VITE_AI_BASE_URL', '');
  const apiKeyRaw = resolveConfigValue(settingsOverrides, env, 'VITE_AI_API_KEY', '');
  const modelRaw = resolveConfigValue(settingsOverrides, env, 'VITE_AI_MODEL', '');
  const visionModelRaw = resolveConfigValue(settingsOverrides, env, 'VITE_AI_VISION_MODEL', '');
  const structuredRaw = resolveConfigValue(settingsOverrides, env, 'VITE_AI_STRUCTURED_OUTPUTS', 'true');
  const temperatureRaw = resolveConfigValue(settingsOverrides, env, 'VITE_AI_TEMPERATURE', '0.1');
  const maxTokensRaw = resolveConfigValue(settingsOverrides, env, 'VITE_AI_MAX_TOKENS', '4096');
  const timeoutRaw = resolveConfigValue(settingsOverrides, env, 'VITE_AI_TIMEOUT_MS', '30000');

  const enabled = parseBoolean(enabledRaw, false);
  const provider = parseProvider(providerRaw, 'chat');
  const baseURL = typeof baseURLRaw === 'string' ? baseURLRaw.trim().replace(/\/+$/, '') : String(baseURLRaw ?? '').trim().replace(/\/+$/, '');
  const apiKey = typeof apiKeyRaw === 'string' ? apiKeyRaw.trim() : String(apiKeyRaw ?? '').trim();
  const model = typeof modelRaw === 'string' ? modelRaw.trim() : String(modelRaw ?? '').trim();
  // VITE_AI_VISION_MODEL defaults to VITE_AI_MODEL if not set
  const visionModel = typeof visionModelRaw === 'string' && visionModelRaw.trim() !== '' ? visionModelRaw.trim() : model;
  const structuredOutputs = parseBoolean(structuredRaw, true);
  const temperature = parseNumber(temperatureRaw, 0.1);
  const maxTokens = parseNumber(maxTokensRaw, 4096);
  const timeoutMs = parseNumber(timeoutRaw, 30000);

  return {
    enabled,
    provider,
    baseURL,
    apiKey,
    model,
    visionModel,
    structuredOutputs,
    temperature,
    maxTokens,
    timeoutMs,
  };
}

/**
 * Is AI enabled and has required credentials?
 * Fallback heuristic only when VITE_AI_ENABLED=false or key absent (Q10).
 * When baseURL is proxied via /api/ai, apiKey may be injected server-side
 * from non-VITE env (AI_API_KEY / OPENCODE_API_KEY), so allow missing client key in that mode.
 */
export function isAIEnabled(config?: AIConfig): boolean {
  const c = config ?? getAIConfig();
  const isProxy = typeof c.baseURL === 'string' && c.baseURL.startsWith('/api/');
  const hasKey = typeof c.apiKey === 'string' && c.apiKey.length > 0;
  // If proxied, server may inject key — don't require client key
  const keyOk = isProxy ? true : hasKey;
  return c.enabled === true && keyOk && typeof c.baseURL === 'string' && c.baseURL.length > 0 && typeof c.model === 'string' && c.model.length > 0;
}

/**
 * Check if provider is chat vs responses generically.
 */
export function isResponsesProvider(config?: AIConfig): boolean {
  const c = config ?? getAIConfig();
  return c.provider === 'responses';
}

export function isChatProvider(config?: AIConfig): boolean {
  const c = config ?? getAIConfig();
  return c.provider === 'chat';
}

/**
 * Compose endpoint URL generically via VITE_AI_PROVIDER.
 * For provider=chat -> {baseURL}/chat/completions
 * For provider=responses -> {baseURL}/responses
 * No hardcoded baseURL string — uses config value.
 */
export function getAIEndpoint(config?: AIConfig): string {
  const c = config ?? getAIConfig();
  const base = c.baseURL.replace(/\/+$/, '');
  if (!base) return '';
  if (c.provider === 'responses') {
    return `${base}/responses`;
  }
  // default chat
  return `${base}/chat/completions`;
}

/**
 * Get model for request — uses VITE_AI_MODEL or VITE_AI_VISION_MODEL generically.
 */
export function getAIModel(config?: AIConfig, forVision: boolean = false): string {
  const c = config ?? getAIConfig();
  if (forVision && c.visionModel) return c.visionModel;
  return c.model;
}

/**
 * Debug helper — logs current config source (SettingsStore vs env)
 */
export function getAIConfigSource(): { source: 'settings' | 'env' | 'default'; overrides: Record<string, any> } {
  const overrides = readSettingsStoreOverrides();
  const hasOverrides = Object.keys(overrides).length > 0;
  return {
    source: hasOverrides ? 'settings' : 'env',
    overrides,
  };
}
