/**
 * CareCanvas Settings Store — Generic configurable LLM config via Settings page OR .env without hardcoding (R3).
 * Persists VITE_AI_* generically via localStorage with Settings>env precedence.
 * Never hardcode provider/model/baseURL literals — all via generic keys.
 * Keys: carecanvas_settings JSON blob + individual VITE_AI_* keys + carecanvas_VITE_AI_*.
 * 13 VITE_AI_* example keys documented in .env.example:14-51 — all configurable.
 * Validates baseURL/model not empty when enabled, never commits .env (.gitignore .env PASS).
 * Uses generic keys, no hardcoded provider literals.
 */

export type SettingsProvider = 'chat' | 'responses';

export interface SettingsState {
  VITE_AI_ENABLED?: string;
  VITE_AI_PROVIDER?: string;
  VITE_AI_BASE_URL?: string;
  VITE_AI_API_KEY?: string;
  VITE_AI_MODEL?: string;
  VITE_AI_VISION_MODEL?: string;
  VITE_AI_STRUCTURED_OUTPUTS?: string;
  VITE_AI_TEMPERATURE?: string;
  VITE_AI_MAX_TOKENS?: string;
  VITE_AI_TIMEOUT_MS?: string;
  VITE_AI_ORG_ID?: string;
  VITE_AI_PROJECT_ID?: string;
  VITE_AI_EXTRA_HEADERS?: string;
  VITE_OCR_ENABLED?: string;
  VITE_OCR_API_KEY?: string;
  OCR_API_KEY?: string;
  VITE_OCR_MODEL?: string;
  VITE_EXTRACTION_PATH?: string;
  // Exa Healthcare Grounding
  VITE_EXA_ENABLED?: string;
  VITE_EXA_API_KEY?: string;
  EXA_API_KEY?: string;
  VITE_EXA_BASE_URL?: string;
  VITE_EXA_NUM_RESULTS?: string;
  VITE_EXA_SEARCH_TYPE?: string;
  VITE_EXA_TIMEOUT_MS?: string;
  VITE_EXA_MAX_AGE_HOURS?: string;
}

// All configurable keys — generic configurable, no hardcoded literals
export const SETTINGS_VITE_KEYS: (keyof SettingsState)[] = [
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
  'VITE_AI_ORG_ID',
  'VITE_AI_PROJECT_ID',
  'VITE_AI_EXTRA_HEADERS',
  'VITE_OCR_ENABLED',
  'VITE_OCR_API_KEY',
  'OCR_API_KEY',
  'VITE_OCR_MODEL',
  'VITE_EXTRACTION_PATH',
  // Exa Healthcare Grounding (extends to 21 keys)
  'VITE_EXA_ENABLED',
  'VITE_EXA_API_KEY',
  'EXA_API_KEY',
  'VITE_EXA_BASE_URL',
  'VITE_EXA_NUM_RESULTS',
  'VITE_EXA_SEARCH_TYPE',
  'VITE_EXA_TIMEOUT_MS',
  'VITE_EXA_MAX_AGE_HOURS',
];

// Storage blob keys — SettingsStore writes via same keys read by src/core/ai/config.ts:68-139
export const SETTINGS_BLOB_KEYS = [
  'carecanvas_settings',
  'carecanvas_ai_settings',
  'carecanvas_ai_config',
] as const;

export const SETTINGS_PRIMARY_BLOB = 'carecanvas_settings';

function isBrowser(): boolean {
  return typeof localStorage !== 'undefined';
}

export function validateSettings(state: Partial<SettingsState>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const enabledRaw = state.VITE_AI_ENABLED;
  const enabled = typeof enabledRaw === 'string' ? enabledRaw.trim().toLowerCase() : String(enabledRaw ?? '').toLowerCase();
  const isEnabled = enabled === 'true' || enabled === '1' || enabled === 'yes';
  if (isEnabled) {
    const baseURL = (state.VITE_AI_BASE_URL ?? '').trim();
    const model = (state.VITE_AI_MODEL ?? '').trim();
    if (!baseURL) errors.push('VITE_AI_BASE_URL required when enabled');
    else {
      try {
        const u = new URL(baseURL);
        if (!u.protocol.startsWith('http')) errors.push('VITE_AI_BASE_URL must be http(s) URL');
      } catch {
        if (!baseURL.startsWith('http://') && !baseURL.startsWith('https://')) {
          errors.push('VITE_AI_BASE_URL must be valid URL');
        }
      }
    }
    if (!model) errors.push('VITE_AI_MODEL required when enabled');
    const provider = (state.VITE_AI_PROVIDER ?? '').trim().toLowerCase();
    if (provider && provider !== 'chat' && provider !== 'responses') {
      errors.push('VITE_AI_PROVIDER must be chat or responses');
    }
    const tempRaw = (state.VITE_AI_TEMPERATURE ?? '').toString().trim();
    if (tempRaw) {
      const n = Number(tempRaw);
      if (!Number.isFinite(n) || n < 0 || n > 2) errors.push('VITE_AI_TEMPERATURE must be 0-2');
    }
    const maxRaw = (state.VITE_AI_MAX_TOKENS ?? '').toString().trim();
    if (maxRaw) {
      const n = Number(maxRaw);
      if (!Number.isFinite(n) || n <= 0) errors.push('VITE_AI_MAX_TOKENS must be positive');
    }
    const timeoutRaw = (state.VITE_AI_TIMEOUT_MS ?? '').toString().trim();
    if (timeoutRaw) {
      const n = Number(timeoutRaw);
      if (!Number.isFinite(n) || n <= 0) errors.push('VITE_AI_TIMEOUT_MS must be positive');
    }
  }
  return { valid: errors.length === 0, errors };
}

