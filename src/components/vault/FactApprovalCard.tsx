import React from 'react';
import { Sparkles, Pill, FlaskConical, HeartPulse, ShieldAlert, Apple, CalendarDays, HelpCircle, AlertTriangle, FileText, Eye } from 'lucide-react';
import { FactEntity } from '@/types/vault';
import { eventBus } from '@/core/events/eventBus';

interface FactApprovalCardProps {
  fact: FactEntity;
  onResolved?: () => void;
}

export const FactApprovalCard: React.FC<FactApprovalCardProps> = ({ fact }) => {
  const handleHighlightSource = () => {
    const bbox: any = (fact as any).boundingBox || (fact as any).sourceBoundingBox || null;
    const docId = fact.sourceDocId || (fact as any).documentId || '';
    if (bbox) eventBus.highlightSourceDocument({ documentId: docId, boundingBox: bbox } as any);
    else eventBus.highlightSourceDocument(docId, bbox);
  };

  const getCategoryMeta = (category: FactEntity['category']) => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('med')) return { label: 'Med', short: 'MED', color: 'bg-sky-50 text-sky-700 border-sky-200', Icon: Pill };
    if (cat.includes('lab')) return { label: 'Lab', short: 'LAB', color: 'bg-violet-50 text-violet-700 border-violet-200', Icon: FlaskConical };
    if (cat.includes('allerg')) return { label: 'Allergy', short: 'ALG', color: 'bg-rose-50 text-rose-700 border-rose-200', Icon: ShieldAlert };
    if (cat.includes('condition') || cat.includes('diagnos')) return { label: 'Cond', short: 'DX', color: 'bg-amber-50 text-amber-700 border-amber-200', Icon: HeartPulse };
    if (cat.includes('vital')) return { label: 'Vital', short: 'VS', color: 'bg-teal-50 text-teal-700 border-teal-200', Icon: HeartPulse };
    if (cat.includes('diet')) return { label: 'Diet', short: 'DIET', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: Apple };
    if (cat.includes('follow')) return { label: 'Follow', short: 'FU', color: 'bg-blue-50 text-blue-700 border-blue-200', Icon: CalendarDays };
    if (cat.includes('due')) return { label: 'Due', short: 'DUE', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', Icon: FlaskConical };
    if (cat.includes('question')) return { label: 'Q', short: 'Q', color: 'bg-slate-50 text-slate-600 border-slate-200', Icon: HelpCircle };
    if (cat.includes('danger')) return { label: 'Safety', short: '!', color: 'bg-red-50 text-red-700 border-red-200', Icon: AlertTriangle };
    return { label: String(category || 'Clin').slice(0, 4), short: String(category || 'GEN').slice(0, 3).toUpperCase(), color: 'bg-slate-50 text-slate-600 border-slate-200', Icon: FileText };
  };

  const { short, color, Icon } = getCategoryMeta(fact.category as string);
  const confidencePct = Math.round((fact.confidence ?? 0.92) * 100);
  const displayValue = typeof fact.value === 'object' ? JSON.stringify(fact.value) : String(fact.value ?? fact.factValue ?? '');
  const displayName = fact.name || fact.factKey || 'Clinical';
  const truncatedValue = displayValue.length > 40 ? displayValue.slice(0, 40) + '…' : displayValue;
  const explanation = fact.plainExplanation || fact.plainNarration || '';
  const shortExp = explanation.length > 60 ? explanation.slice(0, 60) + '…' : explanation;

  return (
    <div className="group flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2.5 bg-white border-b border-slate-100 hover:bg-slate-50 transition-colors min-h-[48px] text-xs sm:text-[13px] w-full overflow-hidden">
      {/* Icon */}
      <span className={`shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full border flex items-center justify-center ${color}`}>
        <Icon className="w-3.5 h-3.5" />
      </span>

      {/* Category badge - hidden on very small, show short */}
      <span className={`hidden sm:inline-flex shrink-0 text-[10px] font-bold tracking-wide px-1.5 sm:px-2 py-1 rounded-full border ${color}`}>
        {short}
      </span>

      {/* Name - always visible, truncated */}
      <span className="font-semibold text-slate-900 truncate max-w-[90px] sm:max-w-[160px] md:max-w-[180px] shrink-0">
        {displayName}
      </span>

      {/* Value + unit - primary data, truncate, always visible but flex */}
      <span className="text-slate-700 truncate flex-1 min-w-0 flex items-baseline gap-1">
        <span className="font-medium truncate">{truncatedValue || '—'}</span>
        {fact.unit && <span className="hidden sm:inline text-[11px] text-slate-500 font-mono border border-slate-200 bg-slate-50 px-1 rounded shrink-0">{fact.unit}</span>}
      </span>

      {/* Explanation - hidden on mobile, visible lg */}
      {shortExp && (
        <span className="hidden lg:block text-slate-500 truncate max-w-[220px] xl:max-w-[320px] shrink-0">
          {shortExp}
        </span>
      )}

      {/* Confidence - always visible, compact */}
      <span className="hidden sm:inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-1.5 sm:px-2 py-1 rounded-full">
        <Sparkles className="w-3 h-3 text-amber-500 hidden sm:block" />
        {confidencePct}%
      </span>
      {/* Mobile confidence just number */}
      <span className="sm:hidden shrink-0 text-[11px] font-bold text-slate-500">{confidencePct}%</span>

      {/* Source button - desktop only */}
      {(fact.sourceDocId || fact.documentId) && (
        <button
          type="button"
          onClick={handleHighlightSource}
          className="hidden md:inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900 px-2 py-1 rounded-full hover:bg-white border border-transparent hover:border-slate-200 transition-colors"
          title="View source document"
        >
          <Eye className="w-3 h-3" />
          <span className="hidden xl:inline">Source</span>
        </button>
      )}
    </div>
  );
};
