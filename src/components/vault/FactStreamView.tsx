import React, { useState, useEffect } from 'react';
import { FactEntity } from '@/types/vault';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';
import { FactApprovalCard } from './FactApprovalCard';
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
    eventBus.highlightSourceDocument({
      documentId: (fact.sourceDocId || fact.documentId || '') as string,
      boundingBox: fact.sourceBoundingBox || fact.boundingBox,
    });
  };

  return (
    <div className="space-y-6">
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

      {/* 1. Human-in-the-Loop Trust Gate: Pending Facts Stage */}
      {!isLoading && pendingFacts.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 border border-amber-200 rounded-xl text-amber-700 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-heading-md font-bold text-amber-900 tracking-tight">
                  Review extracted details ({pendingFacts.length})
                </h3>
                <p className="text-body-sm text-amber-800/80 leading-relaxed">
                  Details extracted from your document. Check before they update medicines and labs.
                </p>
              </div>
            </div>
            <span className="text-caption font-bold text-amber-800 px-3 py-1 bg-amber-100 rounded-full border border-amber-200 animate-pulse-subtle shrink-0">
              Needs your okay
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingFacts.map((fact) => (
              <FactApprovalCard key={fact.id} fact={fact} onResolved={loadFacts} />
            ))}
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
          <div className="flex items-center gap-2 bg-canvas-muted p-1 rounded-xl border border-canvas-border text-body-sm overflow-x-auto scrollbar-none shrink-0">
            {['all', 'lab', 'medication', 'allergy', 'condition'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg capitalize font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary whitespace-nowrap min-h-[32px] ${
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
                    title="Highlight source bounding box"
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
