import React, { useState, useEffect } from 'react';
import { FactEntity } from '@/types/vault';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';
import { FactApprovalCard } from './FactApprovalCard';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { CheckCircle, ShieldAlert, Eye, FileText, Sparkles } from 'lucide-react';

export const FactStreamView: React.FC<{ patientId?: string }> = ({ patientId }) => {
  const [facts, setFacts] = useState<FactEntity[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Resolve real patientId from prop or authenticated session (no hardcoded fallback)
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
      setIsLoading(false);
      return;
    }
    const all = await localVault.getFacts(effectivePatientId);
    setFacts(all);
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
    <div className="space-y-6 animate-fade-in">
      {/* Loading skeletons */}
      {isLoading && (
        <div className="bg-canvas-card border border-canvas-border rounded-2xl p-6 shadow-sm space-y-4">
          <div className="h-5 w-1/3 bg-canvas-muted rounded animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-32 bg-canvas-muted rounded-xl animate-pulse" />
            <div className="h-32 bg-canvas-muted rounded-xl animate-pulse" />
          </div>
        </div>
      )}

      {/* 1. Human-in-the-Loop Trust Gate: Unified Document Review & Batch Accept/Reject */}
      {!isLoading && pendingFacts.length > 0 && (
        <div className="bg-gradient-to-br from-amber-50/90 via-white to-amber-50/40 border-2 border-amber-300/80 rounded-2xl p-6 shadow-md space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-amber-200/60 pb-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-amber-100 border border-amber-300/80 rounded-2xl text-amber-800 shrink-0 shadow-sm">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-heading-md font-bold text-amber-950 tracking-tight">
                    Document Extracted ({pendingFacts.length} Items)
                  </h3>
                  <span className="text-caption font-bold text-amber-900 bg-amber-200/70 px-2.5 py-0.5 rounded-full border border-amber-300">
                    Awaiting 1-Click Confirmation
                  </span>
                </div>
                <p className="text-body-sm text-amber-900/80 leading-relaxed mt-0.5">
                  AI extracted all health data from your document. Confirm once to fill your medicines, lab charts, diagnoses, and doctor's pack across the website.
                </p>
              </div>
            </div>

            {/* Master Accept All / Reject All Action Buttons */}
            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <button
                onClick={async () => {
                  try {
                    await webMCPEngine.execute('confirm_fact', { factId: 'all', action: 'reject' });
                    eventBus.dispatchToast({
                      type: 'info',
                      message: `Rejected all ${pendingFacts.length} extracted items.`,
                    });
                    loadFacts();
                  } catch (e: any) {
                    eventBus.dispatchToast({ type: 'error', message: e?.message || 'Rejection failed' });
                  }
                }}
                className="px-4 py-2.5 text-body-sm font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-all shadow-sm hover:shadow active:scale-98 flex items-center gap-2 min-h-[44px]"
              >
                <ShieldAlert className="w-4 h-4 text-slate-500" />
                <span>Reject All</span>
              </button>

              <button
                onClick={async () => {
                  try {
                    await webMCPEngine.execute('confirm_fact', { factId: 'all', action: 'approve' });
                    eventBus.dispatchToast({
                      type: 'success',
                      message: `Successfully approved all ${pendingFacts.length} items! Medicines, labs, and health summaries are now populated.`,
                    });
                    loadFacts();
                  } catch (e: any) {
                    eventBus.dispatchToast({ type: 'error', message: e?.message || 'Approval failed' });
                  }
                }}
                className="px-6 py-2.5 text-body-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-98 flex items-center gap-2 min-h-[44px]"
              >
                <CheckCircle className="w-5 h-5" />
                <span>Accept All & Populate Website</span>
              </button>
            </div>
          </div>

          {/* Categorical Breakdown Badges */}
          <div className="flex items-center gap-2 flex-wrap text-caption font-semibold">
            {(() => {
              const meds = pendingFacts.filter(f => f.category.includes('med')).length;
              const labs = pendingFacts.filter(f => f.category.includes('lab')).length;
              const conds = pendingFacts.filter(f => f.category.includes('cond') || f.category.includes('diagnos')).length;
              const allgs = pendingFacts.filter(f => f.category.includes('allerg')).length;
              const follow = pendingFacts.filter(f => f.category.includes('follow') || f.category.includes('due')).length;
              const diets = pendingFacts.filter(f => f.category.includes('diet') || f.category.includes('vital')).length;

              return (
                <>
                  {meds > 0 && (
                    <span className="px-3 py-1 bg-primary-light text-primary-text border border-primary-border rounded-full">
                      💊 {meds} Medicines
                    </span>
                  )}
                  {labs > 0 && (
                    <span className="px-3 py-1 bg-purple-50 text-purple-800 border border-purple-200 rounded-full">
                      🧪 {labs} Lab Tests
                    </span>
                  )}
                  {conds > 0 && (
                    <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full">
                      🩺 {conds} Diagnoses
                    </span>
                  )}
                  {allgs > 0 && (
                    <span className="px-3 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded-full">
                      🛡️ {allgs} Allergies
                    </span>
                  )}
                  {follow > 0 && (
                    <span className="px-3 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-full">
                      📅 {follow} Follow-ups & Due Labs
                    </span>
                  )}
                  {diets > 0 && (
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full">
                      🥗 {diets} Diet & Vitals
                    </span>
                  )}
                </>
              );
            })()}
          </div>

          {/* Itemized Review List */}
          <div className="space-y-3 pt-2">
            <h4 className="text-body-sm font-bold text-slate-800">Itemized Extracted Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {pendingFacts.map((fact) => (
                <FactApprovalCard key={fact.id} fact={fact} onResolved={loadFacts} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty pending state — helpful when no pending but also not loading */}
      {!isLoading && pendingFacts.length === 0 && facts.length > 0 && (
        <div className="bg-canvas-card border border-canvas-border rounded-2xl p-4 flex items-center gap-3 shadow-sm">
          <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <p className="text-body-sm text-muted">
            All caught up — no pending reviews. Your approved records are below.
          </p>
        </div>
      )}

      {/* 2. Confirmed Facts Vault Stream */}
      <div className="bg-canvas-card border border-canvas-border rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-canvas-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 shrink-0">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-heading-md font-bold text-slate-900 tracking-tight">Your Saved Records ({approvedFacts.length})</h3>
              <p className="text-body-sm text-muted leading-relaxed">
                Once you approve, they update your medicines, labs, and doctor's pack automatically.
              </p>
            </div>
          </div>

          {/* Category Filter — pill tokenized */}
          <div className="flex items-center gap-1.5 bg-canvas-muted p-1 rounded-xl border border-canvas-border text-body-sm overflow-x-auto scrollbar-none max-w-full shrink-0">
            {['all', 'lab', 'medication', 'allergy', 'condition'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-2 rounded-lg capitalize font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary whitespace-nowrap min-h-[36px] ${
                  selectedCategory === cat
                    ? 'bg-primary-light text-primary-text border border-primary-border shadow-sm'
                    : 'text-muted hover:text-slate-900 hover:bg-white border border-transparent'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Fact Grid */}
        {filteredApprovedFacts.length === 0 ? (
          <div className="p-8 text-center bg-canvas-muted rounded-xl border border-dashed border-canvas-border space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-primary-light border border-primary-border text-primary flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <h4 className="text-heading-md font-bold text-slate-900">No records here yet</h4>
            <p className="text-body-sm text-muted max-w-sm mx-auto leading-relaxed">
              Add a document above. Approved facts appear here as cards and sync to other modules.
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 text-caption font-semibold text-primary bg-primary-light border border-primary-border px-3 py-1 rounded-full">
                <Sparkles className="w-3 h-3" /> Drop a PDF to get started
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredApprovedFacts.map((fact) => (
              <div
                key={fact.id}
                className="bg-canvas-card border border-canvas-border hover:border-primary-border/30 rounded-xl p-4 space-y-2.5 transition-all shadow-sm hover:shadow-md text-slate-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-caption font-bold uppercase px-2 py-0.5 rounded-full bg-muted-subtle text-muted border border-canvas-border">
                    {fact.category}
                  </span>
                  <button
                    onClick={() => handleHighlight(fact)}
                    className="inline-flex items-center gap-1 text-caption text-primary hover:text-primary-hover font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full px-2 py-1 hover:bg-primary-light transition-colors"
                    title="Highlight source"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Source</span>
                  </button>
                </div>

                <div>
                  <div className="text-body-sm font-semibold text-slate-900 font-mono tracking-tight line-clamp-2">
                    {fact.name || fact.factKey}: <span className="text-clinical-emerald font-bold">{typeof fact.value === 'object' ? JSON.stringify(fact.value) : (fact.value || fact.factValue)}</span> {fact.unit}
                  </div>
                  <p className="text-body-sm text-muted mt-1 leading-relaxed line-clamp-2">{(fact.plainExplanation || fact.plainNarration || '').split('.')[0] ? (fact.plainExplanation || fact.plainNarration || '').split('.')[0] + '.' : ''}</p>
                </div>

                <div className="pt-2 border-t border-canvas-border flex items-center justify-between text-caption text-muted">
                  <span>Approved by {fact.approvedBy || 'Patient'}</span>
                  <span>{new Date(fact.createdAt || fact.timestamp || Date.now()).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
