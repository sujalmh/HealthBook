import React, { useEffect, useState } from 'react';
import { Shield, Settings, Search } from 'lucide-react';
import { SettingsForm } from './SettingsForm';
import { getAIConfig, isAIEnabled } from '@/core/ai/config';
import { getExaConfig, isExaEnabled } from '@/core/search/exaConfig';

export const SettingsView: React.FC = () => {
  const [config, setConfig] = useState<ReturnType<typeof getAIConfig> | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [exaConfig, setExaConfig] = useState<ReturnType<typeof getExaConfig> | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    try {
      const c = getAIConfig();
      setConfig(c);
      const exa = getExaConfig();
      setExaConfig(exa);
    } catch {

    }
  }, [refreshTick]);

  const handleSaved = () => {
    setRefreshTick((t) => t + 1);
  };

  const enabled = config ? isAIEnabled(config) : false;

  return (
    <div className="space-y-3">
      {}
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
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${enabled ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
            <Shield className="w-3.5 h-3.5" />
            {enabled ? `AI on (${config?.provider || 'default'})` : 'AI off'}
          </span>
        </div>
      </div>

      {}
      <div className="bg-white border border-canvas-border rounded-xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary-light border border-primary-border flex items-center justify-center shrink-0">
            <Search className="w-5 h-5 text-primary-text" />
          </div>
          <div className="min-w-0">
            <h3 className="text-heading-md text-slate-900">Web evidence</h3>
            <p className="text-body-sm text-muted">Answers in Ask cite trusted medical sources.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${exaConfig && isExaEnabled(exaConfig) ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
            {exaConfig && isExaEnabled(exaConfig) ? 'Ready' : 'Not configured'}
          </span>
        </div>
      </div>

      {}
      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        aria-expanded={showAdvanced}
        className="w-full px-4 py-3 rounded-xl bg-white border border-canvas-border text-sm font-bold text-slate-700 hover:bg-canvas-muted min-h-[44px]"
      >
        {showAdvanced ? 'Hide advanced setup' : 'Advanced provider setup'}
      </button>
      {showAdvanced && <SettingsForm onSaved={handleSaved} />}
    </div>
  );
};

