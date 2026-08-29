/**
 * CareCanvas Component: ReconciliationWalk
 * Step-by-step conversational med-by-med walkthrough wizard displaying
 * plain-language explanations, interaction badges, and per-med Approve/Edit actions.
 */

import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  HelpCircle,
  ShieldAlert,
  Utensils,
  Sparkles,
  Bot,
  MessageSquare,
  ArrowRight,
  Info,
  Clock,
  Check,
  AlertTriangle
} from 'lucide-react';
import type { ReconciledMedChangeItem } from '../../types/rxbridge.ts';
import { ChangeBadge } from './ChangeBadge.tsx';

interface ReconciliationWalkProps {
  items: ReconciledMedChangeItem[];
  currentIndex: number;
  onNavigateIndex: (index: number) => void;
  onApproveMed: (medId: string) => void;
  onAskDoctor: (medName: string, context: string) => void;
  onUpdateNote: (medId: string, note: string) => void;
  onFinishWalk: () => void;
  onOpenTeachBack: () => void;
}

export const ReconciliationWalk: React.FC<ReconciliationWalkProps> = ({
  items,
  currentIndex,
  onNavigateIndex,
  onApproveMed,
  onAskDoctor,
  onUpdateNote,
  onFinishWalk,
  onOpenTeachBack
}) => {
  const currentItem = items[currentIndex] || items[0];
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [patientNote, setPatientNote] = useState(currentItem?.patientComment || '');

  if (!currentItem) {
    return <div className="text-center py-12 text-slate-600">No medications to reconcile.</div>;
  }

  const isApproved = currentItem.isApprovedByPatient;
  const totalApproved = items.filter((i) => i.isApprovedByPatient).length;
  const progressPercent = Math.round((totalApproved / items.length) * 100);

  const handleNext = () => {
    if (currentIndex < items.length - 1) {
      onNavigateIndex(currentIndex + 1);
      setShowNoteInput(false);
      setPatientNote(items[currentIndex + 1]?.patientComment || '');
    } else {
      onFinishWalk();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      onNavigateIndex(currentIndex - 1);
      setShowNoteInput(false);
      setPatientNote(items[currentIndex - 1]?.patientComment || '');
    }
  };

  const handleSaveNote = () => {
    onUpdateNote(currentItem.medId, patientNote);
    setShowNoteInput(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-6">
      {/* Top Stepper & Navigation Header */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-700 font-mono font-bold text-xs border border-sky-500/40">
                Step {currentIndex + 1} of {items.length}
              </span>
              <h3 className="text-lg font-black text-slate-900">Conversational Medication Walkthrough</h3>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Review each medication change one-by-one with clear clinical explanations before confirming your home schedule.
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-200 text-xs">
            <div className="text-right">
              <div className="font-bold text-white">
                {totalApproved}/{items.length} Approved
              </div>
              <div className="text-[10px] text-slate-600 font-mono">{progressPercent}% Completed</div>
            </div>
            <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stepper Pills Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 pt-1">
          {items.map((item, idx) => {
            const isCurrent = idx === currentIndex;
            return (
              <button
                key={item.medId}
                onClick={() => {
                  onNavigateIndex(idx);
                  setShowNoteInput(false);
                  setPatientNote(item.patientComment || '');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isCurrent
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30 ring-2 ring-sky-400'
                    : item.isApprovedByPatient
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-900/40'
                    : 'bg-slate-50 text-slate-600 hover:text-slate-800 border border-slate-200'
                }`}
              >
                {item.isApprovedByPatient ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full bg-slate-700 text-[9px] flex items-center justify-center font-mono">
                    {idx + 1}
                  </span>
                )}
                <span>{item.medName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Walkthrough Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-6 shadow-inner">
        {/* Medication Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-black tracking-tight text-slate-900">{currentItem.medName}</h2>
              <ChangeBadge status={currentItem.statusBadge} size="md" />
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-600 font-mono">
              <span>Generic Chemical: <strong className="text-slate-800">{currentItem.genericName}</strong></span>
              {currentItem.isOTC && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 font-bold border border-amber-200">
                  Over-The-Counter
                </span>
              )}
            </div>
          </div>

          {/* Timing & Food Tag */}
          {currentItem.timingSlots && currentItem.timingSlots.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 bg-white px-3.5 py-2 rounded-2xl border border-slate-200 text-xs">
              <Clock className="w-4 h-4 text-sky-400 shrink-0" />
              <span className="font-semibold text-slate-700">
                Take: <strong className="text-white capitalize">{currentItem.timingSlots.join(', ')}</strong>
              </span>
            </div>
          )}
        </div>

        {/* 3-List Comparative Visual Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* 1. Pre-Admission (Home) */}
          <div className="p-4 rounded-2xl bg-white/70 border border-slate-200 space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-600 font-bold block">
              1. Pre-Admission (Home)
            </span>
            <div className="text-base font-extrabold text-slate-800">
              {currentItem.preHospDose !== 'None' ? currentItem.preHospDose : <span className="text-slate-600 italic">None</span>}
            </div>
            <div className="text-xs text-slate-600">
              {currentItem.preHospFrequency || 'Not taken at home prior to stay'}
            </div>
          </div>

          {/* 2. In-Hospital Chart */}
          <div className="p-4 rounded-2xl bg-white/70 border border-slate-200 space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-600 font-bold block">
              2. In-Hospital Action
            </span>
            <div className="text-base font-extrabold text-sky-700">
              {currentItem.inHospAction}
            </div>
            {currentItem.inHospReason && (
              <div className="text-xs text-slate-600 italic">
                {currentItem.inHospReason}
              </div>
            )}
          </div>

          {/* 3. Discharge Orders */}
          <div
            className={`p-4 rounded-2xl border space-y-1.5 ${
              currentItem.statusBadge === 'STOPPED'
                ? 'bg-rose-950/20 border-rose-200 text-rose-700'
                : currentItem.statusBadge === 'NEW'
                ? 'bg-purple-950/20 border-purple-800/80 text-purple-200'
                : 'bg-emerald-50 border-emerald-800/80 text-emerald-700'
            }`}
          >
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold block opacity-80">
              3. Discharge Order
            </span>
            <div className="text-lg font-black tracking-tight">
              {currentItem.dischargeDose}
            </div>
            <div className="text-xs font-medium opacity-90">
              {currentItem.dischargeFrequency || currentItem.documentedReason || 'Follow doctor orders'}
            </div>
          </div>
        </div>

        {/* Conversational Explanation Card */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-white via-slate-50/90 to-sky-950/30 border border-sky-900/50 shadow-lg space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-600/30 text-sky-700 flex items-center justify-center border border-sky-500/40">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-sky-700">
                CareCanvas Clinical Agent Explanation
              </h4>
              <p className="text-[11px] text-slate-600">Plain-language translation of why this medication changed</p>
            </div>
          </div>

          <p className="text-sm font-medium text-slate-900 leading-relaxed bg-white p-4 rounded-2xl border border-slate-200">
            {currentItem.plainLanguageExplanation}
          </p>

          {currentItem.dietInstructions && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-800/40 font-medium">
              <Utensils className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Food Rule: <strong>{currentItem.dietInstructions}</strong></span>
            </div>
          )}
        </div>

        {/* Safety & Interaction Warnings (if any) */}
        {((currentItem.interactions && currentItem.interactions.length > 0) ||
          (currentItem.dietInteractions && currentItem.dietInteractions.length > 0)) && (
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              <span>Safety & Interaction Screen Results</span>
            </h4>

            {currentItem.interactions?.map((inter) => (
              <div
                key={inter.id}
                className="p-4 rounded-2xl bg-rose-50 border border-rose-800/70 shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between text-xs font-bold text-rose-700">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>
                      {inter.severity} Conflict: {inter.drugA} ↔ {inter.drugB}
                    </span>
                  </div>
                  {inter.isPreAdmitOTC && (
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-700 text-[10px] font-mono border border-rose-200">
                      Pre-Admit Supplement
                    </span>
                  )}
                </div>
                <p className="text-xs text-rose-100/90 leading-relaxed">
                  <strong>Mechanism:</strong> {inter.mechanism}
                </p>
                <p className="text-xs text-slate-700 italic bg-slate-50/50 p-2 rounded-xl">
                  <strong>Guidance:</strong> {inter.clinicalGuidance}
                </p>
              </div>
            ))}

            {currentItem.dietInteractions?.map((diet) => (
              <div
                key={diet.id}
                className="p-3.5 rounded-2xl bg-amber-50 border border-amber-800/70 text-xs text-amber-700 space-y-1"
              >
                <div className="flex items-center gap-2 font-bold">
                  <Utensils className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Diet Interaction: {diet.badge}</span>
                </div>
                <p className="text-amber-100/90">{diet.mechanism}</p>
                <p className="text-slate-700 italic">{diet.clinicalGuidance}</p>
              </div>
            ))}
          </div>
        )}

        {/* Doctor Questions Strip */}
        {currentItem.suggestedQuestions && currentItem.suggestedQuestions.length > 0 && (
          <div className="space-y-2">
            <span className="text-[11px] font-mono text-slate-600 uppercase tracking-wider font-bold">
              Suggested Questions for Your Follow-Up Doctor:
            </span>
            <div className="space-y-2">
              {currentItem.suggestedQuestions.map((q, qIdx) => (
                <div
                  key={qIdx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-2xl bg-white border border-slate-200 text-xs text-slate-800"
                >
                  <div className="flex items-start gap-2">
                    <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>{q}</span>
                  </div>
                  <button
                    onClick={() => onAskDoctor(currentItem.medName, q)}
                    className="px-3 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 text-[11px] font-bold border border-amber-200 transition-colors shrink-0"
                  >
                    + Add to Question Bank
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Patient Note Field (if open or note exists) */}
        {showNoteInput || currentItem.patientComment ? (
          <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
              <span>Personal Notes or Questions for this Medication:</span>
            </label>
            <textarea
              value={patientNote}
              onChange={(e) => setPatientNote(e.target.value)}
              placeholder="e.g. Remember to ask Dr. Patel if I can take this with milk, or set an alarm for 8am..."
              rows={2}
              className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowNoteInput(false)}
                className="px-3 py-1 rounded-lg text-slate-600 hover:text-slate-900 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNote}
                className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs"
              >
                Save Note
              </button>
            </div>
          </div>
        ) : null}

        {/* Action Gate & Decision Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => onApproveMed(currentItem.medId)}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs shadow-lg transition-all ${
                isApproved
                  ? 'bg-emerald-600 text-white shadow-emerald-900/30'
                  : 'bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-sky-900/30 hover:scale-102'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{isApproved ? 'Approved by Patient' : 'Approve Medication Change'}</span>
            </button>

            {!showNoteInput && (
              <button
                onClick={() => setShowNoteInput(true)}
                className="px-3.5 py-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
                title="Add note"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Stepper Nav Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className={`flex items-center gap-1 px-3.5 py-2 rounded-2xl text-xs font-semibold border transition-colors ${
                currentIndex === 0
                  ? 'bg-slate-50 text-slate-600 border-slate-900 cursor-not-allowed'
                  : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-100 text-white text-xs font-bold border border-slate-200 transition-colors shadow-sm"
            >
              <span>{currentIndex === items.length - 1 ? 'Finish Review' : 'Next Med'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
