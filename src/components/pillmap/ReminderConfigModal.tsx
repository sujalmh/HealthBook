/**
 * CareCanvas Component: ReminderConfigModal
 * Configures persistent time-slot notifications for daily medications and saves them to LocalVault.
 */

import React, { useState } from 'react';
import { Bell, Clock, Check, X, ShieldCheck, Sun, CloudSun, Sunset, Moon } from 'lucide-react';
import type { TimeSlot, Chronotype } from '../../types/pillmap.ts';
import { ModalPortal } from '../common/ModalPortal';
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
    <ModalPortal isOpen={true} onClose={onClose} ariaLabel="Daily Medication Reminders">
      <div className="bg-white border border-canvas-border rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl mx-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-primary to-accent border-b border-canvas-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-white">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-body sm:text-heading-md font-bold text-white tracking-tight">
                Daily Medication Reminders
              </h2>
              <p className="text-caption text-white/80">Time-Slot Batch Notifications</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/20 text-white/90 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4 text-body-sm text-slate-800">
          <p className="text-muted text-body-sm">
            Batch reminders send a single consolidated alert for all medications in each time window, avoiding alert fatigue.
          </p>

          <div className="space-y-3">
            {/* Morning */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-2xl bg-canvas-muted border border-canvas-border">
              <div className="flex items-center gap-2.5">
                <Sun className="w-4 h-4 text-amber-500" />
                <span className="font-semibold text-slate-800">Morning Dose</span>
              </div>
              <input
                type="time"
                value={morningTime}
                onChange={(e) => setMorningTime(e.target.value)}
                className="w-full sm:w-auto bg-white border border-canvas-border rounded-xl px-3 py-2 font-mono text-body-sm text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[44px]"
              />
            </div>

            {/* Noon */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-2xl bg-canvas-muted border border-canvas-border">
              <div className="flex items-center gap-2.5">
                <CloudSun className="w-4 h-4 text-primary" />
                <span className="font-semibold text-slate-800">Noon Dose</span>
              </div>
              <input
                type="time"
                value={noonTime}
                onChange={(e) => setNoonTime(e.target.value)}
                className="w-full sm:w-auto bg-white border border-canvas-border rounded-xl px-3 py-2 font-mono text-body-sm text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[44px]"
              />
            </div>

            {/* Evening */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-2xl bg-canvas-muted border border-canvas-border">
              <div className="flex items-center gap-2.5">
                <Sunset className="w-4 h-4 text-orange-500" />
                <span className="font-semibold text-slate-800">Evening Dose</span>
              </div>
              <input
                type="time"
                value={eveningTime}
                onChange={(e) => setEveningTime(e.target.value)}
                className="w-full sm:w-auto bg-white border border-canvas-border rounded-xl px-3 py-2 font-mono text-body-sm text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[44px]"
              />
            </div>

            {/* Bedtime */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-2xl bg-canvas-muted border border-canvas-border">
              <div className="flex items-center gap-2.5">
                <Moon className="w-4 h-4 text-indigo-500" />
                <span className="font-semibold text-slate-800">Bedtime Dose</span>
              </div>
              <input
                type="time"
                value={bedtimeTime}
                onChange={(e) => setBedtimeTime(e.target.value)}
                className="w-full sm:w-auto bg-white border border-canvas-border rounded-xl px-3 py-2 font-mono text-body-sm text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[44px]"
              />
            </div>
          </div>

          {/* Success Banner */}
          {isSaved && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-2 text-body-sm font-semibold animate-fade-in">
              <Check className="w-4 h-4 text-emerald-500" />
              <span>Reminders Saved to Calendar & Vault!</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-canvas-border flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-canvas-border hover:bg-canvas-muted text-slate-700 font-semibold text-body-sm min-h-[44px] flex items-center justify-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-body-sm shadow-sm min-h-[44px]"
            >
              <Bell className="w-4 h-4" />
              <span>Save Reminders</span>
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
};
