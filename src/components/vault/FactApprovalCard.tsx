import React, { useState } from 'react';
import { Check, X, Edit3, Sparkles } from 'lucide-react';
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
    eventBus.highlightSourceDocument(fact.sourceDocId || fact.documentId || '');
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
      </div>

      {/* Value & Plain Narration */}
      <div className="space-y-2">
        {isEditing ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 my-1">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="px-3.5 py-2.5 bg-canvas-muted border border-primary rounded-xl text-body-sm text-slate-900 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary w-full sm:flex-1 min-h-[44px]"
              aria-label="Edit fact value"
            />
            <div className="flex items-center gap-2 justify-end w-full sm:w-auto">
              <button
                onClick={handleSaveEdit}
                disabled={loading}
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-clinical-emerald hover:brightness-95 text-white text-body-sm font-semibold rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 min-h-[44px] flex items-center justify-center"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-canvas-muted hover:bg-muted-subtle text-slate-700 text-body-sm rounded-xl border border-canvas-border transition-colors min-h-[44px] flex items-center justify-center"
              >
                Cancel
              </button>
            </div>
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

      {/* Confidence */}
      <div className="flex items-center gap-1.5 text-caption text-muted border-t border-canvas-border pt-3">
        <Sparkles className="w-3 h-3 text-amber-500" />
        <span>Confidence: {Math.round((fact.confidence || 0.95) * 100)}%</span>
      </div>

      {/* Action Bar: Approve, Edit, Reject */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-1">
        <button
          onClick={handleApprove}
          disabled={loading}
          className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-clinical-emerald hover:brightness-95 text-white rounded-xl text-body-sm font-bold transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:opacity-50 min-h-[44px]"
        >
          <Check className="w-4 h-4" />
          Approve
        </button>
        <button
          onClick={() => setIsEditing(!isEditing)}
          disabled={loading}
          className="inline-flex items-center justify-center gap-1 px-4 py-2.5 bg-canvas-muted hover:bg-muted-subtle text-slate-800 rounded-xl text-body-sm font-semibold border border-canvas-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px]"
        >
          <Edit3 className="w-4 h-4" />
          Edit
        </button>
        <button
          onClick={handleReject}
          disabled={loading}
          className="inline-flex items-center justify-center gap-1 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-body-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px]"
        >
          <X className="w-4 h-4" />
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
