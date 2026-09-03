import React, { useEffect, useState } from 'react';
import { Shield, Settings, Cpu, Database, Search } from 'lucide-react';
import { SettingsForm } from './SettingsForm';
import { getAIConfig, getAIEndpoint, isAIEnabled } from '@/core/ai/config';
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
            <h2 className="text-heading-lg text-slate-900">Settings</h2>
            <p className="text-body-sm text-muted">Your AI provider for explanations and document reading.</p>
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
          <div className="font-mono text-xs bg-white rounded-md px-3 py-2 text-slate-800 break-all border border-canvas-border">
            {endpoint || '— not configured'}
          </div>
        </div>
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
          <p className="text-body-sm text-slate-700 leading-relaxed">
            Your questions in Ask are answered with citations from trusted medical sources.
          </p>
        </div>
      </div>

      {/* Form */}
      <SettingsForm onSaved={handleSaved} />
    </div>
  );
};
