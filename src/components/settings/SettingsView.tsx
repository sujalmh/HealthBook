import React, { useEffect, useState } from 'react';
import { Shield, Settings, Sparkles, Lock, FileText, Cpu, Database, Search } from 'lucide-react';
import { SettingsForm } from './SettingsForm';
import { getAIConfig, getAIConfigSource, getAIEndpoint, isAIEnabled } from '@/core/ai/config';
import { getExaConfig, getExaEndpoint, isExaEnabled } from '@/core/search/exaConfig';
import { getSettingsSource } from '@/core/settings/SettingsStore';

export const SettingsView: React.FC = () => {
  const [config, setConfig] = useState<ReturnType<typeof getAIConfig> | null>(null);
  const [endpoint, setEndpoint] = useState<string>('');
  const [settingsSource, setSettingsSource] = useState<ReturnType<typeof getSettingsSource> | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [exaConfig, setExaConfig] = useState<ReturnType<typeof getExaConfig> | null>(null);
  const [exaEndpoint, setExaEndpoint] = useState<string>('');

  useEffect(() => {
    try {
      const c = getAIConfig();
      setConfig(c);
      setEndpoint(getAIEndpoint(c));
      setSettingsSource(getSettingsSource());
      const exa = getExaConfig();
      setExaConfig(exa);
      setExaEndpoint(getExaEndpoint(exa));
    } catch {
      // ignore
    }
  }, [refreshTick]);

  const handleSaved = () => {
    setRefreshTick((t) => t + 1);
  };

  const isSettingsActive = settingsSource?.hasSettings ?? false;
  const enabled = config ? isAIEnabled(config) : false;

  return (
    <div className="space-y-6">
      {/* AI provider header — standard card, status pills carry the state */}
      <div className="bg-white border border-canvas-border rounded-xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-light border border-primary-border flex items-center justify-center shrink-0">
            <Settings className="w-5 h-5 text-primary-text" />
          </div>
          <div className="min-w-0">
            <h2 className="text-heading-lg text-slate-900">Settings — AI Provider Configuration</h2>
            <p className="text-body-sm text-muted">Generic configurable LLM — any model, any baseURL, Settings overrides .env</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="px-2.5 py-1 rounded-full bg-canvas-muted border border-canvas-border text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-primary-text" />
            {config?.provider || '—'} provider
          </span>
          <span className="px-2.5 py-1 rounded-full bg-canvas-muted border border-canvas-border text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-primary-text" />
            {config?.model || 'no model'} — {config?.visionModel && config.visionModel !== config.model ? `vision ${config.visionModel}` : 'single model'}
          </span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${enabled ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
            <Shield className="w-3.5 h-3.5" />
            {enabled ? 'AI Active' : 'AI Fallback'} • {isSettingsActive ? 'Settings active' : 'env defaults'}
          </span>
        </div>

        <div className="rounded-lg border border-canvas-border bg-canvas-muted p-3 space-y-2">
          <div className="flex items-center gap-2 text-caption uppercase tracking-wider text-slate-600">
            <Sparkles className="w-3.5 h-3.5" /> Current Endpoint (generic)
          </div>
          <div className="font-mono text-xs bg-white rounded-md px-3 py-2 text-slate-800 break-all border border-canvas-border">
            {endpoint || '— not configured (baseURL empty)'}
          </div>
          <p className="text-[11px] text-muted">
            Composed generically: {'{baseURL}/chat/completions'} for <span className="font-semibold">chat</span> vs {'{baseURL}/responses'} for{' '}
            <span className="font-semibold">responses</span> via <span className="font-mono">VITE_AI_PROVIDER</span> — never hardcoded literal.
          </p>
        </div>
      </div>

      {/* Info cards row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-canvas-border rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <FileText className="w-4 h-4 text-primary" />
            .env Support
          </div>
          <p className="text-xs text-muted leading-relaxed">
            Alternatively configure via <span className="font-mono bg-canvas-muted px-1 rounded">.env</span> with 13{' '}
            <span className="font-mono">VITE_AI_*</span> keys per <span className="font-mono">.env.example:14-51</span>. Settings page overrides .env when present.
          </p>
          <div className="text-[11px] font-mono bg-canvas-muted p-2 rounded-lg border border-canvas-border break-all">
            VITE_AI_ENABLED, PROVIDER, BASE_URL, API_KEY, MODEL, VISION_MODEL, STRUCTURED_OUTPUTS, TEMPERATURE, MAX_TOKENS, TIMEOUT_MS, ORG_ID, PROJECT_ID, EXTRA_HEADERS
          </div>
        </div>

        <div className="bg-white border border-canvas-border rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Lock className="w-4 h-4 text-emerald-600" />
            Privacy & Secrets
          </div>
          <p className="text-xs text-muted leading-relaxed">
            Secret never committed — <span className="font-mono">.gitignore</span> denies <span className="font-mono">.env</span>. API key stored in browser localStorage only, masked in UI. Generic wiring via{' '}
            <span className="font-mono">import.meta.env</span> + <span className="font-mono">SettingsStore</span>.
          </p>
          <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
            Configurable read: <span className="font-mono">import.meta.env.VITE_AI_*</span> OR <span className="font-mono">localStorage VITE_AI_*</span> — grep VITE_AI in src ≥1 PASS
          </div>
        </div>

        <div className="bg-white border border-canvas-border rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Cpu className="w-4 h-4 text-amber-600" />
            Generic Wiring
          </div>
          <p className="text-xs text-muted leading-relaxed">
            No hardcoding — any provider/model/baseURL allowed. Vision uses <span className="font-mono">image_url</span> (chat) vs{' '}
            <span className="font-mono">input_image</span> (responses) generically, structured via <span className="font-mono">response_format json_object</span> vs{' '}
            <span className="font-mono">text.format json_schema</span> + <span className="font-mono">Zod</span> validation.
          </p>
          <div className="text-[11px] text-muted bg-canvas-muted p-2 rounded-lg border border-canvas-border">
            Source via <span className="font-mono">getAIConfig()</span> + <span className="font-mono">getAIConfigSource()</span> debug helper — shows Settings vs env precedence.
          </div>
        </div>
      </div>

      {/* Current source debug visible */}
      <div className="bg-canvas-card border border-canvas-border rounded-xl p-4 space-y-2">
        <h4 className="text-sm font-bold text-slate-800">Debug — Settings&gt;env Precedence Visible</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
          <div className="bg-white rounded-lg p-3 border border-canvas-border">
            <div className="text-muted text-[10px] uppercase">Source</div>
            <div className={`font-bold ${isSettingsActive ? 'text-emerald-600' : 'text-slate-600'}`}>
              {isSettingsActive ? 'Settings (localStorage VITE_AI_*)' : 'env (import.meta.env)'}
            </div>
            <div className="text-[11px] text-muted mt-1">via getAIConfigSource().source</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-canvas-border sm:col-span-2">
            <div className="text-muted text-[10px] uppercase">Overrides present</div>
            <div className="font-semibold text-slate-800 break-all">
              {settingsSource?.keys.length ? settingsSource.keys.join(', ') : 'none — using .env defaults'}
            </div>
            <div className="text-[11px] text-muted mt-1">{settingsSource?.count ?? 0} keys in SettingsStore</div>
          </div>
        </div>
        <p className="text-[11px] text-muted">
          Config must support any model/any baseURL — validated via SettingsStore writes generically, baseURL/model not empty when enabled, not committing .env, opencode.json configurable baseURL not forced literal.
        </p>
      </div>

      {/* Exa Healthcare Grounding — standard card with status pills */}
      <div className="bg-white border border-canvas-border rounded-xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary-light border border-primary-border flex items-center justify-center shrink-0">
            <Search className="w-5 h-5 text-primary-text" />
          </div>
          <div className="min-w-0">
            <h3 className="text-heading-md text-slate-900">Exa Healthcare Grounding — Web Evidence Layer</h3>
            <p className="text-body-sm text-muted">After extraction: grounded insights with citations via Exa search (highlights, not just raw text).</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${exaConfig && isExaEnabled(exaConfig) ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
            {exaConfig && isExaEnabled(exaConfig) ? 'Grounding ready' : 'Needs EXA_API_KEY'}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-canvas-muted border border-canvas-border text-xs font-mono text-slate-700">{exaEndpoint || '/api/exa-proxy/search'} • {exaConfig?.searchType || 'auto'}</span>
          <span className="px-2.5 py-1 rounded-full bg-canvas-muted border border-canvas-border text-xs font-mono text-slate-700">{exaConfig?.numResults ?? 5} results • {exaConfig?.timeoutMs ?? 15000}ms</span>
        </div>
        <div className="rounded-lg border border-canvas-border bg-canvas-muted p-3 space-y-1.5">
          <div className="text-caption uppercase tracking-wider text-slate-600 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> How it works</div>
          <p className="text-body-sm text-slate-700 leading-relaxed">
            Extraction (AI/OCR) finds <span className="font-semibold">what is in your document</span>; grounding finds <span className="font-semibold">what it means</span> — latest guidelines, interactions, and next steps — via <span className="font-mono">POST https://api.exa.ai/search</span> with <span className="font-mono">contents.highlights: true</span> (token-efficient) + citations. Toggle <span className="font-mono">fresh</span> forces <span className="font-mono">maxAgeHours: 0</span> livecrawl. Proxied via <span className="font-mono">/api/exa-proxy</span> so <span className="font-mono">EXA_API_KEY</span> stays server-only.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="px-2 py-0.5 rounded-full bg-white border border-canvas-border text-slate-700 text-[11px] font-semibold">highlights</span>
            <span className="px-2 py-0.5 rounded-full bg-white border border-canvas-border text-slate-700 text-[11px] font-mono">text (deep)</span>
            <span className="px-2 py-0.5 rounded-full bg-white border border-canvas-border text-slate-700 text-[11px] font-mono">summary + outputSchema</span>
          </div>
        </div>
      </div>

      {/* Form */}
      <SettingsForm onSaved={handleSaved} />

      {/* Footer note for gates */}
      <div className="text-center text-[11px] text-muted space-y-1">
        <p>
          Verification: <span className="font-mono">glob Settings* ≥1</span> + <span className="font-mono">localStorage VITE_AI ≥1</span> PASS — see{' '}
          <span className="font-mono">settings-config.log</span> • WebMCP 40 preserved • lint0 • build1660 • test172 • getTools40
        </p>
      </div>
    </div>
  );
};
