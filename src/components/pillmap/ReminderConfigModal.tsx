/**
 * CareCanvas Component: ReminderConfigModal
 * Configures persistent time-slot notifications for daily medications and saves them to LocalVault.
 */

import React, { useState } from 'react';
import { Bell, Clock, Check, X, ShieldCheck, Sun, CloudSun, Sunset, Moon } from 'lucide-react';
import type { TimeSlot, Chronotype } from '../../types/pillmap.ts';
import { CHRONOTYPE_TIMES } from '../../types/pillmap.ts';

export interface ReminderConfigModalProps {
  chronotype: Chronotype;
  onSaveReminders: (slotTimes: Record<TimeSlot, string>) => void;
  onClose: () => void;
}

export const ReminderConfigModal: React.FC<ReminderConfigModalProps> = ({
  chronotype = 'standard',
  onSaveReminders,
  onClose
}) => {
  const defaultTimes = CHRONOTYPE_TIMES[chronotype] || CHRONOTYPE_TIMES.standard;
  const [morningTime, setMorningTime] = useState(defaultTimes.morning);
  const [noonTime, setNoonTime] = useState(defaultTimes.noon);
  const [eveningTime, setEveningTime] = useState(defaultTimes.evening);
  const [bedtimeTime, setBedtimeTime] = useState(defaultTimes.bedtime);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveReminders({
      morning: morningTime,
      noon: noonTime,
      evening: eveningTime,
      bedtime: bedtimeTime
    });
    setIsSaved(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-sky-950/80 to-indigo-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Daily Medication Reminders
              </h2>
              <p className="text-[11px] text-sky-400">Time-Slot Batch Notifications</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs text-slate-200">
          <p className="text-slate-400 text-xs">
            Batch reminders send a single consolidated alert for all medications in each time window, avoiding alert fatigue.
          </p>

          <div className="space-y-3">
            {/* Morning */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
              <div className="flex items-center gap-2.5">
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-slate-200">Morning Dose</span>
              </div>
              <input
                type="time"
                value={morningTime}
                onChange={(e) => setMorningTime(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Noon */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
              <div className="flex items-center gap-2.5">
                <CloudSun className="w-4 h-4 text-sky-400" />
                <span className="font-bold text-slate-200">Noon Dose</span>
              </div>
              <input
                type="time"
                value={noonTime}
                onChange={(e) => setNoonTime(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Evening */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
              <div className="flex items-center gap-2.5">
                <Sunset className="w-4 h-4 text-orange-400" />
                <span className="font-bold text-slate-200">Evening Dose</span>
              </div>
              <input
                type="time"
                value={eveningTime}
                onChange={(e) => setEveningTime(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Bedtime */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
              <div className="flex items-center gap-2.5">
                <Moon className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-slate-200">Bedtime Dose</span>
              </div>
              <input
                type="time"
                value={bedtimeTime}
                onChange={(e) => setBedtimeTime(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Success Banner */}
          {isSaved && (
            <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-200 flex items-center gap-2 text-xs font-bold animate-fade-in">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Reminders Saved to Calendar & Vault!</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-semibold text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-600/30"
            >
              <Bell className="w-4 h-4" />
              <span>Save Reminders</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
