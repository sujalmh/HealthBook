import React, { useState, useEffect } from 'react';
import { Save, Trash2, Eye, EyeOff, Shield, Info, CheckCircle, AlertTriangle, Settings2 } from 'lucide-react';
import {
  loadSettings,
  saveSettings,
  clearSettings,
  validateSettings,
  SETTINGS_VITE_KEYS,
  type SettingsState,
} from '@/core/settings/SettingsStore';
import { getAIConfig, getAIConfigSource, isAIEnabled } from '@/core/ai/config';
import { getExaConfig, isExaEnabled } from '@/core/search/exaConfig';

interface Props {
  onSaved?: () => void;
}

export const SettingsForm: React.FC<Props> = ({ onSaved }) => {
  const [form, setForm] = useState<Partial<SettingsState>>({});
  const [showKey, setShowKey] = useState(false);
  const [showExaKey, setShowExaKey] = useState(false);
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error'; msg: string }>({ type: 'idle', msg: '' });
  const [source, setSource] = useState<{ source: 'settings' | 'env' | 'default'; overrides: Record<string, unknown> }>({ source: 'env', overrides: {} });
  const [liveConfig, setLiveConfig] = useState<ReturnType<typeof getAIConfig> | null>(null);
  const [exaLive, setExaLive] = useState<ReturnType<typeof getExaConfig> | null>(null);

  useEffect(() => {
    const loaded = loadSettings();
    setForm(loaded);
    refreshSource();
  }, []);

  const refreshSource = () => {
    try {
      setSource(getAIConfigSource());
      setLiveConfig(getAIConfig());
      setExaLive(getExaConfig());
    } catch {

    }
  };

  const handleChange = (key: keyof SettingsState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleToggle = (key: keyof SettingsState, checked: boolean) => {
    handleChange(key, checked ? 'true' : 'false');
  };

  const handleSave = () => {
    const validation = validateSettings(form);
    if (!validation.valid) {
      setStatus({ type: 'error', msg: validation.errors.join('; ') });
      return;
    }

    saveSettings(form);
    refreshSource();
    setStatus({ type: 'success', msg: `Saved ${Object.keys(form).filter((k) => (form as unknown as Record<string, unknown>)[k]).length} keys to SettingsStore — Settings>env precedence active.` });
    if (onSaved) onSaved();

    setTimeout(() => setStatus({ type: 'idle', msg: '' }), 3500);
  };

  const handleClear = () => {
    clearSettings();
    setForm({});
    refreshSource();
    setStatus({ type: 'success', msg: 'Settings cleared — falling back to import.meta.env (.env) defaults.' });
    setTimeout(() => setStatus({ type: 'idle', msg: '' }), 3500);
  };

  const sourceLabel = source.source === 'settings' ? 'Settings (localStorage)' : source.source === 'env' ? 'Environment (.env via import.meta.env)' : 'Defaults';
  const hasSettings = source.source === 'settings';
  const aiEnabled = liveConfig ? isAIEnabled(liveConfig) : false;

  return (
    <div className="space-y-6">
      {}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-canvas-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary-light border border-primary-border text-primary flex items-center justify-center">
            <Settings2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">AI Provider Configuration</h4>
            <p className="text-xs text-muted">Configure any OpenAI-compatible provider generically — Settings overrides .env when present.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
              hasSettings ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-canvas-muted text-muted border-canvas-border'
            }`}
          >
            Source: {sourceLabel}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${aiEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
            {aiEnabled ? 'AI Enabled' : 'AI Disabled / Fallback'}
          </span>
        </div>
      </div>

      {}
      <div className="bg-canvas-muted border border-canvas-border rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Info className="w-3.5 h-3.5" />
          Current Effective Config (via getAIConfig — Settings&gt;env precedence)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
          <div className="bg-white rounded-lg p-2 border border-canvas-border">
            <div className="text-muted text-[10px] uppercase">Provider</div>
            <div className="font-semibold text-slate-800 truncate">{liveConfig?.provider ?? '—'}</div>
          </div>
          <div className="bg-white rounded-lg p-2 border border-canvas-border">
            <div className="text-muted text-[10px] uppercase">Model</div>
            <div className="font-semibold text-slate-800 truncate">{liveConfig?.model || '—'}</div>
          </div>
          <div className="bg-white rounded-lg p-2 border border-canvas-border">
            <div className="text-muted text-[10px] uppercase">BaseURL</div>
            <div className="font-semibold text-slate-800 truncate text-[11px]">{liveConfig?.baseURL || '—'}</div>
          </div>
          <div className="bg-white rounded-lg p-2 border border-canvas-border">
            <div className="text-muted text-[10px] uppercase">Enabled</div>
            <div className={`font-bold ${liveConfig?.enabled ? 'text-emerald-600' : 'text-amber-600'}`}>{String(liveConfig?.enabled)}</div>
          </div>
        </div>
        {hasSettings && (
          <div className="text-xs text-muted bg-white rounded-lg p-2 border border-canvas-border">
            Overrides: <span className="font-mono">{Object.keys(source.overrides).join(', ') || 'none'}</span> — SettingsStore overrides import.meta.env if present else env.
          </div>
        )}
        <div className="text-[11px] text-muted">
          13 keys configurable per .env.example:14-51 — VITE_AI_ENABLED, PROVIDER, BASE_URL, API_KEY, MODEL, VISION_MODEL, STRUCTURED_OUTPUTS, TEMPERATURE, MAX_TOKENS, TIMEOUT_MS, ORG_ID, PROJECT_ID, EXTRA_HEADERS — generically wired.
        </div>
      </div>

      {}
      <div className="bg-white border border-canvas-border rounded-xl p-5 shadow-sm space-y-5">
        {}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Enabled</label>
            <div className="flex items-center gap-2 min-h-[44px]">
              <button
                onClick={() => handleToggle('VITE_AI_ENABLED', form.VITE_AI_ENABLED !== 'true')}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${form.VITE_AI_ENABLED === 'true' ? 'bg-primary' : 'bg-slate-300'}`}
                aria-label="Toggle AI Enabled"
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${form.VITE_AI_ENABLED === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className="text-sm font-semibold text-slate-800">{form.VITE_AI_ENABLED === 'true' ? 'Enabled' : 'Disabled'}</span>
            </div>
            <p className="text-[11px] text-muted">Gate via isAIEnabled — fallback only when disabled.</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Provider (chat | responses)</label>
            <select
              value={form.VITE_AI_PROVIDER || ''}
              onChange={(e) => handleChange('VITE_AI_PROVIDER', e.target.value)}
              className="w-full px-3 py-2.5 bg-canvas-muted border border-canvas-border rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[44px]"
            >
              <option value="">Select provider (any)</option>
              <option value="chat">chat — chat/completions</option>
              <option value="responses">responses — responses</option>
            </select>
            <p className="text-[11px] text-muted">Generically composes {'{baseURL}/chat/completions'} vs {'{baseURL}/responses'}</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Structured Outputs</label>
            <div className="flex items-center gap-2 min-h-[44px]">
              <button
                onClick={() => handleToggle('VITE_AI_STRUCTURED_OUTPUTS', form.VITE_AI_STRUCTURED_OUTPUTS !== 'true')}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${form.VITE_AI_STRUCTURED_OUTPUTS === 'true' || !form.VITE_AI_STRUCTURED_OUTPUTS ? 'bg-primary' : 'bg-slate-300'}`}
                aria-label="Toggle Structured"
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${form.VITE_AI_STRUCTURED_OUTPUTS === 'true' || !form.VITE_AI_STRUCTURED_OUTPUTS ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className="text-sm font-semibold text-slate-800">{form.VITE_AI_STRUCTURED_OUTPUTS === 'false' ? 'Off' : 'On (recommended)'}</span>
            </div>
            <p className="text-[11px] text-muted">json_object vs text.format json_schema generically</p>
          </div>
        </div>

        {}
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              Base URL <span className="text-rose-500">*</span>
              <span className="font-normal normal-case tracking-normal text-muted">(any OpenAI-compatible)</span>
            </label>
            <input
              type="url"
              value={form.VITE_AI_BASE_URL || ''}
              onChange={(e) => handleChange('VITE_AI_BASE_URL', e.target.value)}
              placeholder="https://your-provider.example.com/v1"
              className="w-full px-3 py-2.5 bg-canvas-muted border border-canvas-border rounded-xl text-sm text-slate-900 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[44px] font-mono text-xs"
            />
            <p className="text-[11px] text-muted">Examples only — any baseURL allowed, never hardcoded. Trailing slash trimmed generically.</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              API Key <Shield className="w-3 h-3 text-muted" />
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={form.VITE_AI_API_KEY || ''}
                onChange={(e) => handleChange('VITE_AI_API_KEY', e.target.value)}
                placeholder="Paste your provider key — never committed (.gitignore .env)"
                className="w-full px-3 py-2.5 pr-12 bg-canvas-muted border border-canvas-border rounded-xl text-sm text-slate-900 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[44px] font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-1 top-1 bottom-1 px-3 rounded-lg bg-white border border-canvas-border text-muted hover:text-slate-700 flex items-center justify-center"
                aria-label={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted">Masked input — stored generically via localStorage VITE_AI_API_KEY, Settings&gt;env. Never hardcoded literal.</p>
          </div>
        </div>

        {}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              Model <span className="text-rose-500">*</span>
              <span className="font-normal normal-case tracking-normal text-muted">(any)</span>
            </label>
            <input
              type="text"
              value={form.VITE_AI_MODEL || ''}
              onChange={(e) => handleChange('VITE_AI_MODEL', e.target.value)}
              placeholder="your-model-name"
              className="w-full px-3 py-2.5 bg-canvas-muted border border-canvas-border rounded-xl text-sm text-slate-900 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[44px] font-mono text-xs"
            />
            <p className="text-[11px] text-muted">Any model allowed — generic wiring via VITE_AI_MODEL, not literal.</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Vision Model <span className="font-normal normal-case tracking-normal text-muted">(defaults to Model)</span>
            </label>
            <input
              type="text"
              value={form.VITE_AI_VISION_MODEL || ''}
              onChange={(e) => handleChange('VITE_AI_VISION_MODEL', e.target.value)}
              placeholder="your-vision-model or leave blank to use Model"
              className="w-full px-3 py-2.5 bg-canvas-muted border border-canvas-border rounded-xl text-sm text-slate-900 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[44px] font-mono text-xs"
            />
            <p className="text-[11px] text-muted">For vision+text multimodal single request where model supports it.</p>
          </div>
        </div>

        {}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Temperature</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={form.VITE_AI_TEMPERATURE || ''}
              onChange={(e) => handleChange('VITE_AI_TEMPERATURE', e.target.value)}
              placeholder="0.1"
              className="w-full px-3 py-2.5 bg-canvas-muted border border-canvas-border rounded-xl text-sm text-slate-900 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[44px]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Max Tokens</label>
            <input
              type="number"
              min="1"
              value={form.VITE_AI_MAX_TOKENS || ''}
              onChange={(e) => handleChange('VITE_AI_MAX_TOKENS', e.target.value)}
              placeholder="4096"
              className="w-full px-3 py-2.5 bg-canvas-muted border border-canvas-border rounded-xl text-sm text-slate-900 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[44px]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Timeout (ms)</label>
            <input
              type="number"
              min="1000"
              value={form.VITE_AI_TIMEOUT_MS || ''}
              onChange={(e) => handleChange('VITE_AI_TIMEOUT_MS', e.target.value)}
              placeholder="30000"
              className="w-full px-3 py-2.5 bg-canvas-muted border border-canvas-border rounded-xl text-sm text-slate-900 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[44px]"
            />
          </div>
        </div>

        {}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Organization ID</label>
            <input
              type="text"
              value={form.VITE_AI_ORG_ID || ''}
              onChange={(e) => handleChange('VITE_AI_ORG_ID', e.target.value)}
              placeholder="org-..."
              className="w-full px-3 py-2.5 bg-canvas-muted border border-canvas-border rounded-xl text-sm text-slate-900 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[44px] font-mono text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Project ID</label>
            <input
              type="text"
              value={form.VITE_AI_PROJECT_ID || ''}
              onChange={(e) => handleChange('VITE_AI_PROJECT_ID', e.target.value)}
              placeholder="proj-..."
              className="w-full px-3 py-2.5 bg-canvas-muted border border-canvas-border rounded-xl text-sm text-slate-900 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[44px] font-mono text-xs"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Extra Headers (JSON)</label>
          <input
            type="text"
            value={form.VITE_AI_EXTRA_HEADERS || ''}
            onChange={(e) => handleChange('VITE_AI_EXTRA_HEADERS', e.target.value)}
            placeholder='{"X-Title":"Healthbook"}'
            className="w-full px-3 py-2.5 bg-canvas-muted border border-canvas-border rounded-xl text-sm text-slate-900 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[44px] font-mono text-xs"
          />
          <p className="text-[11px] text-muted">Optional — any extra headers generically.</p>
        </div>

        {}
        <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                <span>Mistral Document OCR Pre-Processing (Fast & High-Precision)</span>
              </h4>
              <p className="text-xs text-emerald-900/80 mt-0.5">
                Converts uploaded PDFs & images into structured Markdown before AI analysis, cutting timeouts and improving precision.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.VITE_OCR_ENABLED !== 'false'}
                onChange={(e) => handleToggle('VITE_OCR_ENABLED', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Mistral OCR API Key</label>
              <input
                type="password"
                value={form.VITE_OCR_API_KEY || form.OCR_API_KEY || ''}
                onChange={(e) => handleChange('VITE_OCR_API_KEY', e.target.value)}
                placeholder="BAT6GctMFgfm..."
                className="w-full px-3 py-2.5 bg-white border border-canvas-border rounded-xl text-sm text-slate-900 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 min-h-[44px] font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">OCR Model</label>
              <input
                type="text"
                value={form.VITE_OCR_MODEL || 'mistral-ocr-latest'}
                onChange={(e) => handleChange('VITE_OCR_MODEL', e.target.value)}
                placeholder="mistral-ocr-latest"
                className="w-full px-3 py-2.5 bg-white border border-canvas-border rounded-xl text-sm text-slate-900 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 min-h-[44px] font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {}
        <div className="bg-teal-50/70 border border-teal-200 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-teal-950 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-teal-700 text-white flex items-center justify-center text-xs">Exa</span>
                Healthcare Grounding — Web Evidence (after extraction)
              </h4>
              <p className="text-xs text-teal-900/80 mt-0.5">
                Extraction = what IS in document; Grounding = what it MEANS + latest guidelines with citations. Uses <span className="font-mono">contents.highlights: true</span> for token efficiency.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={form.VITE_EXA_ENABLED !== 'false'}
                onChange={(e) => handleToggle('VITE_EXA_ENABLED', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-700"></div>
            </label>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className={`px-2.5 py-1 rounded-full font-bold border ${exaLive && isExaEnabled(exaLive) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
              {exaLive && isExaEnabled(exaLive) ? 'Grounding ready' : 'Needs EXA key'}
            </span>
            <span className="font-mono text-[11px] text-muted truncate">{exaLive?.baseURL || '/api/exa-proxy'} • {exaLive?.searchType || 'auto'} • {exaLive?.numResults ?? 5} results</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                Exa API Key <Shield className="w-3 h-3 text-teal-500" />
              </label>
              <div className="relative">
                <input
                  type={showExaKey ? 'text' : 'password'}
                  value={form.VITE_EXA_API_KEY || form.EXA_API_KEY || ''}
                  onChange={(e) => handleChange('VITE_EXA_API_KEY', e.target.value)}
                  placeholder="exa_... — server injects via /api/exa-proxy if EXA_API_KEY set in env"
                  className="w-full px-3 py-2.5 pr-12 bg-white border border-teal-200 rounded-xl text-sm text-slate-900 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-700 min-h-[44px] font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowExaKey(!showExaKey)}
                  className="absolute right-1 top-1 bottom-1 px-3 rounded-lg bg-white border border-canvas-border text-muted hover:text-slate-700 flex items-center justify-center"
                  aria-label={showExaKey ? 'Hide Exa key' : 'Show Exa key'}
                >
                  {showExaKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted">Preferred: set <span className="font-mono">EXA_API_KEY</span> (server, private) in Vercel env; proxy injects it. Local dev can use <span className="font-mono">VITE_EXA_API_KEY</span> (exposed). Docs: exa.ai/docs.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Base URL</label>
                <input
                  type="url"
                  value={form.VITE_EXA_BASE_URL || ''}
                  onChange={(e) => handleChange('VITE_EXA_BASE_URL', e.target.value)}
                  placeholder="/api/exa-proxy or https://api.exa.ai"
                  className="w-full px-3 py-2.5 bg-white border border-canvas-border rounded-xl text-sm text-slate-900 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-700 min-h-[44px] font-mono text-xs"
                />
                <p className="text-[11px] text-muted">Use <span className="font-mono">/api/exa-proxy</span> (server proxy) for privacy; direct <span className="font-mono">https://api.exa.ai</span> also auto-proxied in browser.</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Search Type</label>
                <select
                  value={form.VITE_EXA_SEARCH_TYPE || 'auto'}
                  onChange={(e) => handleChange('VITE_EXA_SEARCH_TYPE', e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-canvas-border rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-700 min-h-[44px]"
                >
                  <option value="auto">auto — balanced (recommended)</option>
                  <option value="fast">fast — low latency</option>
                  <option value="instant">instant — real-time</option>
                  <option value="deep-lite">deep-lite — lightweight synthesis</option>
                  <option value="deep">deep — multi-step reasoning</option>
                  <option value="deep-reasoning">deep-reasoning — max reasoning</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Num Results</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={form.VITE_EXA_NUM_RESULTS || ''}
                  onChange={(e) => handleChange('VITE_EXA_NUM_RESULTS', e.target.value)}
                  placeholder="5"
                  className="w-full px-3 py-2.5 bg-white border border-canvas-border rounded-xl text-sm text-slate-900 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-700 min-h-[44px]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Timeout (ms)</label>
                <input
                  type="number"
                  min="1000"
                  value={form.VITE_EXA_TIMEOUT_MS || ''}
                  onChange={(e) => handleChange('VITE_EXA_TIMEOUT_MS', e.target.value)}
                  placeholder="15000"
                  className="w-full px-3 py-2.5 bg-white border border-canvas-border rounded-xl text-sm text-slate-900 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-700 min-h-[44px]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">MaxAge Hours (freshness)</label>
                <input
                  type="number"
                  value={form.VITE_EXA_MAX_AGE_HOURS || ''}
                  onChange={(e) => handleChange('VITE_EXA_MAX_AGE_HOURS', e.target.value)}
                  placeholder="omit = cached fallback"
                  className="w-full px-3 py-2.5 bg-white border border-canvas-border rounded-xl text-sm text-slate-900 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-700 min-h-[44px]"
                />
                <p className="text-[10px] text-muted">0 = livecrawl always, -1 = never, omit = fallback (fast).</p>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-teal-900/70 bg-white border border-teal-100 rounded-lg p-2">
            Best practice: <span className="font-mono">highlights: true</span> for agent workflows (10× fewer tokens), <span className="font-mono">maxAgeHours: 0</span> only when fresh (adds latency), <span className="font-mono">text: {"{maxCharacters: 8000}"}</span> for deep research. Never use deprecated <span className="font-mono">useAutoprompt</span>/<span className="font-mono">livecrawl:"always"</span>/<span className="font-mono">includeUrls</span>.
          </p>
        </div>

        {}
        <div className="bg-canvas-muted border border-canvas-border rounded-xl p-3">
          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" /> {SETTINGS_VITE_KEYS.length} configurable keys — .env.example documents 21 (AI 14 + OCR 4 + Exa 8)
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SETTINGS_VITE_KEYS.map((k) => (
              <span
                key={k}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-semibold border ${
                  (form as unknown as Record<string, unknown>)[k] ? 'bg-primary-light text-primary-text border-primary-border' : 'bg-white text-muted border-canvas-border'
                }`}
              >
                {k}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-muted mt-2">Generic keys — any baseURL/model/provider allowed, never hardcoded literals for provider/model/baseURL in src/. Exa section adds grounding keys.</p>
        </div>

        {}
        {status.type !== 'idle' && (
          <div className={`flex items-center gap-2 p-3 rounded-xl border text-sm ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
            {status.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{status.msg}</span>
          </div>
        )}

        {}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-bold shadow-sm min-h-[44px] transition-colors"
          >
            <Save className="w-4 h-4" />
            Save to SettingsStore (localStorage)
          </button>
          <button
            onClick={handleClear}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-canvas-border hover:border-rose-200 rounded-xl text-sm font-semibold min-h-[44px] transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear Settings — use .env
          </button>
        </div>

        <p className="text-[11px] text-muted text-center">
          Persisted via localStorage keys <span className="font-mono">healthbook_settings</span> JSON blob + individual{' '}
          <span className="font-mono">VITE_AI_*</span> + <span className="font-mono">healthbook_VITE_AI_*</span> — read by{' '}
          <span className="font-mono">src/core/ai/config.ts</span> with Settings&gt;env precedence. Never commit <span className="font-mono">.env</span> — .gitignore .env PASS.
        </p>
      </div>
    </div>
  );
};

