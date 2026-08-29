/**
 * CareCanvas Component: ShiftPreviewModal
 * Animated ghost preview modal displaying chronotype-aware timing shifts with side-by-side comparison
 * and patient Approve / Reject gate.
 */

import React from 'react';
import { Clock, ArrowRight, CheckCircle2, XCircle, Sparkles, ShieldCheck, AlertCircle } from 'lucide-react';
import type { ScheduleSuggestionResult, Chronotype } from '../../types/pillmap.ts';

export interface ShiftPreviewModalProps {
  suggestion: ScheduleSuggestionResult;
  onApprove: () => void;
  onReject: () => void;
}

export const ShiftPreviewModal: React.FC<ShiftPreviewModalProps> = ({
  suggestion,
  onApprove,
  onReject
}) => {
  const chronotypeLabels: Record<Chronotype, string> = {
    early_bird: 'Early Lark 🌅',
    standard: 'Standard ☀️',
    night_owl: 'Night Owl 🌙'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-sky-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white">
                Intelligent Schedule Optimizer
              </h2>
              <p className="text-xs text-emerald-400 font-semibold">
                Chronotype: {chronotypeLabels[suggestion.chronotype] || suggestion.chronotype}
              </p>
            </div>
          </div>
          <button
            onClick={onReject}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 text-sm text-slate-200">
          {/* Plain Language Summary */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-wider">
              <Clock className="w-4 h-4" /> Schedule Rationale
            </div>
            <p className="text-slate-200 leading-relaxed">
              {suggestion.plainExplanation}
            </p>
          </div>

          {/* Shifts Comparison Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Proposed Timing Adjustments ({suggestion.proposedShifts.length})
            </h3>

            {suggestion.proposedShifts.length === 0 ? (
              <div className="p-6 text-center bg-slate-950/40 rounded-2xl border border-slate-800 text-slate-400">
                <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="font-semibold text-slate-200">Your schedule is already optimal!</p>
                <p className="text-xs mt-1">No timing shifts needed for your current medication combination.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {suggestion.proposedShifts.map((shift, idx) => (
                  <div
                    key={`shift_${shift.medId}_${idx}`}
                    className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 hover:border-slate-700 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white text-sm">
                        {shift.medName}
                      </span>
                      <div className="flex items-center gap-2 text-xs font-mono font-bold">
                        <span className="px-2.5 py-1 rounded-lg bg-rose-950/60 text-rose-300 border border-rose-800/60 uppercase">
                          {shift.fromSlot}
                        </span>
                        <ArrowRight className="w-4 h-4 text-emerald-400" />
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-600/80 uppercase shadow-sm">
                          {shift.toSlot}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
                      💡 {shift.reason}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Gate Footer */}
        <div className="p-6 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onReject}
            className="px-5 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-colors"
          >
            Keep Current Schedule
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={suggestion.proposedShifts.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold shadow-lg shadow-emerald-900/30 transition-all disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Approve & Apply Schedule Shifts</span>
          </button>
        </div>
      </div>
    </div>
  );
};
