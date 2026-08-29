import React, { useEffect, useState } from 'react';
import {
  Plug,
  Copy,
  Check,
  Terminal,
  Globe,
  Code2,
  ExternalLink,
  ShieldCheck,
  Info,
  Layers,
  Play,
} from 'lucide-react';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { eventBus } from '@/core/events/eventBus';

interface ConnectWebMCPModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConnectWebMCPModal: React.FC<ConnectWebMCPModalProps> = ({ isOpen, onClose }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  const [href, setHref] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
      setHref(window.location.href);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const toolCount = (() => {
    try {
      return webMCPEngine.getRegisteredTools().length;
    } catch {
      return 40;
    }
  })();

  const copy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
      eventBus.dispatchToast({ type: 'success', title: 'Copied', message: `${field} copied to clipboard` });
    } catch {
      eventBus.dispatchToast({ type: 'error', title: 'Copy failed', message: 'Please copy manually' });
    }
  };

  if (!isOpen) return null;

  const pageUrl = href || origin || 'https://carecanvas.local';
  const mcpEndpoint = pageUrl;
  const globalObjects = ['window.modelContext', 'navigator.modelContext', 'document.modelContext', 'window.__CareCanvas_WebMCP__'];
  const codeList = `// 1. Check availability
if (window.modelContext || navigator.modelContext) {
  console.log('WebMCP ready');
}

// 2. List all tools (${toolCount} registered)
const tools = await (window.modelContext || window.__CareCanvas_WebMCP__).getRegisteredTools();
console.log(tools.map(t => t.name));

// 3. Execute a tool (example: extract_fact)
const result = await (window.modelContext || window.__CareCanvas_WebMCP__).executeTool(
  'extract_fact',
  { documentId: 'doc-example-001', rawText: 'Apixaban 5mg twice daily...' }
);`;

  const codeExecute = `await window.modelContext.executeTool('compile_health_record', {
  patientId: 'your-patient-id',
  sections: ['all']
});`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Connect to WebMCP"
    >
      <div
        className="bg-white border border-canvas-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-5 border-b border-canvas-border bg-canvas-muted">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-primary-light border border-primary-border rounded-xl text-primary shrink-0">
              <Plug className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-heading-md sm:text-lg font-bold text-slate-900">Connect to WebMCP</h2>
                <span className="text-caption px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {toolCount} tools ready
                </span>
              </div>
              <p className="text-body-sm text-muted hidden sm:block">
                CareCanvas exposes every action as a local WebMCP tool — no cloud, no API key.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white border border-transparent hover:border-canvas-border text-muted hover:text-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
            aria-label="Close connect modal"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Connection Link */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-caption font-bold uppercase tracking-wider text-slate-700">
              <Globe className="w-4 h-4 text-primary" />
              Connection Link
            </div>
            <div className="bg-canvas-muted border border-canvas-border rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-caption text-muted font-semibold uppercase tracking-wider">Current Page (WebMCP Host)</p>
                <p className="text-body-sm font-mono font-semibold text-slate-900 truncate">{pageUrl}</p>
                <p className="text-caption text-muted">Open this URL in any browser — WebMCP polyfill auto-injects on load.</p>
              </div>
              <button
                onClick={() => copy(pageUrl, 'Link')}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-colors min-h-[40px]"
              >
                {copiedField === 'Link' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedField === 'Link' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => copy(pageUrl, 'URL')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-canvas-muted hover:bg-canvas-border border border-canvas-border text-xs font-semibold text-slate-700"
              >
                <Copy className="w-3.5 h-3.5" /> Copy URL
              </button>
              <a
                href={pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-canvas-muted border border-canvas-border text-xs font-semibold text-primary"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open in new tab
              </a>
            </div>
          </div>

          {/* How to connect steps */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-caption font-bold uppercase tracking-wider text-slate-700">
              <Info className="w-4 h-4 text-primary" />
              How to connect
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-canvas-card border border-canvas-border rounded-xl p-3 space-y-2 shadow-sm">
                <div className="w-7 h-7 rounded-lg bg-primary-light border border-primary-border text-primary flex items-center justify-center font-bold text-xs">1</div>
                <p className="text-body-sm font-bold text-slate-900">Open CareCanvas</p>
                <p className="text-caption text-muted leading-relaxed">Navigate to the link above. No login beyond your local account.</p>
              </div>
              <div className="bg-canvas-card border border-canvas-border rounded-xl p-3 space-y-2 shadow-sm">
                <div className="w-7 h-7 rounded-lg bg-primary-light border border-primary-border text-primary flex items-center justify-center font-bold text-xs">2</div>
                <p className="text-body-sm font-bold text-slate-900">Access modelContext</p>
                <p className="text-caption text-muted leading-relaxed">In DevTools console or AI agent, check <code className="font-mono bg-canvas-muted px-1 rounded">window.modelContext</code>.</p>
              </div>
              <div className="bg-canvas-card border border-canvas-border rounded-xl p-3 space-y-2 shadow-sm">
                <div className="w-7 h-7 rounded-lg bg-primary-light border border-primary-border text-primary flex items-center justify-center font-bold text-xs">3</div>
                <p className="text-body-sm font-bold text-slate-900">Call a tool</p>
                <p className="text-caption text-muted leading-relaxed">Use <code className="font-mono bg-canvas-muted px-1 rounded">executeTool</code> — see examples below.</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-body-sm">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <p className="text-amber-900 leading-relaxed">
                <strong>Private & Secure:</strong> All tools run locally on this device via <code className="font-mono bg-white px-1 rounded border border-amber-200">LocalVault</code>. No data leaves the browser unless you export.
              </p>
            </div>
          </div>

          {/* Global Objects */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-caption font-bold uppercase tracking-wider text-slate-700">
              <Terminal className="w-4 h-4 text-primary" />
              Available globals
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {globalObjects.map((g) => (
                <div
                  key={g}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-canvas-muted border border-canvas-border font-mono text-xs"
                >
                  <span className="text-slate-800 font-semibold truncate">{g}</span>
                  <button
                    onClick={() => copy(g, g)}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-canvas-border text-muted hover:text-slate-800"
                    aria-label={`Copy ${g}`}
                  >
                    {copiedField === g ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Code examples */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-caption font-bold uppercase tracking-wider text-slate-700">
                <Code2 className="w-4 h-4 text-primary" />
                Quick start — copy & run
              </div>
              <button
                onClick={() => copy(codeList, 'Code')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-canvas-muted hover:bg-canvas-border border border-canvas-border text-xs font-semibold text-slate-700"
              >
                {copiedField === 'Code' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                Copy
              </button>
            </div>
            <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto text-xs font-mono leading-relaxed border border-slate-800">
              {codeList}
            </pre>
            <div className="flex items-center gap-2 text-caption font-bold uppercase tracking-wider text-slate-700 pt-1">
              <Play className="w-3.5 h-3.5 text-primary" />
              Execute any tool
            </div>
            <div className="relative">
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto text-xs font-mono leading-relaxed border border-slate-800">
                {codeExecute}
              </pre>
              <button
                onClick={() => copy(codeExecute, 'Execute')}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/10"
              >
                {copiedField === 'Execute' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Tool catalog teaser */}
          <div className="bg-primary-light border border-primary-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <p className="text-body-sm font-bold text-slate-900">{toolCount} WebMCP tools available</p>
                <p className="text-caption text-muted">Explore via Activity → Tool Catalog or Playground</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-caption font-mono text-primary bg-white px-2 py-1 rounded-lg border border-primary-border">
                W3C WebMCP Polyfill
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-canvas-border bg-canvas-muted flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <p className="text-caption text-muted">Need help? Open <strong className="text-slate-800">Activity → Manual Trigger Playground</strong> to try tools without code.</p>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-sm min-h-[44px] flex items-center justify-center"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
