import React, { useState } from 'react';
import { Check, X, Edit3, Eye, Sparkles } from 'lucide-react';
import { FactEntity } from '@/types/vault';
import { eventBus } from '@/core/events/eventBus';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';

interface FactApprovalCardProps {
  fact: FactEntity;
  onResolved?: () => void;
}

export const FactApprovalCard: React.FC<FactApprovalCardProps> = ({ fact, onResolved }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(fact.factValue ?? fact.value ?? ''));
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
        return 'bg-primary-light text-primary-text border-primary-border';
      case 'lab':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'allergy':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'condition':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  return (
    <div className="bg-canvas-card border border-canvas-border hover:border-primary-border/30 rounded-2xl p-4 shadow-sm hover:shadow-md space-y-3 text-slate-900 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-caption uppercase font-bold px-2 py-0.5 rounded-full border ${getCategoryColor(fact.category)}`}>
            {fact.category}
          </span>
          <span className="text-body-sm font-semibold text-slate-900 font-mono tracking-tight">{fact.name || fact.factKey}</span>
        </div>
        <button
          onClick={handleHighlightSource}
          className="inline-flex items-center gap-1 text-caption text-primary hover:text-primary-hover font-semibold px-2 py-1 rounded-full bg-primary-light border border-primary-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shrink-0 min-h-[28px]"
          title="Highlight original bounding box on document"
        >
          <Eye className="w-3 h-3" />
          <span>View Source</span>
        </button>
      </div>

      {/* Value & Plain Narration */}
      <div className="space-y-2">
        {isEditing ? (
          <div className="flex items-center gap-2 my-1">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="px-3 py-2 bg-canvas-muted border border-primary rounded-xl text-body-sm text-slate-900 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary flex-1 min-h-[40px]"
              aria-label="Edit fact value"
            />
            <button
              onClick={handleSaveEdit}
              disabled={loading}
              className="px-3 py-2 bg-clinical-emerald hover:brightness-95 text-white text-body-sm font-semibold rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 min-h-[40px]"
            >
              Save
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-2 bg-canvas-muted hover:bg-muted-subtle text-slate-700 text-body-sm rounded-xl border border-canvas-border transition-colors min-h-[40px]"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="text-body font-semibold text-slate-900 flex items-baseline gap-1.5 flex-wrap">
            <span className="text-muted text-body-sm">{fact.name || fact.factKey}:</span>
            <span className="text-primary-text font-bold">{typeof fact.value === 'object' ? JSON.stringify(fact.value) : (fact.value || fact.factValue)}</span>
            {fact.unit && <span className="text-body-sm text-muted font-normal">{fact.unit}</span>}
          </div>
        )}
        <p className="text-body-sm text-muted leading-relaxed">{fact.plainExplanation || fact.plainNarration}</p>
      </div>

      {/* Confidence & Source Snippet */}
      <div className="flex items-center justify-between gap-2 text-caption text-muted border-t border-canvas-border pt-3">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>Confidence: {Math.round((fact.confidence || 0.95) * 100)}%</span>
        </div>
        <div className="font-mono text-muted truncate max-w-[180px] hidden sm:block">
          "{fact.sourceBoundingBox?.textSnippet || fact.boundingBox?.textSnippet || 'source snippet'}"
        </div>
      </div>

      {/* Action Bar: Approve, Edit, Reject */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleApprove}
          disabled={loading}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-clinical-emerald hover:brightness-95 text-white rounded-xl text-body-sm font-bold transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:opacity-50 min-h-[44px]"
        >
          <Check className="w-3.5 h-3.5" />
          Approve
        </button>
        <button
          onClick={() => setIsEditing(!isEditing)}
          disabled={loading}
          className="inline-flex items-center justify-center gap-1 px-4 py-2.5 bg-canvas-muted hover:bg-muted-subtle text-slate-800 rounded-xl text-body-sm font-semibold border border-canvas-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px]"
        >
          <Edit3 className="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          onClick={handleReject}
          disabled={loading}
          className="inline-flex items-center justify-center gap-1 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-body-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px]"
        >
          <X className="w-3.5 h-3.5" />
          Reject
        </button>
      </div>
      {loading && (
        <div className="h-1 w-full bg-canvas-muted rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-primary animate-pulse rounded-full" />
        </div>
      )}
    </div>
  );
};
