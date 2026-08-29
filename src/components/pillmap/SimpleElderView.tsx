/**
 * CareCanvas Component: SimpleElderView
 * Accessible, oversized, distraction-free elder mode showing the immediate next dose,
 * large high-contrast typography, and voice narration via Web Speech API.
 */

import React, { useState } from 'react';
import { Volume2, CheckCircle, Clock, Sun, CloudSun, Sunset, Moon, Sparkles, Check } from 'lucide-react';
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
      bg: 'from-amber-50 via-slate-50 to-white'
    },
    noon: {
      label: 'Afternoon Dose',
      time: times.noon,
      icon: <CloudSun className="w-8 h-8 text-sky-400" />,
      mealNote: 'Take with lunch.',
      bg: 'from-sky-50 via-slate-50 to-white'
    },
    evening: {
      label: 'Evening Dose',
      time: times.evening,
      icon: <Sunset className="w-8 h-8 text-orange-400" />,
      mealNote: 'Take with dinner.',
      bg: 'from-orange-50 via-slate-50 to-white'
    },
    bedtime: {
      label: 'Bedtime Dose',
      time: times.bedtime,
      icon: <Moon className="w-8 h-8 text-indigo-400" />,
      mealNote: 'Take before sleep.',
      bg: 'from-indigo-50 via-slate-50 to-white'
    }
  };

  const meta = slotLabels[activeSlot];

  // Web Speech API Voice Playback
  const speakInstructions = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const medListText =
        pillsInSlot.length > 0
          ? pillsInSlot.map((p) => `${p.name}, ${p.dosage}`).join('. and ')
          : 'No pills scheduled for this time.';

      const speechText = `It is time for your ${meta.label} at ${meta.time}. ${meta.mealNote}. You have ${pillsInSlot.length} medication${pillsInSlot.length === 1 ? '' : 's'}: ${medListText}.`;

      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.rate = 0.85; // slightly slower for elderly clarity
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
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Top Selector Bar for Slots */}
      <div className="grid grid-cols-4 gap-2 bg-white/90 p-1.5 rounded-2xl border border-slate-200">
        {(['morning', 'noon', 'evening', 'bedtime'] as TimeSlot[]).map((slot) => {
          const isActive = activeSlot === slot;
          return (
            <button
              key={slot}
              onClick={() => {
                setActiveSlot(slot);
                setIsTaken(false);
              }}
              className={`py-3 px-2 rounded-xl text-center transition-all ${
                isActive
                  ? 'bg-sky-600 text-white font-black shadow-lg shadow-sky-600/30 scale-102'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <div className="text-sm font-bold capitalize">{slot}</div>
              <div className="text-[11px] opacity-80 font-mono mt-0.5">{times[slot]}</div>
            </button>
          );
        })}
      </div>

      {/* Main Focus Card */}
      <div
        className={`rounded-3xl border border-slate-750 bg-gradient-to-b ${meta.bg} p-8 shadow-2xl space-y-6 text-slate-900`}
      >
        {/* Header with Slot, Time & Voice Read-Aloud */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 shadow-inner">
              {meta.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black tracking-tight text-slate-900">{meta.label}</h2>
                <span className="px-3 py-1 rounded-xl bg-sky-500/20 text-sky-700 font-mono font-bold text-sm border border-sky-500/40">
                  {meta.time}
                </span>
              </div>
              <p className="text-sm text-slate-700 font-medium mt-1">{meta.mealNote}</p>
            </div>
          </div>

          {/* Voice Read Aloud Button */}
          <button
            type="button"
            onClick={speakInstructions}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs border transition-all ${
              isPlayingAudio
                ? 'bg-amber-500 text-slate-950 border-amber-400 animate-pulse'
                : 'bg-slate-100 hover:bg-slate-100 text-slate-800 border-slate-200'
            }`}
            title="Read instructions out loud"
            aria-label="Read instructions out loud"
          >
            <Volume2 className="w-5 h-5 text-amber-400" />
            <span>{isPlayingAudio ? 'Reading Aloud...' : 'Read Aloud'}</span>
          </button>
        </div>

        {/* Big Medication List */}
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-600">
            Medications for this time ({pillsInSlot.length})
          </h3>

          {pillsInSlot.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-600">
              <Sparkles className="w-8 h-8 text-sky-400 mx-auto mb-2 opacity-60" />
              <p className="text-base font-bold text-slate-800">No pills scheduled for this slot.</p>
              <p className="text-xs text-slate-600 mt-1">Enjoy your rest!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pillsInSlot.map((pill) => (
                <div
                  key={pill.id}
                  className="p-5 rounded-2xl bg-slate-50/90 border border-slate-750 flex items-center justify-between gap-4 shadow-md"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-10 h-10 rounded-2xl border border-white/30 flex items-center justify-center font-bold text-lg shadow-sm"
                      style={{ backgroundColor: pill.color || '#3B82F6' }}
                    >
                      💊
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-white">{pill.name}</h4>
                      {pill.genericName && (
                        <p className="text-xs text-slate-600">({pill.genericName})</p>
                      )}
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        <span className="font-mono font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                          {pill.dosage}
                        </span>
                        {pill.withFood && (
                          <span className="text-emerald-700 font-semibold">🍽️ With food</span>
                        )}
                        {pill.emptyStomach && (
                          <span className="text-amber-700 font-semibold">🥣 On empty stomach</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Take Action Button */}
        {pillsInSlot.length > 0 && (
          <div className="pt-2">
            <button
              type="button"
              onClick={handleMarkTaken}
              className={`w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-3 transition-all shadow-xl ${
                isTaken
                  ? 'bg-emerald-600 text-white shadow-emerald-900/40'
                  : 'bg-gradient-to-r from-sky-600 via-indigo-600 to-sky-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-sky-900/40 hover:scale-[1.01]'
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

      {/* Switch to Full 7x4 Grid Mode */}
      <div className="text-center">
        <button
          onClick={onSwitchToFullView}
          className="text-xs text-slate-600 hover:text-sky-700 font-semibold transition-colors underline underline-offset-4"
        >
          Switch to Full 7x4 Interactive Pillbox Grid
        </button>
      </div>
    </div>
  );
};
