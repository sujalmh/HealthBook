import React, { useState, useEffect } from 'react';
import { FactEntity } from '@/types/vault';
import type { BoundingBox } from '@/types/vault';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { resolvePatientId } from '@/components/common/resolvePatientId';
import { Eye, Check, X, Edit3, Sparkles, FileText, CheckCircle, X as XIcon, Copy, FlaskConical } from 'lucide-react';

type FactExtra = FactEntity & {
  approvalStatus?: string;
  factKey?: string;
  plainNarration?: string;
  factValue?: unknown;
  documentId?: string;
  boundingBox?: BoundingBox;
  sourceBoundingBox?: BoundingBox;
  approvedAt?: string;
  timestamp?: string;
  approvedBy?: string;
};

export const FactStreamView: React.FC<{ patientId?: string }> = ({ patientId }) => {
  const [facts, setFacts] = useState<FactEntity[]>([]);
  const [documents, setDocuments] = useState<Array<{ id: string; fileName?: string; name?: string; extractedText?: string }>>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeOcrText, setActiveOcrText] = useState<string | null>(null);
  const [activeDocName, setActiveDocName] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const effectivePatientId = resolvePatientId(patientId);

  const loadFacts = async () => {
    setIsLoading(true);
    if (!effectivePatientId) {
      setFacts([]);
      setDocuments([]);
      setIsLoading(false);
      return;
    }
    const all = await localVault.getFacts(effectivePatientId);
    const docs = await localVault.getDocuments(effectivePatientId);
    setFacts(all);
    setDocuments(docs);
    setIsLoading(false);
  };

  useEffect(() => {
    loadFacts();
    const u1 = eventBus.on('fact_extracted', loadFacts);
    const u2 = eventBus.on('fact_confirmed', loadFacts);
    return () => {
      u1();
      u2();
    };
  }, [effectivePatientId]);

  const pendingFacts = facts.filter((f) => {
    const extra = f as unknown as FactExtra;
    return f.status === 'unconfirmed' || extra.approvalStatus === 'pending' || extra.approvalStatus === 'unconfirmed';
  });
  const approvedFacts = facts.filter((f) => {
    const extra = f as unknown as FactExtra;
    return f.status === 'confirmed' || extra.approvalStatus === 'approved' || extra.approvalStatus === 'confirmed';
  });

  // R3 deduplication: labs are now consolidated in single IndicatorTable (LabStoryView) via findLocalStandard — delegate to avoid scattered duplicates
  const isLabCategory = (c: string) => (c ?? '').toLowerCase().trim() === 'lab';
  const pendingLabsCount = pendingFacts.filter((f) => isLabCategory(f.category)).length;
  const approvedLabsCount = approvedFacts.filter((f) => isLabCategory(f.category)).length;
  const pendingFactsDisplay = pendingFacts.filter((f) => !isLabCategory(f.category));
  const filteredApprovedFactsBase = approvedFacts.filter((f) => {
    if (selectedCategory !== 'all' && f.category !== selectedCategory) return false;
    return true;
  });
  // When browsing saved records, lab rows are delegated to IndicatorTable — show delegation instead of duplicates
  const filteredApprovedFacts = filteredApprovedFactsBase.filter((f) => !isLabCategory(f.category));
  const labDelegationActive = isLabCategory(selectedCategory);

  const handleHighlight = (fact: FactEntity) => {
    const extra = fact as unknown as FactExtra;
    const bbox = (extra.boundingBox || extra.sourceBoundingBox || null) as BoundingBox | null;
    const docId = (fact.sourceDocId || extra.documentId || '') as string;
    if (bbox) eventBus.highlightSourceDocument({ documentId: docId, boundingBox: bbox });
    else eventBus.highlightSourceDocument(docId, bbox as unknown as BoundingBox);
  };

  const handleApprove = async (fact: FactEntity) => {
    setActionLoading(fact.id);
    try {
      await webMCPEngine.execute('confirm_fact', { factId: fact.id, action: 'approve' });
      await loadFacts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Approval failed';
      eventBus.dispatchToast({ type: 'error', message: msg });
    } finally { setActionLoading(null); }
  };
  const handleReject = async (fact: FactEntity) => {
    setActionLoading(fact.id);
    try {
      await webMCPEngine.execute('confirm_fact', { factId: fact.id, action: 'reject' });
      await loadFacts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Rejection failed';
      eventBus.dispatchToast({ type: 'error', message: msg });
    } finally { setActionLoading(null); }
  };
  const handleSaveEdit = async (fact: FactEntity) => {
    if (!editValue.trim()) return;
    setActionLoading(fact.id);
    try {
      await webMCPEngine.execute('confirm_fact', { factId: fact.id, action: 'edit', editedValue: editValue, edits: { value: editValue } } as unknown as Record<string, unknown>);
      setEditingId(null);
      await loadFacts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Edit failed';
      eventBus.dispatchToast({ type: 'error', message: msg });
    } finally { setActionLoading(null); }
  };

  const getCategoryStyle = (cat: string) => {
    switch (cat) {
      case 'medication': return 'bg-primary-light text-primary-text border-primary-border';
      case 'lab': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'allergy': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'condition': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  const formatValue = (fact: FactEntity) => {
    const extra = fact as unknown as FactExtra;
    const raw = (extra as { value?: unknown }).value ?? extra.factValue ?? '';
    if (typeof raw === 'object' && raw !== null) {
      const s = (raw as { rawSnippet?: string }).rawSnippet || JSON.stringify(raw);
      return s.slice(0, 60);
    }
    return String(raw).slice(0, 60);
  };

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {isLoading && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
          <div className="h-4 w-1/3 bg-slate-100 rounded animate-pulse" />
          <div className="space-y-1">
            <div className="h-8 bg-slate-100 rounded animate-pulse" />
            <div className="h-8 bg-slate-100 rounded animate-pulse" />
            <div className="h-8 bg-slate-100 rounded animate-pulse" />
          </div>
        </div>
      )}

      {/* Pending — uniform table, no large logo, batch actions */}
      {!isLoading && pendingFacts.length > 0 && (
        <div className="w-full bg-white border border-amber-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-3 sm:px-4 py-3 border-b border-amber-100 bg-amber-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                Review extracted details
                <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">{pendingFacts.length} to review</span>
              </h3>
              <p className="text-caption text-amber-800/80">Check before they update medicines and labs. Uniform table — no redundant header.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <button
                onClick={async () => {
                  try {
                    await webMCPEngine.execute('confirm_fact', { factId: 'all', action: 'reject' });
                    eventBus.dispatchToast({ type: 'info', message: `Rejected all ${pendingFacts.length} items.` });
                    loadFacts();
                  } catch (e: unknown) { const msg = e instanceof Error ? e.message : 'Rejection failed'; eventBus.dispatchToast({ type: 'error', message: msg }); }
                }}
                className="flex-1 sm:flex-none px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg flex items-center justify-center gap-1.5 min-h-[36px]"
              >
                <X className="w-3.5 h-3.5" /> Reject All
              </button>
              <button
                onClick={async () => {
                  try {
                    await webMCPEngine.execute('confirm_fact', { factId: 'all', action: 'approve' });
                    eventBus.dispatchToast({ type: 'success', message: `Approved all ${pendingFacts.length} items.` });
                    loadFacts();
                  } catch (e: unknown) { const msg = e instanceof Error ? e.message : 'Approval failed'; eventBus.dispatchToast({ type: 'error', message: msg }); }
                }}
                className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center justify-center gap-1.5 min-h-[36px] shadow-sm"
              >
                <CheckCircle className="w-4 h-4" /> Accept All
              </button>
            </div>
          </div>

          <div className="px-3 sm:px-4 py-2 bg-amber-50/30 border-b border-amber-100 flex flex-wrap items-center gap-1.5">
            {(() => {
              const meds = pendingFacts.filter(f => (f.category || '').toLowerCase().includes('med')).length;
              const labs = pendingFacts.filter(f => (f.category || '').toLowerCase().includes('lab')).length;
              const conds = pendingFacts.filter(f => (f.category || '').toLowerCase().includes('cond')).length;
              const allgs = pendingFacts.filter(f => (f.category || '').toLowerCase().includes('allerg')).length;
              return (
                <>
                  {meds > 0 && <span className="px-2 py-1 bg-sky-50 text-sky-800 border border-sky-200 rounded-full text-[11px] font-semibold">{meds} meds</span>}
                  {labs > 0 && <span className="px-2 py-1 bg-violet-50 text-violet-800 border border-violet-200 rounded-full text-[11px] font-semibold">{labs} labs</span>}
                  {conds > 0 && <span className="px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-[11px] font-semibold">{conds} conditions</span>}
                  {allgs > 0 && <span className="px-2 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded-full text-[11px] font-semibold">{allgs} allergies</span>}
                  {documents.some((d) => d.extractedText) && (
                    <button type="button" onClick={() => { const docWithOcr = documents.find((d) => d.extractedText); if (docWithOcr) { setActiveOcrText(docWithOcr.extractedText ?? ''); setActiveDocName(docWithOcr.fileName || docWithOcr.name || 'Document'); } }} className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-black text-white rounded-full text-[11px] font-bold">
                      <FileText className="w-3 h-3 text-emerald-400" /> View text
                    </button>
                  )}
                </>
              );
            })()}
          </div>

          {/* R3: Lab facts delegated to single IndicatorTable — no scattered duplicate rows; labs consolidated one row per marker via findLocalStandard */}
          {pendingLabsCount > 0 && (
            <div className="px-3 sm:px-4 py-2 bg-violet-50 border-b border-violet-200 text-caption text-violet-800 flex items-center gap-2">
              <span className="font-bold">{pendingLabsCount} lab{pendingLabsCount===1?'':'s'} now in Indicators</span>
              <span className="text-violet-700/80">— consolidated one row per marker in Health → Lab Results → Indicators table. Tap row for details (value+ref+flag+history+chart). Pending labs handled via LabStory deduplication.</span>
            </div>
          )}
          <div className="overflow-x-auto scrollbar-none">
            <table className="w-full text-left text-body-sm min-w-[760px]">
              <thead>
                <tr className="border-b border-canvas-border bg-canvas-muted/50 text-caption text-muted uppercase tracking-wider">
                  <th className="py-2.5 px-3 font-semibold w-[90px]">Type</th>
                  <th className="py-2.5 px-3 font-semibold w-[150px]">Name</th>
                  <th className="py-2.5 px-3 font-semibold w-[130px]">Value</th>
                  <th className="py-2.5 px-3 font-semibold">Description</th>
                  <th className="py-2.5 px-3 font-semibold w-[90px]">Conf.</th>
                  <th className="py-2.5 px-3 font-semibold w-[110px]">Source</th>
                  <th className="py-2.5 px-3 font-semibold w-[220px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-canvas-border bg-white">
                {pendingFactsDisplay.map((fact) => {
                  const isEditing = editingId === fact.id;
                  const isBusy = actionLoading === fact.id;
                  return (
                    <tr key={fact.id} className="hover:bg-canvas-muted/30 transition-colors align-top">
                      <td className="py-3 px-3">
                        <span className={`text-caption font-bold uppercase px-2 py-0.5 rounded-full border whitespace-nowrap ${getCategoryStyle(fact.category)}`}>{fact.category}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-body-sm font-semibold text-slate-900 truncate block max-w-[150px]" title={fact.name || (fact as unknown as FactExtra).factKey}>{fact.name || (fact as unknown as FactExtra).factKey}</span>
                      </td>
                      <td className="py-3 px-3">
                        {isEditing ? (
                          <input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-full px-2.5 py-1.5 bg-white border border-primary rounded-lg text-body-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[36px]" autoFocus />
                        ) : (
                          <span className="font-mono text-body-sm font-bold text-slate-900 truncate block max-w-[130px]" title={formatValue(fact)}>{formatValue(fact)} <span className="font-normal text-muted text-caption">{fact.unit}</span></span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <p className="text-body-sm text-muted leading-snug line-clamp-2 max-w-[320px]">{fact.plainExplanation || (fact as unknown as FactExtra).plainNarration || '—'}</p>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-caption text-muted"><Sparkles className="w-3 h-3 text-amber-500" />{Math.round((fact.confidence || 0.85) * 100)}%</span>
                      </td>
                      <td className="py-3 px-3">
                        <button onClick={() => handleHighlight(fact)} className="inline-flex items-center gap-1 text-caption font-semibold text-primary hover:text-primary-hover bg-primary-light hover:bg-primary-light/80 border border-primary-border px-2.5 py-1 rounded-full transition-colors min-h-[32px]">
                          <Eye className="w-3 h-3" />Source
                        </button>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {isEditing ? (
                            <>
                              <button onClick={() => handleSaveEdit(fact)} disabled={!!isBusy} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-caption font-bold min-h-[32px] disabled:opacity-50">Save</button>
                              <button onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-white border border-canvas-border rounded-lg text-caption font-semibold min-h-[32px]">Cancel</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => handleApprove(fact)} disabled={!!isBusy} className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-caption font-bold min-h-[32px] disabled:opacity-50"><Check className="w-3 h-3" />Approve</button>
                              <button onClick={() => { setEditingId(fact.id); setEditValue(formatValue(fact)); }} disabled={!!isBusy} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-canvas-border rounded-lg text-caption font-semibold hover:bg-canvas-muted min-h-[32px]"><Edit3 className="w-3 h-3" />Edit</button>
                              <button onClick={() => handleReject(fact)} disabled={!!isBusy} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-caption font-semibold min-h-[32px]"><X className="w-3 h-3" />Reject</button>
                            </>
                          )}
                        </div>
                        {isBusy && <div className="h-0.5 mt-1.5 bg-canvas-muted rounded-full overflow-hidden"><div className="h-full w-1/2 bg-primary animate-pulse" /></div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isLoading && pendingFacts.length === 0 && facts.length > 0 && (
        <div className="w-full bg-white border border-emerald-200 rounded-xl p-3 flex items-center gap-2.5 shadow-sm">
          <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 shrink-0"><CheckCircle className="w-4 h-4" /></div>
          <p className="text-xs font-semibold text-slate-700">All caught up — no pending. Approved below.</p>
        </div>
      )}

      <div className="w-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-3 sm:px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900">Your Saved Records</h3>
            <p className="text-caption text-muted">Once you approve, they sync to medicines, labs, and doctor pack. {approvedFacts.length} saved.</p>
          </div>
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 text-xs overflow-x-auto scrollbar-none shrink-0">
            {['all', 'lab', 'medication', 'allergy', 'condition'].map((cat) => (
              <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-2.5 py-1.5 rounded-md capitalize font-semibold whitespace-nowrap text-[11px] sm:text-xs ${selectedCategory === cat ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{cat === 'all' ? 'All' : cat}</button>
            ))}
          </div>
        </div>

        {/* R3 delegation banner — labs consolidated in single IndicatorTable (LabStoryView) via findLocalStandard, not duplicated here */}
        {approvedLabsCount > 0 && !labDelegationActive && (
          <div className="px-3 sm:px-4 py-2 bg-violet-50 border-y border-violet-200 text-caption text-violet-800 flex items-center gap-2">
            <span className="font-bold">{approvedLabsCount} lab{approvedLabsCount===1?'':'s'} in Indicators</span>
            <span className="text-violet-700/80">— consolidated one row per marker in Health → Lab Results → Indicators table (tap row for details: value+ref+flag+history+chart+note).</span>
          </div>
        )}
        {labDelegationActive ? (
          <div className="p-6 sm:p-8 text-center bg-violet-50/60 border-y border-violet-200">
            <div className="w-10 h-10 rounded-xl bg-white border border-violet-200 text-violet-600 flex items-center justify-center mx-auto"><FlaskConical className="w-5 h-5" aria-hidden="true" /></div>
            <p className="text-sm font-bold text-slate-900 mt-2">Lab results are in Indicators</p>
            <p className="text-xs text-slate-600 max-w-sm mx-auto">One row per biomarker in Health → Lab Results → Indicators. Tap any row for details: latest value, reference range, status, history, plain explanation, and trend chart.</p>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 bg-white border border-violet-200 px-2.5 py-1 rounded-full mt-2">Indicators • one row per marker • details on click</span>
          </div>
        ) : filteredApprovedFacts.length === 0 ? (
          <div className="p-6 sm:p-8 text-center bg-slate-50/50">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center mx-auto"><FileText className="w-5 h-5" /></div>
            <p className="text-sm font-semibold text-slate-700 mt-2">No records yet</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">Upload a PDF above. Approved facts appear here.</p>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-full mt-2"><Sparkles className="w-3 h-3 text-amber-500" /> Drop PDF to start</span>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-none">
            <table className="w-full text-left text-body-sm min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                  <th className="py-2.5 px-3 font-semibold w-[96px]">Type</th>
                  <th className="py-2.5 px-3 font-semibold w-[160px]">Name</th>
                  <th className="py-2.5 px-3 font-semibold w-[140px]">Value</th>
                  <th className="py-2.5 px-3 font-semibold">Description</th>
                  <th className="py-2.5 px-3 font-semibold w-[96px]">Source</th>
                  <th className="py-2.5 px-3 font-semibold w-[120px]">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredApprovedFacts.map((fact) => (
                  <tr key={fact.id} className="hover:bg-slate-50 transition-colors align-top">
                    <td className="py-3 px-3">
                      <span className={`text-caption font-bold uppercase px-2 py-0.5 rounded-full border whitespace-nowrap ${getCategoryStyle(fact.category)}`}>{fact.category}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-900 truncate block max-w-[160px]" title={fact.name || (fact as unknown as FactExtra).factKey}>{fact.name || (fact as unknown as FactExtra).factKey}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono font-bold text-slate-900 truncate block max-w-[140px]" title={`${formatValue(fact)} ${fact.unit || ''}`}>{formatValue(fact)} {fact.unit && <span className="font-normal text-muted text-caption">{fact.unit}</span>}</span>
                    </td>
                    <td className="py-3 px-3">
                      <p className="text-body-sm text-muted leading-snug line-clamp-2 max-w-[360px]" title={fact.plainExplanation || (fact as unknown as FactExtra).plainNarration}>{(fact.plainExplanation || (fact as unknown as FactExtra).plainNarration || '').split('.').slice(0,2).join('.').slice(0,180) || '—'}</p>
                    </td>
                    <td className="py-3 px-3">
                      <button onClick={() => handleHighlight(fact)} className="inline-flex items-center gap-1 text-caption font-semibold text-primary hover:bg-primary-light border border-primary-border px-2.5 py-1 rounded-full min-h-[32px] bg-white"><Eye className="w-3 h-3" /> Source</button>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-caption text-muted">
                      {new Date((fact as unknown as FactExtra).approvedAt || fact.createdAt || (fact as unknown as FactExtra).timestamp || Date.now()).toLocaleDateString()}
                      <span className="block text-caption text-muted/80">{fact.approvedBy ? `by ${fact.approvedBy}` : ''}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
          <span>{filteredApprovedFacts.length} saved</span>
          <span className="hidden sm:inline">Value narrow, description wide — tap Source to highlight</span>
        </div>
      </div>

      {activeOcrText && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-3 sm:px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="p-2 bg-white text-slate-700 rounded-lg border border-slate-200 shrink-0 hidden sm:flex"><FileText className="w-4 h-4" /></div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 truncate">What we read</h3>
                  <p className="text-xs text-slate-500 truncate hidden sm:block">{activeDocName || 'Your paper'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button type="button" onClick={() => { navigator.clipboard.writeText(activeOcrText); eventBus.dispatchToast({ type: 'success', message: 'Copied' }); }} className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold bg-white border border-slate-200 rounded-lg">
                  <Copy className="w-3.5 h-3.5" /><span className="hidden sm:inline">Copy</span>
                </button>
                <button type="button" onClick={() => setActiveOcrText(null)} className="p-1.5 sm:p-2 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-white border border-transparent hover:border-slate-200">
                  <XIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-white p-3 sm:p-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                <div className="px-3 py-2 bg-white border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Text from your paper</span>
                  <span className="text-[11px] font-mono text-slate-500">{activeOcrText.length} chars</span>
                </div>
                <pre className="text-slate-800 font-mono text-[11px] sm:text-xs whitespace-pre-wrap leading-relaxed p-3 sm:p-4 max-h-[60vh] overflow-auto">{activeOcrText}</pre>
              </div>
            </div>
            <div className="px-3 sm:px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <span className="hidden sm:inline">What we read from your paper</span>
              <button type="button" onClick={() => setActiveOcrText(null)} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-slate-900 text-white font-semibold rounded-lg text-xs sm:text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
