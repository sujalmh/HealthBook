import React, { useState, useEffect } from 'react';
import { FactEntity } from '@/types/vault';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';
import { FactApprovalCard } from './FactApprovalCard';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { CheckCircle, ShieldAlert, Eye, FileText, Sparkles, X, Copy } from 'lucide-react';

export const FactStreamView: React.FC<{ patientId?: string }> = ({ patientId }) => {
  const [facts, setFacts] = useState<FactEntity[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeOcrText, setActiveOcrText] = useState<string | null>(null);
  const [activeDocName, setActiveDocName] = useState<string>('');

  const effectivePatientId = patientId || (() => {
    try {
      const raw = localStorage.getItem('carecanvas_active_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed?.userId || parsed?.id || '';
      }
    } catch {}
    return '';
  })();

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

  const pendingFacts = facts.filter((f) => f.status === 'unconfirmed' || (f as any).approvalStatus === 'pending' || (f as any).approvalStatus === 'unconfirmed');
  const approvedFacts = facts.filter((f) => f.status === 'confirmed' || (f as any).approvalStatus === 'approved' || (f as any).approvalStatus === 'confirmed');

  const filteredApprovedFacts = approvedFacts.filter((f) => {
    if (selectedCategory !== 'all' && f.category !== selectedCategory) return false;
    return true;
  });

  const handleHighlight = (fact: FactEntity) => {
    eventBus.highlightSourceDocument((fact.sourceDocId || fact.documentId || '') as string);
  };

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Loading skeletons - condensed */}
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

      {/* 1. Pending — condensed single-line list */}
      {!isLoading && pendingFacts.length > 0 && (
        <div className="w-full bg-white border border-amber-200 rounded-xl shadow-sm overflow-hidden">
          {/* Header — compact */}
          <div className="px-3 sm:px-4 py-3 border-b border-amber-100 bg-amber-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 bg-amber-500 text-white rounded-lg shrink-0 hidden sm:flex">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                  Review ({pendingFacts.length})
                  <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">{pendingFacts.length} pending</span>
                  <span className="hidden sm:inline text-[11px] font-medium text-white bg-slate-900 px-2 py-0.5 rounded-full">Batch only</span>
                </h3>
                <p className="hidden sm:block text-xs text-slate-500 leading-none">One line per item • Please review and tap Accept All</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <button
                onClick={async () => {
                  try {
                    await webMCPEngine.execute('confirm_fact', { factId: 'all', action: 'reject' });
                    eventBus.dispatchToast({ type: 'info', message: `Rejected all ${pendingFacts.length} items.` });
                    loadFacts();
                  } catch (e: any) {
                    eventBus.dispatchToast({ type: 'error', message: e?.message || 'Rejection failed' });
                  }
                }}
                className="flex-1 sm:flex-none px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg flex items-center justify-center gap-1.5 min-h-[36px]"
              >
                <X className="w-3.5 h-3.5" />
                Reject All
              </button>
              <button
                onClick={async () => {
                  try {
                    await webMCPEngine.execute('confirm_fact', { factId: 'all', action: 'approve' });
                    eventBus.dispatchToast({ type: 'success', message: `Approved all ${pendingFacts.length} items.` });
                    loadFacts();
                  } catch (e: any) {
                    eventBus.dispatchToast({ type: 'error', message: e?.message || 'Approval failed' });
                  }
                }}
                className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center justify-center gap-1.5 min-h-[36px] shadow-sm"
              >
                <CheckCircle className="w-4 h-4" />
                Accept All
              </button>
            </div>
          </div>

          {/* Category chips — compact */}
          <div className="px-3 sm:px-4 py-2 bg-amber-50/30 border-b border-amber-100 flex flex-wrap items-center gap-1.5">
            {(() => {
              const meds = pendingFacts.filter(f => (f.category || '').toLowerCase().includes('med')).length;
              const labs = pendingFacts.filter(f => (f.category || '').toLowerCase().includes('lab')).length;
              const conds = pendingFacts.filter(f => (f.category || '').toLowerCase().includes('cond') || (f.category || '').toLowerCase().includes('diagnos')).length;
              const allgs = pendingFacts.filter(f => (f.category || '').toLowerCase().includes('allerg')).length;
              const follow = pendingFacts.filter(f => (f.category || '').toLowerCase().includes('follow') || (f.category || '').toLowerCase().includes('due')).length;
              const diets = pendingFacts.filter(f => (f.category || '').toLowerCase().includes('diet') || (f.category || '').toLowerCase().includes('vital')).length;
              return (
                <>
                  {meds > 0 && <span className="px-2 py-1 bg-sky-50 text-sky-800 border border-sky-200 rounded-full text-[11px] font-semibold">💊 {meds}</span>}
                  {labs > 0 && <span className="px-2 py-1 bg-violet-50 text-violet-800 border border-violet-200 rounded-full text-[11px] font-semibold">🧪 {labs}</span>}
                  {conds > 0 && <span className="px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-[11px] font-semibold">🩺 {conds}</span>}
                  {allgs > 0 && <span className="px-2 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded-full text-[11px] font-semibold">🛡️ {allgs}</span>}
                  {follow > 0 && <span className="px-2 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-full text-[11px] font-semibold">📅 {follow}</span>}
                  {diets > 0 && <span className="px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[11px] font-semibold">🥗 {diets}</span>}
                  {documents.some((d) => d.extractedText) && (
                    <button
                      type="button"
                      onClick={() => {
                        const docWithOcr = documents.find((d) => d.extractedText);
                        if (docWithOcr) {
                          setActiveOcrText(docWithOcr.extractedText);
                          setActiveDocName(docWithOcr.fileName || docWithOcr.name || 'Document');
                        }
                      }}
                      className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-black text-white rounded-full text-[11px] font-bold"
                    >
                      <FileText className="w-3 h-3 text-emerald-400" />
                      View text
                    </button>
                  )}
                </>
              );
            })()}
          </div>

          {/* Column header — desktop only, single line metaphor */}
          <div className="hidden sm:flex items-center gap-2 sm:gap-3 px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
            <span className="w-8 shrink-0"></span>
            <span className="w-16 shrink-0">Type</span>
            <span className="w-32 shrink-0">Fact</span>
            <span className="flex-1 min-w-0">Value</span>
            <span className="hidden lg:block w-56 shrink-0">Details</span>
            <span className="w-14 shrink-0 text-right">Conf</span>
            <span className="hidden md:block w-16 shrink-0 text-right">Source</span>
          </div>

          {/* Condensed list — one line per fact, scrollable, mobile optimized */}
          <div className="max-h-[50vh] sm:max-h-[520px] overflow-auto divide-y divide-slate-100 bg-white">
            {pendingFacts.map((fact) => (
              <FactApprovalCard key={fact.id} fact={fact} onResolved={loadFacts} />
            ))}
          </div>
          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>{pendingFacts.length} facts • condensed • tap row for source</span>
            <span className="hidden sm:inline">No per-row buttons — use Accept All above</span>
          </div>
        </div>
      )}

      {/* Empty pending */}
      {!isLoading && pendingFacts.length === 0 && facts.length > 0 && (
        <div className="w-full bg-white border border-emerald-200 rounded-xl p-3 flex items-center gap-2.5 shadow-sm">
          <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 shrink-0">
            <CheckCircle className="w-4 h-4" />
          </div>
          <p className="text-xs font-semibold text-slate-700">All caught up — no pending. Approved below.</p>
        </div>
      )}

      {/* 2. Approved — condensed list */}
      <div className="w-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-3 sm:px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-emerald-500 text-white rounded-lg shrink-0 hidden sm:flex">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900">Saved Records ({approvedFacts.length})</h3>
              <p className="hidden sm:block text-xs text-slate-500 leading-none">One line per fact • synced to meds/labs</p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 text-xs overflow-x-auto scrollbar-none shrink-0">
            {['all', 'lab', 'medication', 'allergy', 'condition'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1.5 rounded-md capitalize font-semibold whitespace-nowrap text-[11px] sm:text-xs ${selectedCategory === cat ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Approved header */}
        <div className="hidden sm:flex items-center gap-2 sm:gap-3 px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
          <span className="w-8 shrink-0"></span>
          <span className="w-16 shrink-0">Type</span>
          <span className="w-32 shrink-0">Fact</span>
          <span className="flex-1 min-w-0">Value</span>
          <span className="hidden lg:block w-56 shrink-0">Summary</span>
          <span className="hidden md:block w-24 shrink-0 text-right">Approved</span>
          <span className="w-14 shrink-0 text-right">Source</span>
        </div>

        {filteredApprovedFacts.length === 0 ? (
          <div className="p-6 sm:p-8 text-center bg-slate-50/50">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center mx-auto">
              <FileText className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-slate-700 mt-2">No records yet</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">Upload a PDF above. Approved facts appear here as condensed one-line rows.</p>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-full mt-2">
              <Sparkles className="w-3 h-3 text-amber-500" /> Drop PDF to start
            </span>
          </div>
        ) : (
          <div className="max-h-[50vh] sm:max-h-[600px] overflow-auto divide-y divide-slate-100 bg-white">
            {filteredApprovedFacts.map((fact) => {
              const val = typeof fact.value === 'object' ? JSON.stringify(fact.value) : String(fact.value || fact.factValue || '—');
              const shortVal = val.length > 36 ? val.slice(0, 36) + '…' : val;
              const catColor =
                (fact.category || '').toLowerCase().includes('med') ? 'bg-sky-50 text-sky-700 border-sky-200' :
                (fact.category || '').toLowerCase().includes('lab') ? 'bg-violet-50 text-violet-700 border-violet-200' :
                (fact.category || '').toLowerCase().includes('allerg') ? 'bg-rose-50 text-rose-700 border-rose-200' :
                'bg-slate-50 text-slate-600 border-slate-200';
              const shortCat = String(fact.category || 'gen').slice(0, 3).toUpperCase();
              const confidence = Math.round((fact.confidence ?? 0.92) * 100);
              return (
                <div key={fact.id} className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 hover:bg-slate-50 transition-colors min-h-[44px] text-xs sm:text-[13px] w-full overflow-hidden group">
                  <span className="shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full border flex items-center justify-center bg-white">
                    <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border flex items-center justify-center text-[10px] font-bold ${catColor}`}>{shortCat.slice(0,3)}</span>
                  </span>
                  <span className={`hidden sm:inline-flex shrink-0 text-[10px] font-bold px-1.5 py-1 rounded-full border ${catColor}`}>{shortCat}</span>
                  <span className="font-semibold text-slate-900 truncate max-w-[90px] sm:max-w-[140px] shrink-0">{fact.name || fact.factKey}</span>
                  <span className="truncate flex-1 min-w-0 text-slate-700 flex items-baseline gap-1">
                    <span className="font-medium truncate">{shortVal}</span>
                    {fact.unit && <span className="hidden sm:inline text-[11px] font-mono bg-slate-50 border border-slate-200 px-1 rounded shrink-0">{fact.unit}</span>}
                  </span>
                  <span className="hidden lg:block text-slate-500 truncate max-w-[200px] xl:max-w-[280px] shrink-0 text-[11px] sm:text-xs">
                    {(fact.plainExplanation || fact.plainNarration || '').slice(0, 60) || '—'}
                  </span>
                  <span className="hidden md:block shrink-0 text-[11px] text-slate-500 text-right w-24 truncate">
                    {fact.approvedBy || 'Patient'} • {new Date(fact.createdAt || fact.timestamp || Date.now()).toLocaleDateString()}
                  </span>
                  <span className="hidden sm:inline-flex shrink-0 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-1 rounded-full">{confidence}%</span>
                  <span className="sm:hidden shrink-0 text-[11px] font-bold text-slate-500">{confidence}%</span>
                  <button
                    onClick={() => handleHighlight(fact)}
                    className="hidden md:inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900 p-1 rounded-full hover:bg-white border border-transparent hover:border-slate-200"
                  >
                    <Eye className="w-3 h-3" />
                    <span className="hidden xl:inline">Src</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
          <span>{filteredApprovedFacts.length} saved • one line each</span>
          <span className="hidden sm:inline">Full-width • mobile: truncated, tap for source</span>
        </div>
      </div>

      {/* OCR Text Modal — keep light, full-width aware */}
      {activeOcrText && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-3 sm:px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="p-2 bg-white text-slate-700 rounded-lg border border-slate-200 shrink-0 hidden sm:flex">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 truncate">What we read</h3>
                  <p className="text-xs text-slate-500 truncate hidden sm:block">{activeDocName || 'Your paper'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(activeOcrText);
                    eventBus.dispatchToast({ type: 'success', message: 'Copied' });
                    console.log('[OCR Modal] Copied', activeOcrText.length);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold bg-white border border-slate-200 rounded-lg"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Copy</span>
                </button>
                <button type="button" onClick={() => setActiveOcrText(null)} className="p-1.5 sm:p-2 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-white border border-transparent hover:border-slate-200">
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-white p-3 sm:p-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                <div className="px-3 py-2 bg-white border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Text from your paper</span>
                  <span className="text-[11px] font-mono text-slate-500">{activeOcrText.length} chars</span>
                </div>
                <pre className="text-slate-800 font-mono text-[11px] sm:text-xs whitespace-pre-wrap leading-relaxed p-3 sm:p-4 max-h-[60vh] overflow-auto">
                  {activeOcrText}
                </pre>
              </div>
              {activeOcrText.includes('<table') && (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                  <div className="text-xs font-bold text-emerald-900 mb-2">Tables</div>
                  <div className="prose prose-sm max-w-none bg-white rounded-lg border border-emerald-200 p-3 overflow-auto text-sm" dangerouslySetInnerHTML={{ __html: activeOcrText.match(/<table[\s\S]*?<\/table>/gi)?.join('<div class="my-2"></div>') || '<p class="text-xs text-slate-500">No table HTML found.</p>' }} />
                </div>
              )}
            </div>
            <div className="px-3 sm:px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <span className="hidden sm:inline">What we read from your paper</span>
              <span className="sm:hidden">Details</span>
              <button type="button" onClick={() => setActiveOcrText(null)} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-slate-900 text-white font-semibold rounded-lg text-xs sm:text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
