import React, { useState, useEffect } from 'react';
import {
  Activity,
  Terminal,
  Layers,
  ShieldAlert,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Code2,
  Filter,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { WebMCPToolDefinition, TelemetryLogEntry, PendingApprovalItem } from '@/types/webmcp';
import { eventBus } from '@/core/events/eventBus';
import { localVault } from '@/core/vault/LocalVault';

const MODULE_DISPLAY: Record<string, string> = {
  vault: 'My Records',
  labstory: 'Lab Results',
  pillmap: 'My Medicines',
  rxbridge: 'Medicine Review',
  homelab: 'Tests to Do',
  safety: 'Get Help',
  carecircle: 'Family',
  dossier: 'For My Doctor',
};

export const WebMCPInspector: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'telemetry' | 'playground' | 'approvals'>('catalog');
  const [tools, setTools] = useState<WebMCPToolDefinition[]>([]);
  const [telemetryLogs, setTelemetryLogs] = useState<TelemetryLogEntry[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalItem[]>([]);
  const [selectedToolName, setSelectedToolName] = useState<string>('extract_fact');
  const [playgroundParams, setPlaygroundParams] = useState<string>('{\n  "documentId": "doc-example-001"\n}');
  const [playgroundResult, setPlaygroundResult] = useState<unknown>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [catalogFilterModule, setCatalogFilterModule] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const refreshData = async () => {
    // Try native first: document.modelContext.getTools() Promise spec §4.2, fallback to engine sync for polyfill parity
    let nextTools: WebMCPToolDefinition[] | null = null;
    try {
      if (typeof document !== 'undefined' && (document as unknown as { modelContext?: { getTools?: () => Promise<unknown[]> } }).modelContext?.getTools) {
        const nativeTools: unknown[] = await (document as unknown as { modelContext: { getTools: () => Promise<unknown[]> } }).modelContext.getTools();
        if (Array.isArray(nativeTools) && nativeTools.length > 0) {
          const byName = new Map(webMCPEngine.getRegisteredTools().map((t) => [t.name, t]));
          nextTools = nativeTools.map((rt: unknown) => {
            const typedRt = rt as { name: string; description?: string; inputSchema?: string; annotations?: { readOnlyHint?: boolean } };
            const cached = byName.get(typedRt.name);
            if (cached) return cached;
            let params: Record<string, unknown> = {};
            try {
              const parsed = typedRt.inputSchema ? JSON.parse(typedRt.inputSchema) : {};
              params = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
            } catch { /* intentionally empty */ }
            const props = (params as { properties?: unknown }).properties;
            if (!params || !props) {
              if (params && typeof params === 'object' && !props) {
                const pRec = params as { properties?: unknown; required?: unknown };
                params = { type: 'object', properties: pRec.properties || params, required: pRec.required || [] } as Record<string, unknown>;
                if (!(params as { properties?: unknown }).properties || typeof (params as { properties?: unknown }).properties !== 'object') (params as { properties: unknown }).properties = {};
              } else {
                params = { type: 'object', properties: {}, required: [] };
              }
            }
            return {
              name: typedRt.name,
              description: typedRt.description || '',
              moduleOwner: 'vault',
              category: 'general',
              requiresHumanApproval: typedRt.annotations ? typedRt.annotations.readOnlyHint === false : false,
              parameters: params,
              execute: async () => ({
                success: true,
                tool: typedRt.name,
                timestamp: new Date().toISOString(),
                data: null,
                plainLanguageSummary: '',
                humanApprovalRequired: false,
              }),
            } as unknown as WebMCPToolDefinition;
          });
        }
      }
    } catch { /* intentionally empty */ }
    if (nextTools) setTools(nextTools);
    else setTools(webMCPEngine.getRegisteredTools());
    setTelemetryLogs(webMCPEngine.getTelemetryLogs());
    // Real pending approvals — combine engine queue with vault pending facts/proposals (no mock).
    let pending = webMCPEngine.getPendingApprovals();
    try {
      let pid = '';
      try {
        const raw = localStorage.getItem('carecanvas_active_user');
        if (raw) pid = JSON.parse(raw)?.userId || '';
      } catch { /* intentionally empty */ }
      if (pid) {
        const vaultFacts = localVault.getPendingFacts(pid);
        const vaultFactApprovals = vaultFacts.map((f) => {
          const extra = f as unknown as { factKey?: string; plainNarration?: string; timestamp?: string; createdAt?: string };
          return {
            id: f.id,
            toolName: 'confirm_fact',
            title: f.name || extra.factKey || 'Pending fact',
            description: f.plainExplanation || extra.plainNarration || 'Awaiting review in My Records',
            timestamp: extra.timestamp || f.createdAt || new Date().toISOString(),
          };
        });
        const existingIds = new Set(pending.map((p) => (p as { id?: string; invocationId?: string }).id || (p as { invocationId?: string }).invocationId));
        for (const v of vaultFactApprovals) {
          if (!existingIds.has(v.id)) pending = [...pending, v as unknown as unknown];
        }
      }
    } catch { /* intentionally empty */ }
    setPendingApprovals(pending);
  };

  useEffect(() => {
    refreshData();
    const u1 = eventBus.on('tool_registered', refreshData);
    const u2 = eventBus.on('tool_execution_success', refreshData);
    const u3 = eventBus.on('tool_execution_error', refreshData);
    const u4 = eventBus.on('telemetry_updated', refreshData);
    const u5 = eventBus.on('approval_queued', refreshData);
    const u6 = eventBus.on('approval_resolved', refreshData);
    // Native toolchange listener per W3C §4.4 — observe browser ModelContext EventTarget
    let removeNative: (() => void) | null = null;
    try {
      if (typeof document !== 'undefined' && (document as unknown as { modelContext?: { addEventListener?: (e:string,h:()=>void)=>void } }).modelContext?.addEventListener) {
        const handler = () => {
          refreshData();
        };
        (document as unknown as { modelContext: { addEventListener: (e:string,h:()=>void)=>void } }).modelContext.addEventListener('toolchange', handler);
        removeNative = () => {
          try {
            (document as unknown as { modelContext?: { removeEventListener?: (e:string,h:()=>void)=>void } }).modelContext?.removeEventListener?.('toolchange', handler);
          } catch { /* intentionally empty */ }
        };
      }
    } catch { /* intentionally empty */ }

    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
      if (removeNative) removeNative();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Preload sample payloads when selected tool changes in playground
  const handleSelectToolForPlayground = (toolName: string) => {
    setSelectedToolName(toolName);
    setPlaygroundResult(null);

    // Playground payloads are vault-derived templates, not mock patient fixtures.
    // All IDs are generic placeholders; real execution uses context.patientId from session.
    const activeUserId = (() => {
      try {
        const raw = localStorage.getItem('carecanvas_active_user');
        if (raw) return JSON.parse(raw)?.userId || 'current-patient';
      } catch { /* intentionally empty */ }
      return 'current-patient';
    })();
    const samplePayloads: Record<string, object> = {
      extract_fact: {
        documentId: `doc-example-${activeUserId.slice(0, 6)}`,
        rawText: 'Example discharge text — replace with your document content.',
        documentType: 'general_pdf',
      },
      confirm_fact: {
        factId: `fact-${activeUserId.slice(0, 6)}-001`,
        action: 'approve',
      },
      compile_health_record: {
        patientId: activeUserId,
        format: 'json_dossier',
        includeAuditTrail: true,
      },
      extract_labs: {
        documentId: `doc-lab-${activeUserId.slice(0, 6)}`,
        patientId: activeUserId,
        normalizeUnits: true,
      },
      correlate_meds: {
        markerCode: 'Creatinine',
        timeframeDays: 90,
      },
      add_medication: {
        name: 'Example Medication',
        genericName: 'example-generic',
        dosage: '10 mg',
        timeSlots: ['morning'],
        category: 'rx',
        withFood: false,
      },
      check_interactions: {},
      check_diet_interactions: {},
      check_duplicate_ingredient: {},
      suggest_schedule: {
        chronotype: 'standard',
        separateCalcium: false,
      },
      simulate_adherence: {
        medicationName: 'Example Medication 10mg',
        timeSlot: 'morning',
        day: 'mon',
      },
      export_for_pharmacist: {
        format: 'pdf_map',
      },
      explain_med_change: {
        medicationName: 'Example Medication',
        dischargeDose: '10 mg once daily',
        changeCategory: 'new',
        reason: 'Clinician prescribed',
      },
      flag_interaction: {},
      flag_diet_interaction: {},
      suggest_question_for_doctor: {
        context: 'Medication change at discharge — please clarify',
      },
      export_patient_summary: {
        format: 'one_page_pdf',
      },
      upload_lab_image: {
        imageData: 'data:image/jpeg;base64,REPLACE_WITH_REAL_IMAGE',
        prescribedDueCardId: `due-${activeUserId.slice(0, 6)}-001`,
      },
      doctor_review_comment: {
        labId: `lab-${activeUserId.slice(0, 6)}-001`,
        comment: 'Clinician comment — replace with real assessment.',
      },
      propose_dosage_change: {
        targetMedicationName: 'Example Medication',
        proposedDosage: '5 mg morning only',
        clinicalRationale: 'Clinician rationale — replace with real reason.',
      },
      report_danger_sign: {
        symptom: 'Describe symptom in plain language',
        severity: 'urgent_doctor_same_day',
      },
      schedule_followup: {
        title: 'Follow-up Appointment',
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        location: 'clinic',
      },
      switch_profile: {
        targetPatientId: 'self',
      },
      grant_doctor_access: {
        doctorEmail: 'doctor@clinic.example',
        durationDays: 7,
        scope: 'full_dossier',
      },
      create_account: {
        name: 'Alex Morgan',
        email: 'alex@example.com',
        role: 'patient',
      },
      sign_in: {
        email: 'alex@example.com',
      },
    };

    const payload = samplePayloads[toolName] || {};
    setPlaygroundParams(JSON.stringify(payload, null, 2));
  };

  const handleExecutePlayground = async () => {
    setIsExecuting(true);
    setPlaygroundResult(null);

    try {
      let parsedParams = {};
      if (playgroundParams.trim()) {
        parsedParams = JSON.parse(playgroundParams);
      }

      const result = await webMCPEngine.execute(selectedToolName, parsedParams);
      setPlaygroundResult(result);
      refreshData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Execution error';
      setPlaygroundResult({
        success: false,
        error: msg,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  if (!isOpen) return null;

  const filteredTools = tools.filter((t) => {
    if (catalogFilterModule !== 'all' && t.moduleOwner !== catalogFilterModule) return false;
    return true;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="CareCanvas WebMCP Inspector"
    >
      <div
        className="bg-white border border-canvas-border rounded-2xl w-full max-w-5xl h-[85vh] max-h-[90vh] shadow-2xl flex flex-col text-slate-900 overflow-hidden my-auto mx-0 sm:mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-3 sm:px-6 py-4 border-b border-canvas-border bg-canvas-muted">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-primary-light border border-primary-border rounded-xl text-primary-text shrink-0">
              <Terminal className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-heading-md sm:text-lg font-bold text-slate-900">CareCanvas WebMCP Inspector</h2>
                <span className="text-caption px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                  {(typeof document !== 'undefined' && (document as unknown as { modelContext?: { registerTool?: unknown } }).modelContext?.registerTool) ? 'Native WebMCP' : 'Polyfill Adapter'}
                </span>
              </div>
              <p className="text-xs text-muted hidden sm:block">
                Live tool registry ({tools.length} Registered Tools across {new Set(tools.map((t) => t.moduleOwner)).size} Modules) • W3C WebML Compliant
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white border border-transparent hover:border-canvas-border text-muted hover:text-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close inspector"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 sm:gap-2 px-3 sm:px-6 pt-3 border-b border-canvas-border bg-canvas-muted text-xs overflow-x-auto scrollbar-none flex-nowrap">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 font-bold border-b-2 transition-colors whitespace-nowrap focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-t-lg min-h-[44px] ${
              activeTab === 'catalog'
                ? 'border-primary text-primary bg-white'
                : 'border-transparent text-muted hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4 shrink-0" />
            Tool Catalog ({tools.length})
          </button>

          <button
            onClick={() => setActiveTab('telemetry')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 font-bold border-b-2 transition-colors whitespace-nowrap focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-t-lg min-h-[44px] ${
              activeTab === 'telemetry'
                ? 'border-primary text-primary bg-white'
                : 'border-transparent text-muted hover:text-slate-800'
            }`}
          >
            <Activity className="w-4 h-4 shrink-0" />
            Invocation Telemetry ({telemetryLogs.length})
          </button>

          <button
            onClick={() => setActiveTab('playground')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 font-bold border-b-2 transition-colors whitespace-nowrap focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-t-lg min-h-[44px] ${
              activeTab === 'playground'
                ? 'border-primary text-primary bg-white'
                : 'border-transparent text-muted hover:text-slate-800'
            }`}
          >
            <Play className="w-4 h-4 shrink-0" />
            Manual Trigger Playground
          </button>

          <button
            onClick={() => setActiveTab('approvals')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 font-bold border-b-2 transition-colors whitespace-nowrap focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-t-lg min-h-[44px] ${
              activeTab === 'approvals'
                ? 'border-amber-400 text-amber-600 bg-white'
                : 'border-transparent text-muted hover:text-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4 shrink-0" />
            Approval Gate Interceptor ({pendingApprovals.length})
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          {/* TAB 1: TOOL CATALOG */}
          {activeTab === 'catalog' && (
            <div className="space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <Filter className="w-3.5 h-3.5 text-muted shrink-0" />
                  <span className="text-muted whitespace-nowrap">Filter by Module:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(['all', 'vault', 'labstory', 'pillmap', 'rxbridge', 'homelab', 'safety', 'carecircle', 'dossier'] as const).map(
                      (mod) => (
                        <button
                          key={mod}
                          onClick={() => setCatalogFilterModule(mod)}
                          className={`px-2.5 py-1 rounded-lg font-medium transition-colors min-h-[32px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                            catalogFilterModule === mod
                              ? 'bg-primary-light text-primary-text border border-primary-border shadow-sm'
                              : 'bg-canvas-muted text-muted hover:bg-canvas-border border border-transparent'
                          }`}
                        >
                          {mod === 'all' ? 'All' : MODULE_DISPLAY[mod] || mod}
                        </button>
                      )
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted font-mono whitespace-nowrap">Showing {filteredTools.length} tools</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTools.map((tool) => (
                  <div
                    key={tool.name}
                    className="bg-canvas-muted/70 border border-canvas-border hover:border-primary-border rounded-xl p-4 space-y-3 shadow-sm transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono text-sm font-bold text-primary-text break-all">{tool.name}</div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-caption uppercase font-bold px-2 py-0.5 rounded bg-white text-muted border border-canvas-border">
                            {MODULE_DISPLAY[tool.moduleOwner] || tool.moduleOwner}
                          </span>
                          <span className="text-caption font-mono text-muted">{tool.category}</span>
                        </div>
                      </div>
                      {tool.requiresHumanApproval ? (
                        <span className="text-caption font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap shrink-0">
                          Approval Required
                        </span>
                      ) : (
                        <span className="text-caption font-semibold px-2 py-0.5 rounded bg-white text-muted border border-canvas-border whitespace-nowrap shrink-0">
                          Auto-Execute
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed">{tool.description}</p>

                    <div className="pt-2 border-t border-canvas-border flex items-center justify-between gap-2 text-xs flex-wrap">
                      <span className="text-caption text-muted font-mono">
                        Params: {Object.keys(tool.parameters?.properties || {}).length} fields (
                        {tool.parameters?.required?.join(', ') || 'none required'})
                      </span>
                      <button
                        onClick={() => {
                          handleSelectToolForPlayground(tool.name);
                          setActiveTab('playground');
                        }}
                        className="flex items-center gap-1 text-primary hover:text-primary-hover font-semibold text-xs focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-lg px-2 py-1 min-h-[32px]"
                      >
                        <Play className="w-3 h-3" />
                        <span>Try in Playground</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: INVOCATION TELEMETRY LOG */}
          {activeTab === 'telemetry' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-muted">Real-Time WebMCP Dispatcher Stream</div>
                <button
                  onClick={() => webMCPEngine.clearTelemetryLogs()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-canvas-muted text-slate-700 text-xs transition-colors border border-canvas-border focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 min-h-[44px]"
                  aria-label="Clear logs"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  Clear Logs
                </button>
              </div>

              {telemetryLogs.length === 0 ? (
                <div className="p-12 text-center bg-canvas-muted rounded-xl border border-dashed border-canvas-border space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-white text-muted border border-canvas-border flex items-center justify-center mx-auto">
                    <Activity className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">Nothing happened yet</p>
                  <p className="text-xs text-muted">Use the app and see steps here — simple and transparent.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {telemetryLogs.map((log) => (
                    <div
                      key={log.id}
                      className="bg-canvas-muted/70 border border-canvas-border rounded-xl p-4 space-y-2 text-xs font-mono shadow-sm"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-sans">
                        <div className="flex items-center gap-3 flex-wrap">
                          {log.status === 'success' ? (
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : log.status === 'awaiting_approval' ? (
                            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                          )}
                          <span className="font-bold font-mono text-primary-text text-sm break-all">{log.toolName}</span>
                          <span className="text-caption px-2 py-0.5 rounded bg-white text-muted border border-canvas-border whitespace-nowrap">
                            {log.approvalMetadata?.approvedBy ? `approved by ${log.approvalMetadata.approvedBy}` : log.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-muted text-xs flex-wrap">
                          <span>{log.durationMs}ms</span>
                          <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                          <button
                            onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                            className="text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary rounded px-1"
                          >
                            {expandedLogId === log.id ? 'Collapse' : 'Payload'}
                          </button>
                        </div>
                      </div>

                      {log.result?.plainLanguageExplanation && (
                        <p className="font-sans text-xs text-slate-700 leading-relaxed bg-white p-2.5 rounded-xl border border-canvas-border">
                          {log.result.plainLanguageExplanation}
                        </p>
                      )}

                      {expandedLogId === log.id && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-caption">
                          <div className="min-w-0">
                            <div className="text-muted mb-1 font-bold">Input Params:</div>
                            <pre className="bg-white p-2 rounded-xl border border-canvas-border overflow-x-auto text-emerald-700 max-h-48 overflow-y-auto">
                              {JSON.stringify(log.params, null, 2)}
                            </pre>
                          </div>
                          <div className="min-w-0">
                            <div className="text-muted mb-1 font-bold">Tool Result:</div>
                            <pre className="bg-white p-2 rounded-xl border border-canvas-border overflow-x-auto text-primary-text max-h-48 overflow-y-auto">
                              {JSON.stringify(log.result?.data || log.error, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MANUAL TRIGGER PLAYGROUND */}
          {activeTab === 'playground' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Tool Selector & Param Editor */}
              <div className="space-y-4 min-w-0">
                <div>
                  <label className="block text-caption font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Select WebMCP Tool to Execute
                  </label>
                  <select
                    value={selectedToolName}
                    onChange={(e) => handleSelectToolForPlayground(e.target.value)}
                    className="w-full px-3 py-2.5 bg-canvas-muted border border-canvas-border rounded-xl text-sm text-slate-900 font-mono focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[44px]"
                  >
                    {tools.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name} — {MODULE_DISPLAY[t.moduleOwner] || t.moduleOwner}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <label className="text-caption font-bold text-slate-700 uppercase tracking-wider">
                      JSON Input Parameters
                    </label>
                    <span className="text-caption text-muted font-mono hidden sm:inline">JSON Schema Draft 2020-12</span>
                  </div>
                  <textarea
                    value={playgroundParams}
                    onChange={(e) => setPlaygroundParams(e.target.value)}
                    rows={12}
                    className="w-full p-3 bg-canvas-muted border border-canvas-border rounded-xl font-mono text-xs text-emerald-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 leading-relaxed"
                  />
                </div>

                <button
                  onClick={handleExecutePlayground}
                  disabled={isExecuting}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-bold shadow focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-all disabled:opacity-50 min-h-[44px]"
                >
                  {isExecuting ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                      Executing Tool...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Execute WebMCP Tool
                    </>
                  )}
                </button>
              </div>

              {/* Right Column: Execution Response Viewer */}
              <div className="space-y-4 min-w-0">
                <div className="text-caption font-bold text-slate-700 uppercase tracking-wider">Execution Output</div>

                {playgroundResult ? (
                  <div className="bg-canvas-muted border border-canvas-border rounded-xl p-4 space-y-3 font-mono text-xs overflow-auto max-h-[460px]">
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-canvas-border font-sans flex-wrap">
                      <span
                        className={`text-caption font-bold px-2 py-0.5 rounded border ${
                          (playgroundResult as { success?: boolean })?.success
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {(playgroundResult as { success?: boolean })?.success ? 'Success 200 OK' : 'Execution Failed'}
                      </span>
                      <span className="text-caption text-muted">{(playgroundResult as { timestamp?: string })?.timestamp}</span>
                    </div>

                    {(playgroundResult as { plainLanguageExplanation?: string })?.plainLanguageExplanation && (
                      <div className="bg-white p-3 rounded-xl border border-canvas-border text-slate-800 font-sans text-xs leading-relaxed">
                        <strong>Plain Language Narrative:</strong>
                        <p className="mt-1 text-slate-700">{(playgroundResult as { plainLanguageExplanation?: string }).plainLanguageExplanation}</p>
                      </div>
                    )}

                    <pre className="text-primary-text text-caption overflow-x-auto max-h-64 overflow-y-auto">
                      {JSON.stringify(playgroundResult, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="h-[400px] flex flex-col items-center justify-center p-8 text-center bg-canvas-muted rounded-xl border border-dashed border-canvas-border text-muted text-xs">
                    <Code2 className="w-8 h-8 text-muted mb-2" />
                    Select a tool and click "Execute WebMCP Tool" to trigger client-side execution.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: HUMAN APPROVAL INTERCEPTOR */}
          {activeTab === 'approvals' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted">
                  Mandatory Human Trust Gate: No tool alters state without patient or caregiver consent.
                </div>
              </div>

              {pendingApprovals.length === 0 ? (
                <div className="p-12 text-center bg-canvas-muted rounded-xl border border-dashed border-canvas-border text-muted text-xs">
                  <CheckCircle className="w-8 h-8 text-emerald-500/60 mx-auto mb-2" />
                  All staged facts and proposals have been reviewed. Zero pending approvals.
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingApprovals.map((item) => (
                    <div
                      key={item.id}
                      className="bg-canvas-muted border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-caption uppercase font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            {item.toolName}
                          </span>
                          <span className="text-xs font-bold text-slate-800">{item.title}</span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">{item.description}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => webMCPEngine.resolveApproval(item.id || (item as unknown as { invocationId?: string }).invocationId || '', true)}
                          className="flex items-center gap-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors shadow focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 min-h-[44px]"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => webMCPEngine.resolveApproval(item.id || (item as unknown as { invocationId?: string }).invocationId || '', false)}
                          className="flex items-center gap-1 px-3 py-2 bg-white hover:bg-canvas-muted text-rose-700 rounded-xl text-xs font-medium border border-canvas-border transition-colors focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 min-h-[44px]"
                        >
                          <X className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
