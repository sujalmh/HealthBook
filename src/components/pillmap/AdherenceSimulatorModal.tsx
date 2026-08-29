/**
 * CareCanvas Component: AdherenceSimulatorModal
 * Interactive missed-dose clinical risk calculator evaluating biomarker deltas and recovery protocols.
 */

import React, { useState } from 'react';
import { HelpCircle, AlertTriangle, ShieldAlert, Activity, ArrowRight, Check, X, Sparkles, PlusCircle } from 'lucide-react';
import type { MissedDoseSimulationResult, DayOfWeek, TimeSlot } from '../../types/pillmap.ts';
import { ClinicalInteractionEngine } from '../../core/knowledge/interactionEngine.ts';
import { DAYS_OF_WEEK, TIME_SLOTS } from '../../types/pillmap.ts';

export interface AdherenceSimulatorModalProps {
  initialMedName?: string;
  initialDay?: DayOfWeek;
  initialSlot?: TimeSlot;
  activeMedNames?: string[];
  onClose: () => void;
  onAddQuestionToBank?: (questionText: string, medName: string) => void;
}

export const AdherenceSimulatorModal: React.FC<AdherenceSimulatorModalProps> = ({
  initialMedName = 'Metformin',
  initialDay = 'tuesday',
  initialSlot = 'morning',
  activeMedNames = [],
  onClose,
  onAddQuestionToBank
}) => {
  const [selectedMed, setSelectedMed] = useState<string>(initialMedName);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(initialDay);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot>(initialSlot);
  const [questionAdded, setQuestionAdded] = useState<boolean>(false);

  // Compute simulation result
  const simulation: MissedDoseSimulationResult = ClinicalInteractionEngine.simulateAdherence(
    selectedMed,
    { day: selectedDay, slot: selectedSlot }
  );

  const handleAddQuestion = () => {
    if (onAddQuestionToBank) {
      const questionText = `If I miss my ${selectedSlot} dose of ${selectedMed}, what is the maximum time window within which I can safely take it?`;
      onAddQuestionToBank(questionText, selectedMed);
      setQuestionAdded(true);
    }
  };

  const medOptions = Array.from(
    new Set([
      initialMedName,
      ...activeMedNames,
      'Metformin',
      'Apixaban',
      'Warfarin',
      'Lisinopril',
      'Amlodipine',
      'Atorvastatin',
      'Carvedilol',
      'Levothyroxine'
    ])
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-amber-950/80 via-slate-50 to-rose-950/80 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-200 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-slate-900">
                Missed Dose Adherence Simulator
              </h2>
              <p className="text-xs text-amber-400 font-semibold">
                Clinical Pharmacological Impact Assessment
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-sm text-slate-800">
          {/* Medication & Slot Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Medication
              </label>
              <select
                value={selectedMed}
                onChange={(e) => setSelectedMed(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-amber-500"
              >
                {medOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Missed Day
              </label>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value as DayOfWeek)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold capitalize focus:outline-none focus:border-amber-500"
              >
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Missed Slot
              </label>
              <select
                value={selectedSlot}
                onChange={(e) => setSelectedSlot(e.target.value as TimeSlot)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold capitalize focus:outline-none focus:border-amber-500"
              >
                {TIME_SLOTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Clinical Risk Summary */}
          <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
              <Activity className="w-4 h-4" /> Projected Clinical Impact
            </div>
            <p className="text-slate-900 font-medium leading-relaxed">
              {simulation.clinicalImpactSummary}
            </p>
            {simulation.projectedBiomarkerDelta && (
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-200 text-amber-700 text-xs font-bold">
                <span>{simulation.projectedBiomarkerDelta.biomarker}:</span>
                <span className="font-mono">{simulation.projectedBiomarkerDelta.estimatedChange}</span>
              </div>
            )}
          </div>

          {/* Recovery Protocol */}
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
              <Sparkles className="w-4 h-4" /> Recommended Recovery Protocol
            </div>
            <p className="text-emerald-100 leading-relaxed text-xs">
              {simulation.recoveryProtocol}
            </p>
          </div>

          {/* Mandatory Do Not Double Dose Safety Banner */}
          {simulation.doNotDoubleDoseWarning && (
            <div className="p-3 rounded-2xl bg-rose-100 border border-rose-700/80 flex items-start gap-2.5 text-rose-700">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-black uppercase tracking-wider text-rose-700 block">
                  Critical Safety Rule: Do Not Double Dose
                </span>
                <span>
                  Never take two doses at the same time to make up for a missed dose. Doing so can cause acute toxic overdosing.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer with Question Bank Action */}
        <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleAddQuestion}
            disabled={questionAdded}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200 transition-colors disabled:opacity-50"
          >
            {questionAdded ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 font-bold">Added to Question Bank</span>
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4 text-sky-400" />
                <span>Add Question for Doctor</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors"
          >
            Close Simulation
          </button>
        </div>
      </div>
    </div>
  );
};
