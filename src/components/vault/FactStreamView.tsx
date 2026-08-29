import React, { useState, useEffect } from 'react';
import { FactEntity } from '@/types/vault';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';
import { FactApprovalCard } from './FactApprovalCard';
import { CheckCircle, ShieldAlert, Eye } from 'lucide-react';

export const FactStreamView: React.FC<{ patientId?: string }> = ({ patientId = 'patient-s-devi' }) => {
  const [facts, setFacts] = useState<FactEntity[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const loadFacts = async () => {
    const all = await localVault.getFacts(patientId);
    setFacts(all);
  };

  useEffect(() => {
    loadFacts();
    const u1 = eventBus.on('fact_extracted', loadFacts);
    const u2 = eventBus.on('fact_confirmed', loadFacts);
    return () => {
      u1();
      u2();
    };
  }, [patientId]);

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
      {/* 1. Human-in-the-Loop Trust Gate: Pending Facts Stage */}
      {pendingFacts.length > 0 && (
        <div className="bg-amber-950/30 border border-amber-500/40 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-amber-200">
                  Review what we found ({pendingFacts.length})
                </h3>
                <p className="text-xs text-amber-300/80">
                  We pulled these details from your document. Check them before they update your medicines and labs.
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-amber-400 px-3 py-1 bg-amber-900/60 rounded-full border border-amber-600/50 animate-pulse">
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

      {/* 2. Confirmed Facts Vault Stream */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Your Saved Records ({approvedFacts.length})</h3>
              <p className="text-xs text-slate-400">
                Once you approve, they update your medicines, labs, and doctor's pack automatically.
              </p>
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            {['all', 'lab', 'medication', 'allergy', 'condition'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg capitalize font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Fact Grid */}
        {filteredApprovedFacts.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs">
            No approved facts in this category yet. Ingest a document above and approve extracted facts.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredApprovedFacts.map((fact) => (
              <div
                key={fact.id}
                className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-xl p-4 space-y-2.5 transition-all text-slate-200"
              >
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {fact.category}
                  </span>
                  <button
                    onClick={() => handleHighlight(fact)}
                    className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 font-medium"
                    title="Highlight source bounding box"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Source</span>
                  </button>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-100 font-mono">
                    {fact.name || fact.factKey}: <span className="text-emerald-400 font-bold">{typeof fact.value === 'object' ? JSON.stringify(fact.value) : (fact.value || fact.factValue)}</span> {fact.unit}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{fact.plainExplanation || fact.plainNarration}</p>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
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