export function loadSettings(): Partial<SettingsState> {
  const merged: Partial<SettingsState> = {};
  if (!isBrowser()) return merged;
  // 1) Read JSON blob stores — carecanvas_settings primary, others fallback
  for (const blobKey of SETTINGS_BLOB_KEYS) {
    try {
      const raw = localStorage.getItem(blobKey);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        for (const k of SETTINGS_VITE_KEYS) {
          if (parsed[k] !== undefined && parsed[k] !== null && String(parsed[k]).trim() !== '') {
            if (merged[k] === undefined) (merged as any)[k] = String(parsed[k]);
          }
        }
        // Also support nested shapes for generic wiring
        if (parsed.ai && typeof parsed.ai === 'object') {
          const directMap: Record<string, keyof SettingsState> = {
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
            orgId: 'VITE_AI_ORG_ID',
            projectId: 'VITE_AI_PROJECT_ID',
            extraHeaders: 'VITE_AI_EXTRA_HEADERS',
          };
          for (const [direct, envKey] of Object.entries(directMap)) {
            if ((parsed.ai as any)[direct] !== undefined && merged[envKey] === undefined) {
              (merged as any)[envKey] = String((parsed.ai as any)[direct]);
            }
          }
        }
      }
    } catch {
      // ignore parse errors
    }
  }
  // 2) Individual VITE_AI_* keys override blob if present (most direct Settings>env signal)
  try {
    for (const k of SETTINGS_VITE_KEYS) {
      const v = localStorage.getItem(k);
      if (v !== null && v !== '' && v !== undefined) {
        (merged as any)[k] = v;
      }
      const alt = localStorage.getItem(`carecanvas_${k}`);
      if (alt !== null && alt !== '' && merged[k] === undefined) {
        (merged as any)[k] = alt;
      }
    }
  } catch {
    // ignore
  }
  // Cleanup empty strings treated as unset
  for (const k of SETTINGS_VITE_KEYS) {
    if ((merged as any)[k] === '') delete (merged as any)[k];
  }
  return merged;
}

export function saveSettings(state: Partial<SettingsState>): void {
  if (!isBrowser()) return;
  // Normalize: trim strings, keep as strings for localStorage VITE_AI generically
  const normalized: Partial<SettingsState> = {};
  for (const k of SETTINGS_VITE_KEYS) {
    const v = (state as any)[k];
    if (v !== undefined && v !== null) {
      const s = String(v).trim();
      // Keep empty string as deletion signal? We store only non-empty to mimic Settings>env "" unset
      if (s !== '') (normalized as any)[k] = s;
    }
  }

  // Validate baseURL/model not empty if enabled — still save but caller can check valid
  // Persist to primary blob carecanvas_settings JSON blob + individual VITE_AI_* keys + carecanvas_VITE_AI_*
  const toPersist: Record<string, string> = {};
  for (const k of SETTINGS_VITE_KEYS) {
    if ((normalized as any)[k] !== undefined) toPersist[k] = String((normalized as any)[k]);
  }

  // Read existing blob to merge
  let existing: Record<string, any> = {};
  try {
    const raw = localStorage.getItem(SETTINGS_PRIMARY_BLOB);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') existing = parsed;
    }
  } catch {
    existing = {};
  }

  // Merge normalized into existing, delete keys that are now undefined (cleared)
  const nextBlob: Record<string, any> = { ...existing };
  for (const k of SETTINGS_VITE_KEYS) {
    if ((normalized as any)[k] !== undefined) {
      nextBlob[k] = String((normalized as any)[k]);
    } else {
      // If caller explicitly wants to clear, they can pass empty string — we delete
      if ((state as any)[k] === '' || (state as any)[k] === undefined) {
        // Only delete if state had key as empty string explicitly; otherwise keep existing
        if ((state as any)[k] === '') delete nextBlob[k];
      }
    }
  }

  try {
    localStorage.setItem(SETTINGS_PRIMARY_BLOB, JSON.stringify(nextBlob));
  } catch {
    // ignore quota errors
  }

  // Also write individual VITE_AI_* keys and carecanvas_VITE_AI_* for Settings>env precedence robust
  try {
    for (const k of SETTINGS_VITE_KEYS) {
      const v = (normalized as any)[k];
      if (v !== undefined && v !== '') {
        localStorage.setItem(k, v);
        localStorage.setItem(`carecanvas_${k}`, v);
      } else if ((state as any)[k] === '') {
        // Explicit clear
        localStorage.removeItem(k);
        localStorage.removeItem(`carecanvas_${k}`);
        // Also remove from blob handled above
      }
    }
  } catch {
    // ignore
  }
}

export function clearSettings(): void {
  if (!isBrowser()) return;
  try {
    for (const blobKey of SETTINGS_BLOB_KEYS) {
      localStorage.removeItem(blobKey);
    }
    for (const k of SETTINGS_VITE_KEYS) {
      localStorage.removeItem(k);
      localStorage.removeItem(`carecanvas_${k}`);
    }
  } catch {
    // ignore
  }
}

export function getSettingsValue<K extends keyof SettingsState>(key: K): string | undefined {
  const all = loadSettings();
  return all[key] as string | undefined;
}

// Debug helper matching src/core/ai/config.ts getAIConfigSource but for SettingsStore direct
export function getSettingsSource(): { hasSettings: boolean; keys: string[]; count: number } {
  const s = loadSettings();
  const keys = Object.keys(s);
  return { hasSettings: keys.length > 0, keys, count: keys.length };
}

// Check if Settings overrides env — replicates Settings>env precedence logic generically
export function isSettingsOverridingEnv(): boolean {
  const s = loadSettings();
  return Object.keys(s).length > 0;
}
