/**
 * CareCanvas Component: TeachBackModal
 * Interactive teach-back prompt ("Can you tell me in your words what you'll take tomorrow morning and with food or without?")
 * validating patient comprehension before finalizing post-discharge handoff.
 */

import React, { useState } from 'react';
import {
  X,
  Bot,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  MessageSquare,
  Mic,
  Send,
  RotateCcw,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import type { TeachBackCheck, Patient3ListDischargeDataset } from '../../types/rxbridge.ts';
import { ClinicalReconciliationEngine } from '../../core/knowledge/reconciliationEngine.ts';

interface TeachBackModalProps {
  dataset: Patient3ListDischargeDataset;
  onClose: () => void;
  onVerified: (check: TeachBackCheck) => void;
}

export const TeachBackModal: React.FC<TeachBackModalProps> = ({
  dataset,
  onClose,
  onVerified
}) => {
  const [patientResponse, setPatientResponse] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [checkResult, setCheckResult] = useState<TeachBackCheck | null>(null);

  const sampleChips = [
    {
      label: 'Accurate Morning Regimen',
      text: 'I will take Levothyroxine 30-60 min before breakfast on an empty stomach with water, and Metformin 1000mg with breakfast. I will NOT take my old Lisinopril or Aspirin bottles.'
    },
    {
      label: 'Stop Med Confusion Alert',
      text: 'I will take my old Lisinopril pills from my medicine cabinet with breakfast.'
    },
    {
      label: 'New Blood Thinner & Food',
      text: 'I will take Apixaban 5mg twice daily with breakfast and dinner, and Atorvastatin 40mg at bedtime without grapefruit.'
    }
  ];

  const handleEvaluate = () => {
    if (!patientResponse.trim()) return;
    setIsEvaluating(true);

    setTimeout(() => {
      const result = ClinicalReconciliationEngine.evaluateTeachBack(patientResponse, dataset);
      setCheckResult(result);
      setIsEvaluating(false);
    }, 250);
  };

  const handleConfirmAndComplete = () => {
    if (checkResult) {
      onVerified(checkResult);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-canvas-card border border-canvas-border rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-xl space-y-5 sm:space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black text-slate-900 truncate">Teach-Back Verification</h3>
              <p className="text-xs text-slate-600 line-clamp-1">Validate understanding before discharge finalization</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors flex items-center justify-center shrink-0 min-h-[44px] min-w-[44px]"
            aria-label="Close teach-back modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Prompt Card — tokenized light */}
        <div className="p-4 sm:p-5 rounded-xl bg-primary-light border border-primary-border space-y-2.5">
          <div className="flex items-center gap-2 text-primary font-bold text-caption">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Clinical agent teach-back prompt</span>
          </div>
          <p className="text-body font-semibold text-slate-900 leading-relaxed">
            "Can you please tell me in your own words what medications you will take tomorrow morning, and whether you will take them with food or on an empty stomach?"
          </p>
        </div>

        {/* Interactive Speech & Sample Chips */}
        <div className="space-y-2">
          <label className="text-[11px] font-mono text-slate-600 uppercase tracking-wider font-bold">
            Quick-Select Simulated Response (or type below):
          </label>
          <div className="flex flex-wrap gap-2">
            {sampleChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => setPatientResponse(chip.text)}
                className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-medium transition-all text-left min-h-[38px]"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Response Input Area */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800">
              Patient / Caregiver Verbal Explanation:
            </label>
            <span className="text-[10px] text-slate-600 font-mono">
              {patientResponse.length} characters
            </span>
          </div>
          <textarea
            value={patientResponse}
            onChange={(e) => setPatientResponse(e.target.value)}
            placeholder="Type or dictate what you understand about your morning medications, food instructions, and stopped medicines..."
            rows={4}
            className="w-full p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 leading-relaxed"
          />
        </div>

        {/* Evaluate Button */}
        <div className="flex justify-end">
          <button
            onClick={handleEvaluate}
            disabled={!patientResponse.trim() || isEvaluating}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs shadow-lg transition-all min-h-[44px] ${
              !patientResponse.trim() || isEvaluating
                ? 'bg-slate-100 text-slate-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-900/40 hover:scale-[1.01]'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isEvaluating ? 'Evaluating Comprehension...' : 'Check My Understanding'}</span>
          </button>
        </div>

        {/* Evaluation Results Card */}
        {checkResult && (
          <div
            className={`p-4 sm:p-5 rounded-2xl border space-y-3 transition-all animate-fade-in ${
              checkResult.comprehensionScore === 'accurate'
                ? 'bg-emerald-50 border-emerald-800/80 text-emerald-700'
                : checkResult.comprehensionScore === 'minor_confusion'
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                {checkResult.comprehensionScore === 'accurate' ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>Accurate Understanding Confirmed</span>
                  </>
                ) : checkResult.comprehensionScore === 'minor_confusion' ? (
                  <>
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                    <span>Minor Clarification Needed</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                    <span>Critical Safety Misunderstanding Detected</span>
                  </>
                )}
              </div>

              <span
                className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full border self-start sm:self-auto ${
                  checkResult.comprehensionScore === 'accurate'
                    ? 'bg-emerald-500/20 text-emerald-700 border-emerald-200'
                    : checkResult.comprehensionScore === 'minor_confusion'
                    ? 'bg-amber-500/20 text-amber-700 border-amber-200'
                    : 'bg-rose-500/20 text-rose-700 border-rose-200'
                }`}
              >
                Score: {checkResult.comprehensionScore.replace('_', ' ')}
              </span>
            </div>

            <p className="text-xs leading-relaxed font-medium bg-slate-50/50 p-3 rounded-xl">
              {checkResult.feedbackNarration}
            </p>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleConfirmAndComplete}
                className={`w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs shadow-md transition-all min-h-[44px] ${
                  checkResult.comprehensionScore === 'accurate'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                    : 'bg-canvas-muted hover:bg-canvas-border text-muted border border-canvas-border'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Confirm Teach-Back & Complete Walk</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
