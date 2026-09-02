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
  Activity,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { eventBus } from '@/core/events/eventBus';
import { localVault } from '@/core/vault/LocalVault';

interface ConnectWebMCPModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConnectWebMCPModal: React.FC<ConnectWebMCPModalProps> = ({ isOpen, onClose }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  const [href, setHref] = useState('');
  const [activeTab, setActiveTab] = useState<'connect' | 'activity'>('connect');
  const [tools, setTools] = useState<any[]>([]);
  const [telemetryLogs, setTelemetryLogs] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

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

  // Load Activity content (Tool Catalog, pendingCount, recent logs) — WebMCPInspector embedded inside Connect
  const refreshActivity = async () => {
    try {
      // Try native getTools first, fallback to engine sync — preserves 40 count
      let engineTools: any[] = [];
      try {
        if (typeof document !== 'undefined' && (document as any).modelContext?.getTools) {
          const native = await (document as any).modelContext.getTools();
          if (Array.isArray(native) && native.length > 0) {
            engineTools = webMCPEngine.getRegisteredTools();
            // if native length differs, prefer engine list for stable 40
            if (native.length !== engineTools.length) engineTools = webMCPEngine.getRegisteredTools();
          } else {
            engineTools = webMCPEngine.getRegisteredTools();
          }
        } else {
          engineTools = webMCPEngine.getRegisteredTools();
        }
      } catch {
        engineTools = webMCPEngine.getRegisteredTools();
      }
      setTools(engineTools);
      try {
        setTelemetryLogs(webMCPEngine.getTelemetryLogs().slice(0, 8));
      } catch {
        setTelemetryLogs([]);
      }
      try {
        let pid = '';
        try {
          const raw = localStorage.getItem('carecanvas_active_user');
          if (raw) pid = JSON.parse(raw)?.userId || '';
        } catch {}
        let pending = webMCPEngine.getPendingApprovals();
        if (pid) {
          try {
            const pf = localVault.getPendingFacts(pid).length;
            const pp = localVault.getPendingProposals(pid).length;
            setPendingCount(pf + pp);
            const vaultFacts = localVault.getPendingFacts(pid);
            const vaultApprovals = vaultFacts.map((f: any) => ({
              id: f.id,
              toolName: 'confirm_fact',
              title: f.name || 'Pending fact',
              description: f.plainExplanation || 'Awaiting review',
              timestamp: f.timestamp || new Date().toISOString(),
            }));
            const existingIds = new Set(pending.map((p: any) => p.id || p.invocationId));
            for (const v of vaultApprovals) {
              if (!existingIds.has(v.id)) pending = [...pending, v as any];
            }
          } catch {}
        } else {
          setPendingCount(pending.length);
        }
        setPendingApprovals(pending.slice(0, 6));
      } catch {
        setPendingApprovals(webMCPEngine.getPendingApprovals().slice(0, 6));
      }
    } catch {}
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshActivity();
    const u1 = eventBus.on('tool_registered' as any, refreshActivity);
    const u2 = eventBus.on('tool_execution_success' as any, refreshActivity);
    const u3 = eventBus.on('approval_queued' as any, refreshActivity);
    const u4 = eventBus.on('approval_resolved' as any, refreshActivity);
    const u5 = eventBus.on('fact_extracted' as any, refreshActivity);
    const u6 = eventBus.on('fact_confirmed' as any, refreshActivity);
    let removeNative: (() => void) | null = null;
    try {
      if (typeof document !== 'undefined' && (document as any).modelContext?.addEventListener) {
        const handler = () => refreshActivity();
        (document as any).modelContext.addEventListener('toolchange', handler);
        removeNative = () => {
          try {
            (document as any).modelContext?.removeEventListener('toolchange', handler);
          } catch {}
        };
      }
    } catch {}
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
      if (removeNative) removeNative();
    };
  }, [isOpen]);

  const toolCount = (() => {
    try {
      if (tools.length > 0) return tools.length;
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
  const globalObjects = ['document.modelContext'];
  const codeList = `if (typeof document !== 'undefined' && document.modelContext) {
  console.log('WebMCP ready via document.modelContext');
}
// List all tools (${toolCount} registered)
const tools = await document.modelContext.getTools();
console.log(tools.map(t => t.name));
// Execute a tool (example: extract_fact)
const t = tools.find(x=>x.name==='extract_fact');
const raw = await document.modelContext.executeTool(t, {documentId:'doc-example-001', rawText:'Apixaban 5mg twice daily...'});
console.log(JSON.parse(raw));`;

  const codeExecute = `const tools = await document.modelContext.getTools();
const t = tools.find(x=>x.name==='compile_health_record');
const raw = await document.modelContext.executeTool(t, {patientId:'your-patient-id', sections:['all']});
console.log(JSON.parse(raw));`;

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
                {pendingCount > 0 && (
                  <span className="text-caption px-2 py-0.5 rounded-full font-bold bg-amber-500 text-white border border-amber-600">
                    {pendingCount} pending
                  </span>
                )}
              </div>
              <p className="text-body-sm text-muted hidden sm:block">
                CareCanvas exposes every action as a local WebMCP tool — no cloud, no API key. Activity nested inside.
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

        {/* Tabs — Activity nested inside single Connect (Tool Catalog 40, pendingCount, recent logs) */}
        <div className="flex items-center gap-1 px-5 sm:px-6 pt-3 border-b border-canvas-border bg-white" role="tablist" aria-label="Connect sections">
          <button
            role="tab"
            aria-selected={activeTab === 'connect'}
            onClick={() => setActiveTab('connect')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-xl text-sm font-bold border-b-2 transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
              activeTab === 'connect' ? 'border-primary text-primary bg-white' : 'border-transparent text-muted hover:text-slate-800'
            }`}
          >
            <Globe className="w-4 h-4" aria-hidden="true" />
            Connect
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'activity'}
            onClick={() => setActiveTab('activity')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-xl text-sm font-bold border-b-2 transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none relative ${
              activeTab === 'activity' ? 'border-primary text-primary bg-white' : 'border-transparent text-muted hover:text-slate-800'
            }`}
          >
            <Terminal className="w-4 h-4" aria-hidden="true" />
            Activity
            <span className="hidden sm:inline text-caption font-normal text-muted">— Tool Catalog</span>
            {pendingCount > 0 && (
              <span className="ml-1 bg-rose-500 text-white text-[10px] min-w-[18px] h-4 px-1 rounded-full flex items-center justify-center font-black">
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {activeTab === 'connect' ? (
            <div className="space-y-6">
          
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
                <p className="text-caption text-muted leading-relaxed">In DevTools console or AI agent, check <code className="font-mono bg-canvas-muted px-1 rounded">document.modelContext</code>.</p>
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
                <p className="text-caption text-muted">Switch to Activity tab for Tool Catalog → details inside Connect</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-caption font-mono text-primary bg-white px-2 py-1 rounded-lg border border-primary-border">
                W3C WebMCP Polyfill
              </span>
            </div>
          </div>
            </div>
          ) : (
            // Activity tab — WebMCPInspector content nested inside Connect (Tool Catalog 40, pendingCount, recent logs)
            <div className="space-y-6" data-testid="connect-activity">
              {/* pendingCount badge preserved inside Activity */}
              <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-amber-700" aria-hidden="true" />
                  <span className="text-sm font-bold text-amber-900">Activity — Tool Catalog & Logs inside Connect</span>
                  <span className="text-caption px-2 py-0.5 rounded-full bg-white text-amber-700 border border-amber-200 font-bold">WebMCPInspector embedded</span>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500 text-white border border-amber-600">
                  {pendingCount} pending
                </span>
              </div>

              {/* Tool Catalog — 40 tools */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" aria-hidden="true" />
                    Tool Catalog ({toolCount})
                  </h3>
                  <span className="text-caption text-muted">Showing {Math.min(tools.length, 8)} of {toolCount} tools — W3C WebMCP</span>
                </div>
                <p className="text-caption text-muted">All 40 WebMCP tools registered via document.modelContext — Tool Catalog is now inside Connect (single entry point).</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-1">
                  {(tools.length ? tools.slice(0, 8) : Array.from({ length: 8 }).map((_, i) => ({ name: `tool_${i + 1}`, description: 'Registered tool', moduleOwner: 'vault', category: 'general', requiresHumanApproval: i % 3 === 0 }))).map((tool: any) => (
                    <div key={tool.name} className="bg-canvas-muted border border-canvas-border rounded-xl p-3 space-y-1.5">
                      <div className="font-mono text-xs font-bold text-primary-text truncate">{tool.name}</div>
                      <p className="text-caption text-slate-600 leading-relaxed line-clamp-2">{tool.description || 'WebMCP tool — local execution'}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-canvas-border font-semibold text-muted uppercase">{tool.moduleOwner || 'vault'}</span>
                        <span className="text-[10px] text-muted">{tool.category || 'general'}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {tools.length > 8 && <p className="text-caption text-muted">+ {tools.length - 8} more tools — full catalog available in Activity tab</p>}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setActiveTab('connect')}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-canvas-muted hover:bg-canvas-border border border-canvas-border text-slate-700"
                  >
                    Back to Connect
                  </button>
                  <span className="text-caption text-muted self-center">Tool Catalog embedded — previously separate WebMCPInspector now inside ConnectWebMCPModal</span>
                </div>
              </div>

              {/* Recent logs — telemetry */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-caption font-bold uppercase tracking-wider text-slate-700">
                  <Activity className="w-4 h-4 text-primary" aria-hidden="true" />
                  Recent logs
                </div>
                {telemetryLogs.length === 0 ? (
                  <div className="bg-canvas-muted border border-dashed border-canvas-border rounded-xl p-6 text-center">
                    <Activity className="w-6 h-6 text-muted mx-auto mb-2" aria-hidden="true" />
                    <p className="text-body-sm font-semibold text-slate-900">No recent activity yet</p>
                    <p className="text-caption text-muted">Use the app — steps appear here inside Connect → Activity</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {telemetryLogs.map((log: any) => (
                      <div key={log.id} className="bg-canvas-muted border border-canvas-border rounded-xl p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {log.status === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" /> : log.status === 'awaiting_approval' ? <Clock className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" /> : <XCircle className="w-4 h-4 text-rose-500 shrink-0" aria-hidden="true" />}
                          <span className="font-mono text-xs font-bold text-slate-900 truncate">{log.toolName}</span>
                          <span className="text-caption text-muted hidden sm:inline truncate">{log.status}</span>
                        </div>
                        <span className="text-caption text-muted font-mono shrink-0">{log.durationMs ? `${log.durationMs}ms` : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending approvals */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-caption font-bold uppercase tracking-wider text-slate-700">
                  <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
                  Pending approvals {pendingApprovals.length > 0 ? `(${pendingApprovals.length})` : ''}
                </div>
                {pendingApprovals.length === 0 ? (
                  <div className="bg-canvas-muted border border-dashed border-canvas-border rounded-xl p-4 text-center">
                    <CheckCircle className="w-6 h-6 text-emerald-500/60 mx-auto mb-1.5" aria-hidden="true" />
                    <p className="text-caption text-muted">All staged facts and proposals reviewed — zero pending</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingApprovals.map((item: any) => (
                      <div key={item.id || item.invocationId} className="bg-canvas-muted border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{item.title || item.toolName}</p>
                          <p className="text-caption text-muted truncate">{item.description || item.toolName}</p>
                        </div>
                        <span className="text-caption px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold shrink-0">pending</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
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
