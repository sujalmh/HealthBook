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

export const WebMCPInspector: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'telemetry' | 'playground' | 'approvals'>('catalog');
  const [tools, setTools] = useState<WebMCPToolDefinition[]>([]);
  const [telemetryLogs, setTelemetryLogs] = useState<TelemetryLogEntry[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalItem[]>([]);
  const [selectedToolName, setSelectedToolName] = useState<string>('extract_fact');
  const [playgroundParams, setPlaygroundParams] = useState<string>('{\n  "documentId": "doc-discharge-001"\n}');
  const [playgroundResult, setPlaygroundResult] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [catalogFilterModule, setCatalogFilterModule] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const refreshData = () => {
    setTools(webMCPEngine.getRegisteredTools());
    setTelemetryLogs(webMCPEngine.getTelemetryLogs());
    setPendingApprovals(webMCPEngine.getPendingApprovals());
  };

  useEffect(() => {
    refreshData();
    const u1 = eventBus.on('tool_registered', refreshData);
    const u2 = eventBus.on('tool_execution_success', refreshData);
    const u3 = eventBus.on('tool_execution_error', refreshData);
    const u4 = eventBus.on('telemetry_updated', refreshData);
    const u5 = eventBus.on('approval_queued', refreshData);
    const u6 = eventBus.on('approval_resolved', refreshData);

    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
    };
  }, []);

  // Preload sample payloads when selected tool changes in playground
  const handleSelectToolForPlayground = (toolName: string) => {
    setSelectedToolName(toolName);
    setPlaygroundResult(null);

    const samplePayloads: Record<string, object> = {
      extract_fact: {
        documentId: 'doc-discharge-001',
        rawText: 'Discharge Summary: Metformin 1000mg BID, Apixaban 5mg BID, eGFR 32 mL/min, Penicillin allergy.',
        documentType: 'discharge_summary',
      },
      confirm_fact: {
        factId: 'fact-egfr-demo',
        action: 'approve',
      },
      compile_health_record: {
        format: 'json_bundle',
        includeAuditTrail: true,
      },
      extract_labs: {
        documentId: 'doc-lab-homelab-001',
        normalizeUnits: true,
      },
      correlate_meds: {
        markerCode: 'Creatinine',
        timeframeDays: 90,
      },
      add_medication: {
        name: 'Metformin HCl',
        genericName: 'metformin',
        dosage: '1000 mg',
        timeSlots: ['morning', 'evening'],
        category: 'rx',
        withFood: true,
      },
      check_interactions: {},
      check_diet_interactions: {},
      check_duplicate_ingredient: {},
      suggest_schedule: {
        chronotype: 'night_owl',
        separateCalcium: true,
      },
      simulate_adherence: {
        medicationName: 'Apixaban 5mg',
        timeSlot: 'morning',
        day: 'tue',
      },
      export_for_pharmacist: {
        format: 'pdf_map',
      },
      explain_med_change: {
        medicationName: 'Apixaban',
        dischargeDose: '5 mg twice daily',
        changeCategory: 'new',
        reason: 'Atrial fibrillation stroke prevention',
      },
      flag_interaction: {},
      flag_diet_interaction: {},
      suggest_question_for_doctor: {
        context: 'Lisinopril held at discharge',
      },
      export_patient_summary: {
        format: 'one_page_pdf',
      },
      upload_lab_image: {
        imageData: 'data:image/jpeg;base64,sample...',
        prescribedDueCardId: 'cal-creat-due-001',
      },
      doctor_review_comment: {
        labId: 'lab-creat-20260828',
        comment: 'Serum Creatinine jumped to 1.9; reducing metformin and rechecking in 2 weeks.',
      },
      propose_dosage_change: {
        targetMedicationName: 'Metformin HCl',
        proposedDosage: '500 mg morning only',
        clinicalRationale: 'Reduced renal clearance (eGFR 28).',
      },
      report_danger_sign: {
        symptom: 'Bilateral pedal edema + shortness of breath',
        severity: 'urgent_doctor_same_day',
      },
      schedule_followup: {
        title: 'Dr. Patel Nephrology Clinic Review',
        dueDate: '2026-09-11',
        location: 'clinic',
      },
      switch_profile: {
        targetUserId: 'user-raj-devi',
        role: 'caregiver',
        onBehalfOfPatientId: 'patient-s-devi',
      },
      grant_doctor_access: {
        doctorName: 'Dr. Kevin Chen, MD',
        doctorClinic: 'Metropolitan Cardiology',
        durationDays: 7,
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
    } catch (err: any) {
      setPlaygroundResult({
        success: false,
        error: err?.message || 'Execution error',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white border border-slate-200/80 rounded-2xl w-full max-w-5xl h-[85vh] shadow-2xl flex flex-col text-slate-900 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 border border-sky-200 rounded-xl text-sky-400">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">CareCanvas WebMCP Inspector</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-200">
                  {webMCPEngine.isNative ? 'Native WebMCP' : 'Polyfill Mock Adapter'}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Live tool registry ({tools.length} Registered Tools across 7 Modules) • W3C WebML Compliant
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-200 bg-slate-50 text-xs">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`flex items-center gap-1.5 px-4 py-2.5 font-bold border-b-2 transition-colors ${
              activeTab === 'catalog'
                ? 'border-sky-400 text-sky-400 bg-slate-100/40'
                : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            Tool Catalog ({tools.length})
          </button>

          <button
            onClick={() => setActiveTab('telemetry')}
            className={`flex items-center gap-1.5 px-4 py-2.5 font-bold border-b-2 transition-colors ${
              activeTab === 'telemetry'
                ? 'border-sky-400 text-sky-400 bg-slate-100/40'
                : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            Invocation Telemetry ({telemetryLogs.length})
          </button>

          <button
            onClick={() => setActiveTab('playground')}
            className={`flex items-center gap-1.5 px-4 py-2.5 font-bold border-b-2 transition-colors ${
              activeTab === 'playground'
                ? 'border-sky-400 text-sky-400 bg-slate-100/40'
                : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            <Play className="w-4 h-4" />
            Manual Trigger Playground
          </button>

          <button
            onClick={() => setActiveTab('approvals')}
            className={`flex items-center gap-1.5 px-4 py-2.5 font-bold border-b-2 transition-colors ${
              activeTab === 'approvals'
                ? 'border-amber-400 text-amber-400 bg-slate-100/40'
                : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Approval Gate Interceptor ({pendingApprovals.length})
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB 1: TOOL CATALOG */}
          {activeTab === 'catalog' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <Filter className="w-3.5 h-3.5 text-slate-600" />
                  <span className="text-slate-600">Filter by Module:</span>
                  {['all', 'vault', 'labstory', 'pillmap', 'rxbridge', 'homelab', 'safety', 'carecircle', 'dossier'].map(
                    (mod) => (
                      <button
                        key={mod}
                        onClick={() => setCatalogFilterModule(mod)}
                        className={`px-2.5 py-1 rounded capitalize font-medium transition-colors ${
                          catalogFilterModule === mod
                            ? 'bg-sky-500/20 text-sky-700 border border-sky-500/40'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {mod}
                      </button>
                    )
                  )}
                </div>
                <div className="text-xs text-slate-600 font-mono">Showing {filteredTools.length} tools</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTools.map((tool) => (
                  <div
                    key={tool.name}
                    className="bg-slate-50/70 border border-slate-200 hover:border-slate-200 rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-mono text-sm font-bold text-sky-700">{tool.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {tool.moduleOwner}
                          </span>
                          <span className="text-[10px] font-mono text-slate-600">{tool.category}</span>
                        </div>
                      </div>
                      {tool.requiresHumanApproval ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 border border-amber-200">
                          Approval Required
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          Auto-Execute
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed">{tool.description}</p>

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-600 font-mono">
                        Params: {Object.keys(tool.parameters?.properties || {}).length} fields (
                        {tool.parameters?.required?.join(', ') || 'none required'})
                      </span>
                      <button
                        onClick={() => {
                          handleSelectToolForPlayground(tool.name);
                          setActiveTab('playground');
                        }}
                        className="flex items-center gap-1 text-sky-400 hover:text-sky-700 font-semibold text-xs"
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
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-600">Real-Time WebMCP Dispatcher Stream</div>
                <button
                  onClick={() => webMCPEngine.clearTelemetryLogs()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-100 text-slate-700 text-xs transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  Clear Logs
                </button>
              </div>

              {telemetryLogs.length === 0 ? (
                <div className="p-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
                    <Activity className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">Nothing happened yet</p>
                  <p className="text-xs text-slate-600">Use the app and see steps here — simple and transparent.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {telemetryLogs.map((log) => (
                    <div
                      key={log.id}
                      className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-2 text-xs font-mono"
                    >
                      <div className="flex items-center justify-between font-sans">
                        <div className="flex items-center gap-3">
                          {log.status === 'success' ? (
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                          ) : log.status === 'awaiting_approval' ? (
                            <Clock className="w-4 h-4 text-amber-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400" />
                          )}
                          <span className="font-bold font-mono text-sky-700 text-sm">{log.toolName}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                            {log.approvalMetadata?.approvedBy ? `approved by ${log.approvalMetadata.approvedBy}` : log.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-600 text-xs">
                          <span>{log.durationMs}ms</span>
                          <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                          <button
                            onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                            className="text-sky-400 hover:underline"
                          >
                            {expandedLogId === log.id ? 'Collapse' : 'Payload'}
                          </button>
                        </div>
                      </div>

                      {log.result?.plainLanguageExplanation && (
                        <p className="font-sans text-xs text-slate-700 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200">
                          {log.result.plainLanguageExplanation}
                        </p>
                      )}

                      {expandedLogId === log.id && (
                        <div className="grid grid-cols-2 gap-3 pt-2 text-[11px]">
                          <div>
                            <div className="text-slate-600 mb-1 font-bold">Input Params:</div>
                            <pre className="bg-white p-2 rounded-lg border border-slate-200 overflow-x-auto text-emerald-700">
                              {JSON.stringify(log.params, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <div className="text-slate-600 mb-1 font-bold">Tool Result:</div>
                            <pre className="bg-white p-2 rounded-lg border border-slate-200 overflow-x-auto text-sky-700">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Tool Selector & Param Editor */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Select WebMCP Tool to Execute
                  </label>
                  <select
                    value={selectedToolName}
                    onChange={(e) => handleSelectToolForPlayground(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-mono focus:border-sky-500 focus:outline-none"
                  >
                    {tools.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name} ({t.moduleOwner})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      JSON Input Parameters
                    </label>
                    <span className="text-[10px] text-slate-600 font-mono">JSON Schema Draft 2020-12</span>
                  </div>
                  <textarea
                    value={playgroundParams}
                    onChange={(e) => setPlaygroundParams(e.target.value)}
                    rows={12}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-emerald-400 focus:border-sky-500 focus:outline-none leading-relaxed"
                  />
                </div>

                <button
                  onClick={handleExecutePlayground}
                  disabled={isExecuting}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-bold shadow-lg transition-all disabled:opacity-50"
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
              <div className="space-y-4">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Execution Output</div>

                {playgroundResult ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 font-mono text-xs overflow-auto max-h-[460px]">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200 font-sans">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${
                          playgroundResult.success
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {playgroundResult.success ? 'Success 200 OK' : 'Execution Failed'}
                      </span>
                      <span className="text-[10px] text-slate-600">{playgroundResult.timestamp}</span>
                    </div>

                    {playgroundResult.plainLanguageExplanation && (
                      <div className="bg-white p-3 rounded-lg border border-slate-200 text-slate-800 font-sans text-xs leading-relaxed">
                        <strong>Plain Language Narrative:</strong>
                        <p className="mt-1 text-slate-700">{playgroundResult.plainLanguageExplanation}</p>
                      </div>
                    )}

                    <pre className="text-sky-700 text-[11px] overflow-x-auto">
                      {JSON.stringify(playgroundResult, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="h-[400px] flex flex-col items-center justify-center p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-600 text-xs">
                    <Code2 className="w-8 h-8 text-slate-600 mb-2" />
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
                <div className="text-xs text-slate-600">
                  Mandatory Human Trust Gate: No tool alters state without patient or caregiver consent.
                </div>
              </div>

              {pendingApprovals.length === 0 ? (
                <div className="p-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-600 text-xs">
                  <CheckCircle className="w-8 h-8 text-emerald-500/60 mx-auto mb-2" />
                  All staged facts and proposals have been reviewed. Zero pending approvals.
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingApprovals.map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 border border-amber-200">
                            {item.toolName}
                          </span>
                          <span className="text-xs font-bold text-slate-800">{item.title}</span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">{item.description}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => webMCPEngine.resolveApproval(item.id || (item as any).invocationId || '', true)}
                          className="flex items-center gap-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors shadow"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => webMCPEngine.resolveApproval(item.id || (item as any).invocationId || '', false)}
                          className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-100 text-rose-700 rounded-lg text-xs font-medium border border-slate-200 transition-colors"
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
