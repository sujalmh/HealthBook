/**
 * Healthbook Component: AdherenceSimulatorModal
 * Interactive missed-dose clinical risk calculator evaluating biomarker deltas and recovery protocols.
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, ShieldAlert, Check, X, PlusCircle, Activity, Sparkles, Loader2 } from 'lucide-react';
import type { MissedDoseSimulationResult, DayOfWeek, TimeSlot } from '../../types/pillmap.ts';
import { ModalPortal } from '../common/ModalPortal';
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
  const [simulation, setSimulation] = useState<MissedDoseSimulationResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<boolean>(false);

  // AI-native simulation — loading shimmer, honest error + retry, never canned text
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(false);
    ClinicalInteractionEngine.simulateAdherence(selectedMed, { day: selectedDay, slot: selectedSlot })
      .then((result) => {
        if (!cancelled) {
          setSimulation(result);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSimulation(null);
          setIsLoading(false);
          setLoadError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedMed, selectedDay, selectedSlot]);

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
    <ModalPortal isOpen={true} onClose={onClose} ariaLabel="Missed Dose Adherence Simulator">
      <div className="bg-white border border-canvas-border rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl mx-auto">
        {/* Header */}
        <div className="p-4 sm:p-6 bg-canvas-muted border-b border-canvas-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-body sm:text-heading-lg font-bold tracking-tight text-slate-900">
                Missed Dose Adherence Simulator
              </h2>
              <p className="text-caption text-amber-700 font-semibold">
                Clinical Pharmacological Impact Assessment
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-canvas-muted text-muted hover:text-slate-900 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 text-body text-slate-800">
          {/* Medication & Slot Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-caption uppercase tracking-wider text-muted mb-1">
                Medication
              </label>
              <select
                value={selectedMed}
                onChange={(e) => setSelectedMed(e.target.value)}
                className="w-full bg-canvas-muted border border-canvas-border rounded-xl px-3 py-2.5 text-body-sm text-slate-900 font-semibold focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              >
                {medOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-caption uppercase tracking-wider text-muted mb-1">
                Missed Day
              </label>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value as DayOfWeek)}
                className="w-full bg-canvas-muted border border-canvas-border rounded-xl px-3 py-2.5 text-body-sm text-slate-900 font-semibold capitalize focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              >
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-caption uppercase tracking-wider text-muted mb-1">
                Missed Slot
              </label>
              <select
                value={selectedSlot}
                onChange={(e) => setSelectedSlot(e.target.value as TimeSlot)}
                className="w-full bg-canvas-muted border border-canvas-border rounded-xl px-3 py-2.5 text-body-sm text-slate-900 font-semibold capitalize focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
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
          {isLoading ? (
            <div className="bg-canvas-muted p-3.5 sm:p-4 rounded-2xl border border-canvas-border flex items-center gap-2.5 text-body-sm text-muted" role="status">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
              Estimating what a missed dose means…
            </div>
          ) : loadError || !simulation ? (
            <div className="bg-amber-50 p-3.5 sm:p-4 rounded-2xl border border-amber-200 space-y-2.5">
              <p className="text-amber-900 font-medium leading-relaxed text-body-sm">
                Couldn't estimate this right now — the AI service is unavailable and nothing was fabricated.
              </p>
              <button
                type="button"
                onClick={() => {
                  setLoadError(false);
                  setIsLoading(true);
                  ClinicalInteractionEngine.simulateAdherence(selectedMed, { day: selectedDay, slot: selectedSlot })
                    .then((result) => {
                      setSimulation(result);
                      setIsLoading(false);
                    })
                    .catch(() => {
                      setSimulation(null);
                      setIsLoading(false);
                      setLoadError(true);
                    });
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-body-sm font-bold min-h-[44px]"
              >
                Retry
              </button>
            </div>
          ) : (
          <>
          <div className="bg-canvas-muted p-3.5 sm:p-4 rounded-2xl border border-canvas-border space-y-2">
            <div className="flex items-center gap-2 text-caption font-bold text-amber-700 uppercase tracking-wider">
              <Activity className="w-4 h-4" /> Projected Clinical Impact
            </div>
            <p className="text-slate-900 font-medium leading-relaxed text-body-sm sm:text-body">
              {simulation.clinicalImpactSummary}
            </p>
            {simulation.projectedBiomarkerDelta && (
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-body-sm font-semibold">
                <span>{simulation.projectedBiomarkerDelta.biomarker}:</span>
                <span className="font-mono">{simulation.projectedBiomarkerDelta.estimatedChange}</span>
              </div>
            )}
          </div>

          {/* Recovery Protocol */}
          <div className="bg-emerald-50 p-3.5 sm:p-4 rounded-2xl border border-emerald-200 space-y-2">
            <div className="flex items-center gap-2 text-caption font-bold text-emerald-700 uppercase tracking-wider">
              <Sparkles className="w-4 h-4" /> Recommended Recovery Protocol
            </div>
            <p className="text-emerald-800 leading-relaxed text-body-sm">
              {simulation.recoveryProtocol}
            </p>
          </div>

          {/* Mandatory Do Not Double Dose Safety Banner */}
          {simulation.doNotDoubleDoseWarning && (
            <div className="p-3 rounded-2xl bg-rose-100 border border-rose-700/80 flex items-start gap-2.5 text-rose-700">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold uppercase tracking-wider text-rose-700 block">
                  Critical Safety Rule: Do Not Double Dose
                </span>
                <span>
                  Never take two doses at the same time to make up for a missed dose. Doing so can cause acute toxic overdosing.
                </span>
              </div>
            </div>
          )}
          </>
          )}
        </div>

        {/* Footer with Question Bank Action */}
        <div className="p-4 sm:p-6 bg-canvas-muted border-t border-canvas-border flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
          <button
            type="button"
            onClick={handleAddQuestion}
            disabled={questionAdded}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white hover:bg-white text-slate-700 text-body-sm font-semibold border border-canvas-border transition-colors disabled:opacity-50 min-h-[44px]"
          >
            {questionAdded ? (
              <>
                <Check className="w-4 h-4 text-emerald-500" />
                <span className="text-emerald-700 font-bold">Added to Question Bank</span>
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4 text-primary" />
                <span>Add Question for Doctor</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-body-sm font-bold transition-colors min-h-[44px] flex items-center justify-center shadow-sm"
          >
            Close Simulation
          </button>
        </div>
      </div>
    </ModalPortal>
  );
};
