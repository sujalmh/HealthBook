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
  const calculateDaysRemaining = (dueDateStr: string): number => {
    const due = new Date(dueDateStr).getTime();
    const now = Date.now();
    return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  };

  if (dueCards.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-100">All caught up!</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            No tests waiting — you're up to date. When your doctor asks for a new test, it will appear here.
          </p>
        </div>
        <button
          onClick={() => onUploadClick()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
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
          <Calendar className="w-5 h-5 text-sky-400" />
          <h3 className="text-base font-bold text-slate-100">Your Tests</h3>
        </div>
        <span className="text-xs text-slate-400">
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
              className={`relative overflow-hidden rounded-3xl border p-5 transition-all shadow-lg ${
                isCompleted
                  ? 'bg-slate-900/40 border-emerald-500/20 opacity-80'
                  : isOverdue
                  ? 'bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-900 border-rose-500/40 shadow-rose-500/5'
                  : isUrgent
                  ? 'bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border-amber-500/40 shadow-amber-500/5'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Status Header Badge */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                      Prescribed Lab
                    </span>
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        Completed
                      </span>
                    ) : isOverdue ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/40 animate-pulse">
                        <AlertTriangle className="w-3 h-3" />
                        OVERDUE ({Math.abs(daysRemaining)}d ago)
                      </span>
                    ) : isUrgent ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/40">
                        <Clock className="w-3 h-3" />
                        DUE IN {daysRemaining === 0 ? 'TODAY' : `${daysRemaining} DAYS`}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 text-[10px] font-bold border border-sky-500/30">
                        <Clock className="w-3 h-3" />
                        Due in {daysRemaining} days
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-slate-100">{card.testPanel}</h4>
                </div>

                <div className="text-right">
                  <span className="text-xs font-semibold text-slate-300">
                    {new Date(card.dueDate).toLocaleDateString(undefined, {
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
                        className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                )}

                {card.instructions && (
                  <div className="flex items-start gap-1.5 text-xs text-slate-400 bg-slate-950/60 rounded-xl p-2.5 border border-slate-800/80">
                    <Info className="w-3.5 h-3.5 text-sky-400 mt-0.5 shrink-0" />
                    <span>{card.instructions}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    Prescribed by {card.prescribedBy || 'Dr. Anita Patel, MD'}
                  </span>
                  <span>Prescribed: {new Date(card.prescribedDate).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                {!isCompleted ? (
                  <>
                    <button
                      onClick={() => onUploadClick(card.id)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-md shadow-sky-600/20"
                    >
                      <UploadCloud className="w-4 h-4" />
                      <span>Upload Result Slip</span>
                    </button>
                    {onCompleteCard && (
                      <button
                        onClick={() => onCompleteCard(card.id)}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
                        title="Mark as completed"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      </button>
                    )}
                  </>
                ) : (
                  <div className="w-full flex items-center justify-between text-xs text-emerald-400 bg-emerald-500/10 rounded-xl px-3 py-2 border border-emerald-500/20">
                    <span className="flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      Lab slip ingested & verified in LabStory
                    </span>
                    <span className="text-[11px] text-slate-400">Linked to chart</span>
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
