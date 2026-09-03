
import React, { useState } from 'react';
import { Volume2, CheckCircle, Clock, Sun, CloudSun, Sunset, Moon, Sparkles, Check, Pill } from 'lucide-react';
import type { PillSlotItem, TimeSlot, Chronotype } from '../../types/pillmap.ts';
import { CHRONOTYPE_TIMES } from '../../types/pillmap.ts';

export interface SimpleElderViewProps {
  currentSlot?: TimeSlot;
  chronotype?: Chronotype;
  pillsInSlot: PillSlotItem[];
  onTakePills?: (slot: TimeSlot) => void;
  onSwitchToFullView: () => void;
}

export const SimpleElderView: React.FC<SimpleElderViewProps> = ({
  currentSlot = 'morning',
  chronotype = 'standard',
  pillsInSlot = [],
  onTakePills,
  onSwitchToFullView
}) => {
  const [activeSlot, setActiveSlot] = useState<TimeSlot>(currentSlot);
  const [isTaken, setIsTaken] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const times = CHRONOTYPE_TIMES[chronotype] || CHRONOTYPE_TIMES.standard;

  const slotLabels: Record<
    TimeSlot,
    { label: string; time: string; icon: React.ReactNode; mealNote: string; bg: string }
  > = {
    morning: {
      label: 'Morning Dose',
      time: times.morning,
      icon: <Sun className="w-8 h-8 text-amber-400" />,
      mealNote: 'Take with breakfast and a full glass of water.',
      bg: 'bg-amber-50/60'
    },
    noon: {
      label: 'Afternoon Dose',
      time: times.noon,
      icon: <CloudSun className="w-8 h-8 text-sky-400" />,
      mealNote: 'Take with lunch.',
      bg: 'bg-sky-50/60'
    },
    evening: {
      label: 'Evening Dose',
      time: times.evening,
      icon: <Sunset className="w-8 h-8 text-orange-400" />,
      mealNote: 'Take with dinner.',
      bg: 'bg-orange-50/60'
    },
    bedtime: {
      label: 'Bedtime Dose',
      time: times.bedtime,
      icon: <Moon className="w-8 h-8 text-teal-500" />,
      mealNote: 'Take before sleep.',
      bg: 'bg-teal-50/60'
    }
  };

  const meta = slotLabels[activeSlot];

  const speakInstructions = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const medListText =
        pillsInSlot.length > 0
          ? pillsInSlot.map((p) => `${p.name}, ${p.dosage}`).join('. and ')
          : 'No pills scheduled for this time.';

      const speechText = `It is time for your ${meta.label} at ${meta.time}. ${meta.mealNote}. You have ${pillsInSlot.length} medication${pillsInSlot.length === 1 ? '' : 's'}: ${medListText}.`;

      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.rate = 0.85;
      utterance.pitch = 1.0;

      utterance.onstart = () => setIsPlayingAudio(true);
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);

      window.speechSynthesis.speak(utterance);
    }
  };

  const handleMarkTaken = () => {
    setIsTaken(true);
    if (onTakePills) {
      onTakePills(activeSlot);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 sm:space-y-6 animate-fade-in">
      {}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white p-1.5 rounded-2xl border border-canvas-border shadow-sm">
        {(['morning', 'noon', 'evening', 'bedtime'] as TimeSlot[]).map((slot) => {
          const isActive = activeSlot === slot;
          return (
            <button
              key={slot}
              onClick={() => {
                setActiveSlot(slot);
                setIsTaken(false);
              }}
              className={`py-2.5 sm:py-3 px-2 rounded-xl text-center transition-all min-h-[44px] flex flex-col items-center justify-center ${
                isActive
                  ? 'bg-primary text-white font-bold shadow-sm'
                  : 'text-muted hover:text-slate-900 hover:bg-canvas-muted'
              }`}
            >
              <div className="text-body font-semibold capitalize">{slot}</div>
              <div className="text-caption opacity-80 font-mono mt-0.5">{times[slot]}</div>
            </button>
          );
        })}
      </div>

      {}
      <div
        className={`rounded-2xl border border-canvas-border ${meta.bg} p-4 sm:p-8 shadow-sm space-y-5 sm:space-y-6 text-slate-900`}
      >
        {}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-200 pb-5 sm:pb-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 border border-slate-200 shadow-inner shrink-0">
              {meta.icon}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{meta.label}</h2>
                <span className="px-2.5 py-0.5 rounded-xl bg-sky-500/20 text-sky-700 font-mono font-bold text-xs sm:text-sm border border-sky-500/40">
                  {meta.time}
                </span>
              </div>
              <p className="text-body-sm sm:text-sm text-slate-700 font-medium mt-1">{meta.mealNote}</p>
            </div>
          </div>

          {}
          <button
            type="button"
            onClick={speakInstructions}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-body-sm border transition-all min-h-[44px] shrink-0 ${
              isPlayingAudio
                ? 'bg-amber-500 text-white border-amber-400 animate-pulse'
                : 'bg-white hover:bg-canvas-muted text-slate-700 border-canvas-border'
            }`}
            title="Read instructions out loud"
            aria-label="Read instructions out loud"
          >
            <Volume2 className="w-5 h-5 text-amber-500" />
            <span>{isPlayingAudio ? 'Reading Aloud...' : 'Read Aloud'}</span>
          </button>
        </div>

        {}
        <div className="space-y-4">
          <h3 className="text-caption uppercase tracking-wider text-muted font-bold">
            Medications for this time ({pillsInSlot.length})
          </h3>

          {pillsInSlot.length === 0 ? (
            <div className="p-6 sm:p-8 text-center bg-white rounded-2xl border border-canvas-border text-muted">
              <Sparkles className="w-8 h-8 text-primary mx-auto mb-2 opacity-60" />
              <p className="text-heading-md text-slate-800">No pills scheduled for this slot.</p>
              <p className="text-body-sm text-muted mt-1">Enjoy your rest!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pillsInSlot.map((pill) => (
                <div
                  key={pill.id}
                  className="p-4 sm:p-5 rounded-2xl bg-white border border-canvas-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div
                      className="w-10 h-10 rounded-xl border border-white flex items-center justify-center shrink-0"
                      style={{ backgroundColor: pill.color || '#3B82F6' }}
                    >
                      <Pill className="w-5 h-5 text-white" aria-hidden="true" />
                    </div>
                    <div>
                      <h4 className="text-heading-md text-slate-900">{pill.name}</h4>
                      {pill.genericName && (
                        <p className="text-body-sm text-muted">({pill.genericName})</p>
                      )}
                      <div className="mt-1 flex items-center gap-2 text-body-sm flex-wrap">
                        <span className="font-mono font-semibold text-primary-text bg-primary-light px-2 py-0.5 rounded-lg border border-primary-border">
                          {pill.dosage}
                        </span>
                        {pill.withFood && (
                          <span className="text-emerald-700 font-semibold">With food</span>
                        )}
                        {pill.emptyStomach && (
                          <span className="text-amber-700 font-semibold">On empty stomach</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {}
        {pillsInSlot.length > 0 && (
          <div className="pt-2">
            <button
              type="button"
              onClick={handleMarkTaken}
              className={`w-full py-3.5 sm:py-4 rounded-2xl font-bold text-body sm:text-heading-md flex items-center justify-center gap-2.5 sm:gap-3 transition-all shadow-sm min-h-[44px] ${
                isTaken
                  ? 'bg-emerald-600 text-white'
                  : 'bg-primary hover:bg-primary-hover text-white'
              }`}
            >
              {isTaken ? (
                <>
                  <Check className="w-6 h-6 stroke-[3]" />
                  <span>Dose Confirmed Taken!</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-6 h-6" />
                  <span>I Have Taken These Pills</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {}
      <div className="text-center">
        <button
          onClick={onSwitchToFullView}
          className="min-h-[44px] inline-flex items-center justify-center px-4 py-2 text-xs text-slate-600 hover:text-sky-700 font-semibold transition-colors underline underline-offset-4"
        >
          Switch to Full 7x4 Interactive Pillbox Grid
        </button>
      </div>
    </div>
  );
};

