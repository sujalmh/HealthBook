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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-canvas-border rounded-2xl max-w-lg w-full shadow-lg overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-primary to-accent border-b border-canvas-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-white">
              <Pill className="w-4 h-4" />
            </div>
            <h2 className="text-heading-md text-white tracking-tight">
              Add Medication to Pillbox
            </h2>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-body-sm text-slate-800">
          {/* Name & Dosage */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-caption uppercase tracking-wider text-muted mb-1">
                Medication / Brand Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Lipitor, Metformin"
                className="w-full bg-canvas-muted border border-canvas-border rounded-xl px-3 py-2.5 text-slate-900 font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-caption uppercase tracking-wider text-muted mb-1">
                Dose Strength *
              </label>
              <input
                type="text"
                required
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                placeholder="e.g. 500mg, 40mg, 10mcg"
                className="w-full bg-canvas-muted border border-canvas-border rounded-xl px-3 py-2.5 text-slate-900 font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-caption uppercase tracking-wider text-muted mb-1">
              Prescribed Frequency
            </label>
            <input
              type="text"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              placeholder="e.g. Once daily, Twice daily, As needed"
              className="w-full bg-canvas-muted border border-canvas-border rounded-xl px-3 py-2.5 text-slate-900 font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Timing Slots Checkboxes */}
          <div>
            <label className="block text-caption uppercase tracking-wider text-muted mb-1.5">
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
                    className={`py-2.5 px-2 rounded-xl text-center capitalize font-semibold transition-all border min-h-[44px] ${
                      isSelected
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-canvas-muted text-muted border-canvas-border hover:bg-white'
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Food & Dietary Instructions */}
          <div className="space-y-2 pt-2 border-t border-canvas-border">
            <label className="block text-caption uppercase tracking-wider text-muted">
              Food & Dietary Instructions
            </label>
            <div className="grid grid-cols-2 gap-2 text-caption">
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-canvas-muted border border-canvas-border cursor-pointer hover:bg-white transition-colors">
                <input
                  type="checkbox"
                  checked={withFood}
                  onChange={(e) => {
                    setWithFood(e.target.checked);
                    if (e.target.checked) setEmptyStomach(false);
                  }}
                  className="rounded bg-white border-canvas-border text-primary focus:ring-primary"
                />
                <span>🍽️ Take with Food</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-canvas-muted border border-canvas-border cursor-pointer hover:bg-white transition-colors">
                <input
                  type="checkbox"
                  checked={emptyStomach}
                  onChange={(e) => {
                    setEmptyStomach(e.target.checked);
                    if (e.target.checked) setWithFood(false);
                  }}
                  className="rounded bg-white border-canvas-border text-primary focus:ring-primary"
                />
                <span>🥣 Empty Stomach</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-canvas-muted border border-canvas-border cursor-pointer hover:bg-white transition-colors">
                <input
                  type="checkbox"
                  checked={avoidGrapefruit}
                  onChange={(e) => setAvoidGrapefruit(e.target.checked)}
                  className="rounded bg-white border-canvas-border text-primary focus:ring-primary"
                />
                <span>🍊 Avoid Grapefruit</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-canvas-muted border border-canvas-border cursor-pointer hover:bg-white transition-colors">
                <input
                  type="checkbox"
                  checked={avoidAlcohol}
                  onChange={(e) => setAvoidAlcohol(e.target.checked)}
                  className="rounded bg-white border-canvas-border text-primary focus:ring-primary"
                />
                <span>🚫 Avoid Alcohol</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-canvas-border flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-canvas-border hover:bg-canvas-muted text-slate-700 font-semibold text-body-sm min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-body-sm shadow-sm min-h-[44px]"
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
