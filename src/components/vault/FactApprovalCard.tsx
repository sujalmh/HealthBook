import React, { useState } from 'react';
import { Check, X, Edit3, Eye, FileText, Sparkles, AlertCircle } from 'lucide-react';
import { FactEntity } from '@/types/vault';
import { eventBus } from '@/core/events/eventBus';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';

interface FactApprovalCardProps {
  fact: FactEntity;
  onResolved?: () => void;
}

export const FactApprovalCard: React.FC<FactApprovalCardProps> = ({ fact, onResolved }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(fact.factValue));
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    try {
      await webMCPEngine.execute('confirm_fact', {
        factId: fact.id,
        action: 'approve',
      });
      if (onResolved) onResolved();
    } catch (err: any) {
      eventBus.dispatchToast({
        type: 'error',
        message: err?.message || 'Approval failed',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    setLoading(true);
    try {
      await webMCPEngine.execute('confirm_fact', {
        factId: fact.id,
        action: 'edit',
        editedValue: editValue,
      });
      setIsEditing(false);
      if (onResolved) onResolved();
    } catch (err: any) {
      eventBus.dispatchToast({
        type: 'error',
        message: err?.message || 'Edit failed',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await webMCPEngine.execute('confirm_fact', {
        factId: fact.id,
        action: 'reject',
      });
      if (onResolved) onResolved();
    } catch (err: any) {
      eventBus.dispatchToast({
        type: 'error',
        message: err?.message || 'Rejection failed',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleHighlightSource = () => {
    eventBus.highlightSourceDocument({
      documentId: fact.sourceDocId || fact.documentId || '',
      boundingBox: fact.sourceBoundingBox || fact.boundingBox,
    });
  };

  const getCategoryColor = (category: FactEntity['category']) => {
    switch (category) {
      case 'medication':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'lab':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'allergy':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'condition':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-700 hover:border-slate-600 rounded-xl p-4 shadow-lg space-y-3 text-slate-200 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${getCategoryColor(fact.category)}`}>
            {fact.category}
          </span>
          <span className="text-xs font-semibold text-slate-300 font-mono">{fact.name || fact.factKey}</span>
        </div>
        <button
          onClick={handleHighlightSource}
          className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 hover:underline px-2 py-0.5 rounded bg-sky-950/60 border border-sky-500/30 transition-colors"
          title="Highlight original bounding box on document"
        >
          <Eye className="w-3 h-3" />
          <span>View Source</span>
        </button>
      </div>

      {/* Value & Plain Narration */}
      <div>
        {isEditing ? (
          <div className="flex items-center gap-2 my-2">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="px-2.5 py-1 bg-slate-950 border border-sky-500 rounded text-sm text-slate-100 focus:outline-none flex-1"
            />
            <button
              onClick={handleSaveEdit}
              disabled={loading}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded"
            >
              Save
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="text-sm font-semibold text-slate-100 flex items-baseline gap-1.5">
            <span>{fact.name || fact.factKey}:</span>
            <span className="text-sky-300">{typeof fact.value === 'object' ? JSON.stringify(fact.value) : (fact.value || fact.factValue)}</span>
            {fact.unit && <span className="text-xs text-slate-400 font-normal">{fact.unit}</span>}
          </div>
        )}
        <p className="text-xs text-slate-300 mt-1 leading-relaxed">{fact.plainExplanation || fact.plainNarration}</p>
      </div>

      {/* Confidence & Source Snippet */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/80 pt-2.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>Confidence: {Math.round((fact.confidence || 0.95) * 100)}%</span>
        </div>
        <div className="font-mono text-slate-500 truncate max-w-[200px]">
          "{fact.sourceBoundingBox?.textSnippet || fact.boundingBox?.textSnippet || 'source snippet'}"
        </div>
      </div>

      {/* Action Bar: Approve, Edit, Reject */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleApprove}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors shadow disabled:opacity-50"
        >
          <Check className="w-3.5 h-3.5" />
          Approve
        </button>
        <button
          onClick={() => setIsEditing(!isEditing)}
          disabled={loading}
          className="flex items-center justify-center gap-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
        >
          <Edit3 className="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          onClick={handleReject}
          disabled={loading}
          className="flex items-center justify-center gap-1 px-3 py-2 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/50 rounded-lg text-xs font-medium transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Reject
        </button>
      </div>
    </div>
  );
};
