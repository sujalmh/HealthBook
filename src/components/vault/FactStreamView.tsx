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
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-amber-700">
                  Review what we found ({pendingFacts.length})
                </h3>
                <p className="text-xs text-amber-700/80">
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
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-200 rounded-xl text-emerald-400">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Your Saved Records ({approvedFacts.length})</h3>
              <p className="text-xs text-slate-600">
                Once you approve, they update your medicines, labs, and doctor's pack automatically.
              </p>
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
            {['all', 'lab', 'medication', 'allergy', 'condition'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg capitalize font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-sky-500/20 text-sky-700 border border-sky-500/40'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Fact Grid */}
        {filteredApprovedFacts.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
              <CheckCircle className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-600">No records here yet.</p>
            <p className="text-[11px] text-slate-600">Add a document above and review what we find.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredApprovedFacts.map((fact) => (
              <div
                key={fact.id}
                className="bg-slate-50/70 border border-slate-200 hover:border-slate-200 rounded-xl p-4 space-y-2.5 transition-all text-slate-800"
              >
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {fact.category}
                  </span>
                  <button
                    onClick={() => handleHighlight(fact)}
                    className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-700 font-medium"
                    title="Highlight source bounding box"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Source</span>
                  </button>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-900 font-mono">
                    {fact.name || fact.factKey}: <span className="text-emerald-400 font-bold">{typeof fact.value === 'object' ? JSON.stringify(fact.value) : (fact.value || fact.factValue)}</span> {fact.unit}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{fact.plainExplanation || fact.plainNarration}</p>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-600">
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
