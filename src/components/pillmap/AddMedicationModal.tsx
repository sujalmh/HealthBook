/**
 * CareCanvas Component: AddMedicationModal
 * Modal allowing patients and caregivers to add a custom prescription drug or OTC supplement to PillMap.
 */

import React, { useState } from 'react';
import { Pill, X, Plus } from 'lucide-react';
import type { TimeSlot, DayOfWeek } from '../../types/pillmap.ts';
import { ModalPortal } from '../common/ModalPortal';
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
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState(false);

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
    setResolveError(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !dosage.trim() || isResolving) return;

    // Generic resolution via the AI pipeline. Food-rule checkboxes stay fully
    // manual — no hardcoded drug rules in the form.
    setIsResolving(true);
    setResolveError(false);
    try {
      const genericName = await ClinicalInteractionEngine.resolveGenericName(name.trim());
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
    } catch {
      setResolveError(true);
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <ModalPortal isOpen={true} onClose={onClose} ariaLabel="Add Medication to Pillbox">
      <div className="bg-white border border-canvas-border rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl mx-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-primary border-b border-canvas-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-white">
              <Pill className="w-4 h-4" />
            </div>
            <h2 className="text-body sm:text-heading-md font-bold text-white tracking-tight">
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
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 text-body-sm text-slate-800">
          {/* Name & Dosage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-caption">
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
                <span>Take with food</span>
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
                <span>Empty stomach</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-canvas-muted border border-canvas-border cursor-pointer hover:bg-white transition-colors">
                <input
                  type="checkbox"
                  checked={avoidGrapefruit}
                  onChange={(e) => setAvoidGrapefruit(e.target.checked)}
                  className="rounded bg-white border-canvas-border text-primary focus:ring-primary"
                />
                <span>Avoid grapefruit</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-canvas-muted border border-canvas-border cursor-pointer hover:bg-white transition-colors">
                <input
                  type="checkbox"
                  checked={avoidAlcohol}
                  onChange={(e) => setAvoidAlcohol(e.target.checked)}
                  className="rounded bg-white border-canvas-border text-primary focus:ring-primary"
                />
                <span>Avoid alcohol</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-canvas-border flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-canvas-border hover:bg-canvas-muted text-slate-700 font-semibold text-body-sm min-h-[44px] flex items-center justify-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isResolving}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-60 text-white font-bold text-body-sm shadow-sm min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>{isResolving ? 'Resolving…' : 'Add to Pillbox'}</span>
            </button>
          </div>
          {resolveError && (
            <p className="text-caption text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              Couldn't resolve this medication — the AI service is unavailable. Check your connection and retry.
            </p>
          )}
        </form>
      </div>
    </ModalPortal>
  );
};
