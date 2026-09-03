import React from 'react';
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  UploadCloud,
  FileText,
  User,
  Info,
  ChevronRight
} from 'lucide-react';
import type { DueCardRecord } from '@/types/vault';

interface DueCardListProps {
  dueCards: DueCardRecord[];
  onUploadClick: (cardId?: string) => void;
  onCompleteCard?: (cardId: string) => void;
}

export const DueCardList: React.FC<DueCardListProps> = ({
  dueCards,
  onUploadClick,
  onCompleteCard
}) => {
  const parseDueDate = (dueDateStr: string): Date => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dueDateStr)) return new Date(dueDateStr + 'T12:00:00');
    return new Date(dueDateStr);
  };
  const calculateDaysRemaining = (dueDateStr: string): number => {
    const due = parseDueDate(dueDateStr).getTime();
    const now = Date.now();
    return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  };

  if (dueCards.length === 0) {
    return (
      <div className="bg-white border border-canvas-border rounded-2xl p-8 text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-heading-md text-slate-900">All caught up!</h3>
          <p className="text-body-sm text-muted max-w-md mx-auto">
            No tests waiting — you're up to date. When your doctor asks for a new test, it will appear here.
          </p>
        </div>
        <button
          onClick={() => onUploadClick()}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white hover:bg-canvas-muted text-slate-700 border border-canvas-border text-body-sm font-semibold transition-colors min-h-[44px]"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload a result</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h3 className="text-heading-md text-slate-900">Your Tests</h3>
        </div>
        <span className="text-body-sm text-muted">
          {dueCards.filter((c) => c.status !== 'completed').length} waiting
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {dueCards.map((card) => {
          const daysRemaining = calculateDaysRemaining(card.dueDate);
          const isCompleted = card.status === 'completed';
          const isOverdue = !isCompleted && (card.status === 'overdue' || daysRemaining < 0);
          const isUrgent = !isCompleted && !isOverdue && daysRemaining <= 3;

          return (
            <div
              key={card.id}
              className={`relative overflow-hidden rounded-2xl border p-5 transition-all shadow-sm ${
                isCompleted
                  ? 'bg-canvas-muted border-emerald-200 opacity-80'
                  : isOverdue
                  ? 'bg-rose-50 border-rose-200'
                  : isUrgent
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-white border-canvas-border hover:border-primary-border hover:shadow-md'
              }`}
            >
              {/* Status Header Badge */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-caption font-mono text-muted uppercase tracking-wider">
                      Prescribed Lab
                    </span>
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-caption font-semibold border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        Completed
                      </span>
                    ) : isOverdue ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-caption font-semibold border border-rose-200">
                        <AlertTriangle className="w-3 h-3" />
                        OVERDUE ({Math.abs(daysRemaining)}d ago)
                      </span>
                    ) : isUrgent ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-caption font-semibold border border-amber-200">
                        <Clock className="w-3 h-3" />
                        DUE IN {daysRemaining === 0 ? 'TODAY' : `${daysRemaining} DAYS`}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-light text-primary-text text-caption font-semibold border border-primary-border">
                        <Clock className="w-3 h-3" />
                        Due in {daysRemaining} days
                      </span>
                    )}
                  </div>
                  <h4 className="text-body font-semibold text-slate-900">{card.testPanel}</h4>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-body-sm font-medium text-muted whitespace-nowrap">
                    {parseDueDate(card.dueDate).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              </div>

              {/* Biomarkers / Instructions */}
              <div className="space-y-2 mb-4">
                {card.biomarkers && card.biomarkers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {card.biomarkers.map((m) => (
                      <span
                        key={m}
                        className="text-caption font-medium px-2 py-0.5 rounded-md bg-canvas-muted text-slate-700 border border-canvas-border"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                )}

                {card.instructions && (
                  <div className="flex items-start gap-1.5 text-body-sm text-muted bg-white rounded-xl p-2.5 border border-canvas-border">
                    <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                    <span>{card.instructions}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-caption text-muted pt-1 gap-2">
                  <span className="flex items-center gap-1 min-w-0 truncate">
                    <User className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Prescribed by {(card.prescribedBy || '').trim() || 'Your doctor'}</span>
                  </span>
                  <span>Prescribed: {parseDueDate(card.prescribedDate).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-3 border-t border-canvas-border">
                {!isCompleted ? (
                  <>
                    <button
                      onClick={() => onUploadClick(card.id)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-body-sm font-bold transition-all shadow-sm min-h-[44px]"
                    >
                      <UploadCloud className="w-4 h-4" />
                      <span>Upload Result Slip</span>
                    </button>
                    {onCompleteCard && (
                      <button
                        onClick={() => onCompleteCard(card.id)}
                        className="px-3 py-2.5 rounded-xl bg-white hover:bg-canvas-muted text-slate-700 text-body-sm font-semibold border border-canvas-border transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="Mark as completed"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      </button>
                    )}
                  </>
                ) : (
                  <div className="w-full flex items-center justify-between text-body-sm text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2 border border-emerald-200">
                    <span className="flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      Lab slip ingested & verified in LabStory
                    </span>
                    <span className="text-caption text-muted">Linked to chart</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
