/**
 * CareCanvas Component: AddMedicationModal
 * Modal allowing patients and caregivers to add a custom prescription drug or OTC supplement to PillMap.
 */

import React, { useState } from 'react';
import { Pill, Plus, X, Sparkles, Check, Clock, Utensils } from 'lucide-react';
import type { TimeSlot, DayOfWeek } from '../../types/pillmap.ts';
import { DAYS_OF_WEEK, TIME_SLOTS } from '../../types/pillmap.ts';
import { ClinicalInteractionEngine } from '../../core/knowledge/interactionEngine.ts';

export interface AddMedicationModalProps {
  initialSlot?: TimeSlot;
  initialDay?: DayOfWeek;
  onSave: (med: {
    name: string;
    genericName: string;
    dosage: string;
    frequency: string;
    timingSlots: TimeSlot[];
    days: DayOfWeek[];
    withFood: boolean;
    emptyStomach: boolean;
    avoidGrapefruit: boolean;
    avoidAlcohol: boolean;
    avoidDairy: boolean;
  }) => void;
  onClose: () => void;
}

export const AddMedicationModal: React.FC<AddMedicationModalProps> = ({
  initialSlot = 'morning',
  initialDay = 'monday',
  onSave,
  onClose
}) => {
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('Once daily');
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([initialSlot]);
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([...DAYS_OF_WEEK]);
  const [withFood, setWithFood] = useState(false);
  const [emptyStomach, setEmptyStomach] = useState(false);
  const [avoidGrapefruit, setAvoidGrapefruit] = useState(false);
  const [avoidAlcohol, setAvoidAlcohol] = useState(false);
  const [avoidDairy, setAvoidDairy] = useState(false);

  const toggleSlot = (slot: TimeSlot) => {
    if (selectedSlots.includes(slot)) {
      if (selectedSlots.length > 1) {
        setSelectedSlots(selectedSlots.filter(s => s !== slot));
      }
    } else {
      setSelectedSlots([...selectedSlots, slot]);
    }
  };

  const toggleDay = (day: DayOfWeek) => {
    if (selectedDays.includes(day)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter(d => d !== day));
      }
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleNameChange = (val: string) => {
    setName(val);
    const generic = ClinicalInteractionEngine.resolveGenericName(val);
    if (generic === 'Levothyroxine') {
      setEmptyStomach(true);
      setAvoidDairy(true);
    } else if (generic === 'Metformin') {
      setWithFood(true);
    } else if (generic === 'Atorvastatin' || generic === 'Simvastatin') {
      setAvoidGrapefruit(true);
    } else if (generic === 'Metronidazole') {
      setAvoidAlcohol(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !dosage.trim()) return;

    const genericName = ClinicalInteractionEngine.resolveGenericName(name.trim());

    onSave({
      name: name.trim(),
      genericName,
      dosage: dosage.trim(),
      frequency,
      timingSlots: selectedSlots,
      days: selectedDays,
      withFood,
      emptyStomach,
      avoidGrapefruit,
      avoidAlcohol,
      avoidDairy
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-sky-950/80 to-indigo-950/80 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
              <Pill className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Add Medication to Pillbox
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs text-slate-800">
          {/* Name & Dosage */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Medication / Brand Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Lipitor, Metformin"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Dose Strength *
              </label>
              <input
                type="text"
                required
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                placeholder="e.g. 500mg, 40mg, 10mcg"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Prescribed Frequency
            </label>
            <input
              type="text"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              placeholder="e.g. Once daily, Twice daily, As needed"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Timing Slots Checkboxes */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Daily Time Slots
            </label>
            <div className="grid grid-cols-4 gap-2">
              {TIME_SLOTS.map((slot) => {
                const isSelected = selectedSlots.includes(slot);
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => toggleSlot(slot)}
                    className={`py-2 px-2 rounded-xl text-center capitalize font-bold transition-all border ${
                      isSelected
                        ? 'bg-sky-600/90 text-white border-sky-400 shadow-md shadow-sky-600/20'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Food & Dietary Instructions */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Food & Dietary Instructions
            </label>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-850">
                <input
                  type="checkbox"
                  checked={withFood}
                  onChange={(e) => {
                    setWithFood(e.target.checked);
                    if (e.target.checked) setEmptyStomach(false);
                  }}
                  className="rounded bg-slate-100 border-slate-200 text-sky-500 focus:ring-0"
                />
                <span>🍽️ Take with Food</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-850">
                <input
                  type="checkbox"
                  checked={emptyStomach}
                  onChange={(e) => {
                    setEmptyStomach(e.target.checked);
                    if (e.target.checked) setWithFood(false);
                  }}
                  className="rounded bg-slate-100 border-slate-200 text-sky-500 focus:ring-0"
                />
                <span>🥣 Empty Stomach</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-850">
                <input
                  type="checkbox"
                  checked={avoidGrapefruit}
                  onChange={(e) => setAvoidGrapefruit(e.target.checked)}
                  className="rounded bg-slate-100 border-slate-200 text-sky-500 focus:ring-0"
                />
                <span>🍊 Avoid Grapefruit</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-850">
                <input
                  type="checkbox"
                  checked={avoidAlcohol}
                  onChange={(e) => setAvoidAlcohol(e.target.checked)}
                  className="rounded bg-slate-100 border-slate-200 text-sky-500 focus:ring-0"
                />
                <span>🚫 Avoid Alcohol</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>Add to Pillbox</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
