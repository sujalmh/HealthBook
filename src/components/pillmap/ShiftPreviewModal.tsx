/**
 * CareCanvas Component: ShiftPreviewModal
 * Animated ghost preview modal displaying chronotype-aware timing shifts with side-by-side comparison
 * and patient Approve / Reject gate.
 */

import React from 'react';
import { Clock, ArrowRight, CheckCircle2, XCircle, Sparkles, ShieldCheck, AlertCircle } from 'lucide-react';
import type { ScheduleSuggestionResult, Chronotype } from '../../types/pillmap.ts';
import { ModalPortal } from '../common/ModalPortal';

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
    <ModalPortal isOpen={true} onClose={onReject} ariaLabel="Intelligent Schedule Optimizer">
      <div className="bg-white border border-canvas-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl mx-auto">
        {/* Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-emerald-50 via-canvas-muted to-sky-50 border-b border-canvas-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-200 flex items-center justify-center text-emerald-500 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-body sm:text-lg font-black tracking-tight text-slate-900">
                Intelligent Schedule Optimizer
              </h2>
              <p className="text-caption text-emerald-600 font-semibold">
                Chronotype: {chronotypeLabels[suggestion.chronotype] || suggestion.chronotype}
              </p>
            </div>
          </div>
          <button
            onClick={onReject}
            className="p-2 rounded-xl hover:bg-canvas-muted text-muted hover:text-slate-900 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close modal"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 text-body text-slate-800">
          {/* Plain Language Summary */}
          <div className="bg-canvas-muted p-3.5 sm:p-4 rounded-2xl border border-canvas-border space-y-1.5">
            <div className="flex items-center gap-2 text-caption uppercase tracking-wider text-primary-text font-bold">
              <Clock className="w-4 h-4" /> Schedule Rationale
            </div>
            <p className="text-slate-800 leading-relaxed text-body-sm sm:text-body">
              {suggestion.plainExplanation}
            </p>
          </div>

          {/* Shifts Comparison Table */}
          <div className="space-y-2">
            <h3 className="text-caption uppercase tracking-wider text-muted font-semibold">
              Proposed Timing Adjustments ({suggestion.proposedShifts.length})
            </h3>

            {suggestion.proposedShifts.length === 0 ? (
              <div className="p-6 text-center bg-canvas-muted rounded-2xl border border-canvas-border text-muted">
                <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="font-semibold text-slate-800">Your schedule is already optimal!</p>
                <p className="text-body-sm mt-1">No timing shifts needed for your current medication combination.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {suggestion.proposedShifts.map((shift, idx) => (
                  <div
                    key={`shift_${shift.medId}_${idx}`}
                    className="p-3.5 sm:p-4 rounded-2xl bg-canvas-muted border border-canvas-border hover:border-primary-border transition-all space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <span className="font-semibold text-body sm:text-heading-md text-slate-900">
                        {shift.medName}
                      </span>
                      <div className="flex items-center gap-2 text-caption font-mono font-bold">
                        <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 uppercase">
                          {shift.fromSlot}
                        </span>
                        <ArrowRight className="w-4 h-4 text-emerald-500" />
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase shadow-sm">
                          {shift.toSlot}
                        </span>
                      </div>
                    </div>
                    <p className="text-body-sm text-slate-700 leading-relaxed bg-white p-2.5 rounded-xl border border-canvas-border">
                      💡 {shift.reason}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Gate Footer */}
        <div className="p-4 sm:p-6 bg-canvas-muted border-t border-canvas-border flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
          <button
            type="button"
            onClick={onReject}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-canvas-border hover:bg-white text-slate-700 text-body-sm font-semibold transition-colors min-h-[44px] flex items-center justify-center"
          >
            Keep Current Schedule
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={suggestion.proposedShifts.length === 0}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-body-sm font-bold shadow-sm transition-all disabled:opacity-50 min-h-[44px]"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Approve & Apply Schedule Shifts</span>
          </button>
        </div>
      </div>
    </ModalPortal>
  );
};
