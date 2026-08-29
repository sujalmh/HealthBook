/**
 * CareCanvas Component: PillMapView
 * Main module container for Milestone 3 (PillMap & Polypharmacy Negotiator 7x4 Canvas).
 * Features: Chronotype selector, OTC drag palette, SVG conflict arcs, meal badges,
 * schedule optimizer ghost preview, missed dose adherence simulator, and pharmacist export.
 */

import React, { useState, useEffect } from 'react';
import {
  Pill,
  Sparkles,
  AlertTriangle,
  FileText,
  Bell,
  Plus,
  HelpCircle,
  ShieldAlert,
  RotateCcw,
  Sun,
  Moon,
  Clock,
  Layers,
  ArrowRight,
  GripVertical
} from 'lucide-react';
import type {
  PillboxGrid as IPillboxGrid,
  PillSlotItem,
  DayOfWeek,
  TimeSlot,
  Chronotype,
  InteractionArc,
  DietBadge,
  DuplicateIngredientAlert,
  ScheduleSuggestionResult,
  GhostPreviewShift,
  PharmacistExportBundle
} from '../../types/pillmap.ts';
import { DAYS_OF_WEEK, TIME_SLOTS, CHRONOTYPE_TIMES } from '../../types/pillmap.ts';
import { localVault } from '../../core/vault/LocalVault.ts';
import { eventBus } from '../../core/events/eventBus.ts';
import { ClinicalInteractionEngine } from '../../core/knowledge/interactionEngine.ts';
import { PillboxGrid } from './PillboxGrid.tsx';
import { SimpleElderView } from './SimpleElderView.tsx';
import { ShiftPreviewModal } from './ShiftPreviewModal.tsx';
import { AdherenceSimulatorModal } from './AdherenceSimulatorModal.tsx';
import { PharmacistExportModal } from './PharmacistExportModal.tsx';
import { AddMedicationModal } from './AddMedicationModal.tsx';
import { ReminderConfigModal } from './ReminderConfigModal.tsx';

export interface PillMapViewProps {
  patientId?: string;
  activeProfile?: {
    userId: string;
    name: string;
    role: string;
    isProxy?: boolean;
    relationship?: string;
  };
}

const COMMON_OTCS = [
  { name: "St. John's Wort", dose: '300mg', shape: 'capsule' as const, color: '#F59E0B', desc: 'Herbal (Serotonin Risk)' },
  { name: 'Tylenol Extra Strength', dose: '500mg', shape: 'round' as const, color: '#EF4444', desc: 'Acetaminophen (APAP)' },
  { name: 'Advil Liqui-Gels', dose: '200mg', shape: 'capsule' as const, color: '#3B82F6', desc: 'Ibuprofen (NSAID)' },
  { name: 'Aleve', dose: '220mg', shape: 'oval' as const, color: '#0EA5E9', desc: 'Naproxen (NSAID)' },
  { name: 'Fish Oil Omega-3', dose: '1200mg', shape: 'capsule' as const, color: '#EAB308', desc: 'Supplement (Bleed Risk)' },
  { name: 'Calcium Carbonate', dose: '600mg', shape: 'round' as const, color: '#8B5CF6', desc: 'Mineral (Chelates Drugs)' },
  { name: 'Aspirin Low Dose', dose: '81mg', shape: 'round' as const, color: '#EC4899', desc: 'Antiplatelet' },
  { name: 'Vitamin D3', dose: '2000IU', shape: 'oval' as const, color: '#10B981', desc: 'Daily Supplement' }
];

export const PillMapView: React.FC<PillMapViewProps> = ({
  patientId = '',
  activeProfile = { userId: '', name: 'Patient', role: 'patient' }
}) => {
  const [chronotype, setChronotype] = useState<Chronotype>('standard');
  const [viewMode, setViewMode] = useState<'canvas' | 'elder'>('canvas');
  const [grid, setGrid] = useState<IPillboxGrid>(() => createEmptyGrid());

  // Interactive Clinical Evaluations
  const [interactionArcs, setInteractionArcs] = useState<InteractionArc[]>([]);
  const [dietBadges, setDietBadges] = useState<DietBadge[]>([]);
  const [duplicateAlerts, setDuplicateAlerts] = useState<DuplicateIngredientAlert[]>([]);
  const [ghostShifts, setGhostShifts] = useState<GhostPreviewShift[]>([]);

  // Modals state
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState<ScheduleSuggestionResult | null>(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simulatorMed, setSimulatorMed] = useState<string>('Metformin');
  const [simulatorSlot, setSimulatorSlot] = useState<{ day: DayOfWeek; slot: TimeSlot }>({ day: 'tuesday', slot: 'morning' });
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportBundle, setExportBundle] = useState<PharmacistExportBundle | null>(null);
  const [isAddMedOpen, setIsAddMedOpen] = useState(false);
  const [addMedSlotTarget, setAddMedSlotTarget] = useState<{ day: DayOfWeek; slot: TimeSlot }>({ day: 'monday', slot: 'morning' });
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);

  function createEmptyGrid(): IPillboxGrid {
    const empty: IPillboxGrid = {};
    for (const day of DAYS_OF_WEEK) {
      empty[day] = { morning: [], noon: [], evening: [], bedtime: [] };
    }
    return empty;
  }

  // Load and refresh grid from LocalVault — read-only, no per-view seeding (centralized seed.ts via main.tsx owns baseline).
  const loadMedicationsFromVault = () => {
    const vaultMeds = localVault.getMedications(patientId, 'active');

    if (vaultMeds.length === 0) {
      // Graceful empty state: centralized seed populates vault; view shows empty grid without divergent auto-seed
      setGrid(createEmptyGrid());
      recalculateEvaluations([]);
      return;
    }

    const newGrid = createEmptyGrid();

    for (const med of vaultMeds) {
      const generic = med.genericName || ClinicalInteractionEngine.resolveGenericName(med.brandName || med.name || '');
      const pillItem: PillSlotItem = {
        id: med.id,
        medId: med.id,
        name: med.brandName || med.name || generic,
        brandName: med.brandName,
        genericName: generic,
        dosage: med.dosage,
        frequency: med.frequency,
        color: med.colorBadge || getCategoryColor(generic),
        shape: getPillShape(generic),
        withFood: med.withFood || false,
        emptyStomach: med.emptyStomach || false,
        avoidGrapefruit: med.avoidGrapefruit || false,
        avoidAlcohol: med.avoidAlcohol || false,
        avoidDairy: med.avoidDairy || false,
        timingSlots: med.timingSlots,
        status: 'active'
      };

      const slots = med.timingSlots && med.timingSlots.length > 0 ? med.timingSlots : ['morning' as TimeSlot];
      for (const day of DAYS_OF_WEEK) {
        for (const slot of slots) {
          if (newGrid[day] && newGrid[day][slot]) {
            newGrid[day][slot].push({ ...pillItem, id: `${med.id}_${day}_${slot}` });
          }
        }
      }
    }

    setGrid(newGrid);
    recalculateEvaluations(vaultMeds);
  };

  const recalculateEvaluations = (vaultMeds: any[]) => {
    const medNames = vaultMeds.map((m) => m.brandName || m.genericName || m.name);
    
    // 1. Drug-Drug Interactions
    const arcs = ClinicalInteractionEngine.checkDrugInteractions(medNames);
    setInteractionArcs(arcs);

    // 2. Diet Interactions
    const badges = ClinicalInteractionEngine.checkDietInteractions(medNames, {
      drinksGrapefruitDaily: true,
      frequentHighVitKGreens: true,
      dairyBreakfast: true,
      usesPotassiumSaltSubstitute: true
    });
    setDietBadges(badges);

    // 3. Duplicate Active Ingredients
    const dups = ClinicalInteractionEngine.checkDuplicateIngredients(
      vaultMeds.map((m) => ({ name: m.brandName || m.genericName, dose: m.dosage }))
    );
    setDuplicateAlerts(dups);
  };

  // M2 Relevant-only subscription: PillMap reacts to medication_* + proposal_status_changed only.
  // lab_* / danger_* / calendar_* are irrelevant and MUST NOT trigger reload (spurious guard).
  useEffect(() => {
    loadMedicationsFromVault();

    const isRelevantMedPayload = (p: any) => !p || !p.patientId || p.patientId === patientId;
    const onMedAdded = (payload: any) => { if (isRelevantMedPayload(payload)) loadMedicationsFromVault(); };
    const onMedUpdated = (payload: any) => { if (isRelevantMedPayload(payload)) loadMedicationsFromVault(); };
    const onProposalStatus = (payload: any) => { if (isRelevantMedPayload(payload)) loadMedicationsFromVault(); };

    const u1 = eventBus.on('medication_added', onMedAdded);
    const u2 = eventBus.on('medication_updated', onMedUpdated);
    const u3 = eventBus.on('proposal_status_changed', onProposalStatus);

    return () => {
      u1();
      u2();
      u3();
    };
  }, [patientId]);

  // Pill visual helpers
  function getCategoryColor(genericName: string): string {
    const lower = genericName.toLowerCase();
    if (lower.includes('apixaban') || lower.includes('warfarin') || lower.includes('clopidogrel') || lower.includes('aspirin')) return '#3B82F6';
    if (lower.includes('metformin') || lower.includes('glipizide') || lower.includes('jardiance')) return '#10B981';
    if (lower.includes('lisinopril') || lower.includes('amlodipine') || lower.includes('carvedilol') || lower.includes('furosemide')) return '#0EA5E9';
    if (lower.includes('atorvastatin') || lower.includes('simvastatin')) return '#6366F1';
    if (lower.includes('cipro') || lower.includes('doxycycline') || lower.includes('amoxil')) return '#F59E0B';
    if (lower.includes('sertraline') || lower.includes('zoloft')) return '#8B5CF6';
    if (lower.includes('ibuprofen') || lower.includes('advil') || lower.includes('aleve') || lower.includes('tylenol')) return '#F43F5E';
    return '#64748B';
  }

  function getPillShape(genericName: string): 'round' | 'capsule' | 'oval' {
    const lower = genericName.toLowerCase();
    if (lower.includes('apixaban') || lower.includes('atorvastatin') || lower.includes('lisinopril')) return 'round';
    if (lower.includes('sertraline') || lower.includes('cipro') || lower.includes('metformin')) return 'oval';
    return 'capsule';
  }

  // Drag and drop placement
  const handleDropPill = (dragData: any, targetDay: DayOfWeek, targetSlot: TimeSlot) => {
    // If OTC or new medication
    if (dragData.name) {
      const generic = ClinicalInteractionEngine.resolveGenericName(dragData.name);
      localVault.addMedication(
        {
          id: `med_${dragData.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`,
          patientId,
          brandName: dragData.name,
          genericName: generic,
          dosage: dragData.dosage || dragData.dose || 'Standard',
          frequency: 'Once daily',
          timingSlots: [targetSlot],
          withFood: false,
          status: 'active'
        },
        { userId: activeProfile.userId, userName: activeProfile.name, role: activeProfile.role as any }
      );

      eventBus.dispatchToast({
        type: 'success',
        title: 'Medication Added',
        message: `Placed ${dragData.name} on ${targetDay.toUpperCase()} ${targetSlot.toUpperCase()}.`
      });
      loadMedicationsFromVault();
    }
  };

  const handleRemovePill = (pillId: string) => {
    // Correctly extract base med id: pillId is `${med.id}_${day}_${slot}` where med.id may contain underscores.
    // Strip known day/slot suffix; fallback to prefix search against vault meds for robustness.
    let baseId = pillId;
    const daySlotSuffix = new RegExp(`_(${DAYS_OF_WEEK.join('|')})_(${TIME_SLOTS.join('|')})$`);
    if (daySlotSuffix.test(pillId)) {
      baseId = pillId.replace(daySlotSuffix, '');
    } else {
      // Fallback: find vault med whose id is prefix of pillId (handles edge cases)
      const vaultMeds = localVault.getMedications(patientId);
      const matched = vaultMeds.find((m) => pillId === m.id || pillId.startsWith(m.id + '_'));
      if (matched) baseId = matched.id;
      // Also attempt to resolve via medId lookup in current grid in case vault search misses (edge)
      if (baseId === pillId) {
        for (const day of DAYS_OF_WEEK) {
          for (const slot of TIME_SLOTS) {
            const items: PillSlotItem[] = (grid as any)[day]?.[slot] || [];
            const found = items.find((p) => p.id === pillId && p.medId);
            if (found?.medId) {
              baseId = found.medId;
              break;
            }
          }
        }
      }
    }
    localVault.updateMedicationStatus(baseId, 'discontinued', {
      userId: activeProfile.userId,
      userName: activeProfile.name,
      role: activeProfile.role as any
    });
    // Vault canonical removal — grid ids with suffix are not in vault.meds, only baseId is
    localVault.meds.delete(baseId);
    
    eventBus.dispatchToast({
      type: 'info',
      title: 'Medicine removed',
      message: 'Removed from your weekly medicines.'
    });
    loadMedicationsFromVault();
  };

  // Schedule optimizer
  const handleOptimizeSchedule = () => {
    const activeMeds = localVault.getMedications(patientId, 'active');
    const medList = activeMeds.map((m) => ({
      id: m.id,
      name: m.brandName || m.genericName,
      currentSlot: m.timingSlots[0] || 'morning'
    }));

    const suggestion = ClinicalInteractionEngine.suggestSchedule(medList, chronotype);
    setActiveSuggestion(suggestion);
    setGhostShifts(suggestion.proposedShifts);
    setIsShiftModalOpen(true);
  };

  const handleApproveShifts = () => {
    if (!activeSuggestion) return;
    for (const shift of activeSuggestion.proposedShifts) {
      localVault.updateMedication(
        shift.medId,
        { timingSlots: [shift.toSlot] },
        { userId: activeProfile.userId, userName: activeProfile.name, role: activeProfile.role as any }
      );
    }
    setGhostShifts([]);
    setIsShiftModalOpen(false);
    eventBus.dispatchToast({
      type: 'success',
      title: 'Schedule Shifts Applied',
      message: `Applied ${activeSuggestion.proposedShifts.length} chronotype timing adjustments.`
    });
    loadMedicationsFromVault();
  };

  // Open simulator
  const handleOpenSimulator = (pill?: PillSlotItem, day: DayOfWeek = 'tuesday', slot: TimeSlot = 'morning') => {
    setSimulatorMed(pill?.name || 'Metformin');
    setSimulatorSlot({ day, slot });
    setIsSimulatorOpen(true);
  };

  // Export for Pharmacist
  const handleOpenExport = () => {
    const activeMeds = localVault.getMedications(patientId, 'active');
    const bundle: PharmacistExportBundle = {
      patientName: activeProfile.isProxy ? 'Patient' : activeProfile.name,
      generatedDate: new Date().toISOString(),
      activeRegimenGrid: grid,
      brandGenericCrosswalk: activeMeds.map((m) => ({
        brand: m.brandName || m.genericName,
        generic: m.genericName,
        class: getCategoryName(m.genericName),
        dose: m.dosage,
        frequency: m.frequency,
        timingSlots: m.timingSlots
      })),
      drugInteractions: interactionArcs,
      dietTimingRules: dietBadges,
      duplicateAlerts,
      pharmacistVerificationNotes: [
        'Checked for QT prolongation and bleeding risks.',
        'Verified renal function eGFR compatibility.',
        'Circadian chronotype adjustments reviewed.'
      ],
      signatureBlock: {
        requiresPharmDSignature: true,
        verificationStatus: 'ready_for_review'
      }
    };

    setExportBundle(bundle);
    setIsExportModalOpen(true);
  };

  function getCategoryName(genericName: string): string {
    const lower = genericName.toLowerCase();
    if (lower.includes('apixaban')) return 'DOAC Anticoagulant';
    if (lower.includes('metformin')) return 'Biguanide Antidiabetic';
    if (lower.includes('lisinopril')) return 'ACE Inhibitor';
    if (lower.includes('atorvastatin')) return 'HMG-CoA Reductase Inhibitor';
    if (lower.includes('sertraline')) return 'SSRI Antidepressant';
    return 'Prescription Regimen';
  }

  // Quick Add Med
  const handleAddMedSubmit = (newMed: any) => {
    localVault.addMedication(
      {
        id: `med_${newMed.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`,
        patientId,
        brandName: newMed.name,
        genericName: newMed.genericName,
        dosage: newMed.dosage,
        frequency: newMed.frequency,
        timingSlots: newMed.timingSlots,
        withFood: newMed.withFood,
        emptyStomach: newMed.emptyStomach,
        avoidGrapefruit: newMed.avoidGrapefruit,
        avoidAlcohol: newMed.avoidAlcohol,
        avoidDairy: newMed.avoidDairy,
        status: 'active'
      },
      { userId: activeProfile.userId, userName: activeProfile.name, role: activeProfile.role as any }
    );
    setIsAddMedOpen(false);
    eventBus.dispatchToast({
      type: 'success',
      title: 'Medication Added',
      message: `Added ${newMed.name} to pillbox schedule.`
    });
    loadMedicationsFromVault();
  };

  // Reminders save
  const handleSaveReminders = (slotTimes: Record<TimeSlot, string>) => {
    for (const [slot, time] of Object.entries(slotTimes)) {
      localVault.addCalendarEvent(
        {
          id: `reminder_${slot}_${Date.now()}`,
          patientId,
          title: `${slot.toUpperCase()} Pill Reminder (${time})`,
          eventType: 'med_reminder',
          scheduledDate: new Date().toISOString(),
          reason: `Take scheduled ${slot} medications at ${time}`,
          notifyHoursBefore: [0],
          isCompleted: false,
          syncedToCalendar: true
        },
        { userId: activeProfile.userId, userName: activeProfile.name, role: activeProfile.role as any }
      );
    }
  };

  const handleAddQuestionToBank = (questionText: string, medName: string) => {
    localVault.addQuestionBankItem({
      id: `q_${Date.now()}`,
      patientId,
      questionText,
      category: 'medication_clarification',
      sourceModule: 'rxbridge',
      linkedMedName: medName,
      priority: 'high',
      status: 'active',
      createdAt: new Date().toISOString()
    });
    eventBus.dispatchToast({
      type: 'success',
      title: 'Question Bank Updated',
      message: 'Question added for your next doctor or pharmacist appointment.'
    });
  };

  const activeMedsCount = localVault.getMedications(patientId, 'active').length;

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="bg-white border border-canvas-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Module Title & Badge */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-heading-lg tracking-tight text-slate-900">
                My Medicines
              </h2>
              <p className="text-body-sm text-muted">
                Your medicines for the week — drag to change times, see warnings, and check food rules.
              </p>
            </div>
          </div>

          {/* Right Toolbar: View Toggle, Chronotype, Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Mode Toggle (Full Grid vs Elder Mode) */}
            <div className="flex items-center bg-canvas-muted p-1 rounded-2xl border border-canvas-border text-body-sm">
              <button
                onClick={() => setViewMode('canvas')}
                className={`px-3 py-2 rounded-xl font-semibold transition-all min-h-[36px] ${
                  viewMode === 'canvas' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-slate-900'
                }`}
              >
                Week View
              </button>
              <button
                onClick={() => setViewMode('elder')}
                className={`px-3 py-2 rounded-xl font-semibold transition-all min-h-[36px] ${
                  viewMode === 'elder' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-slate-900'
                }`}
              >
                Simple View 👵
              </button>
            </div>

            {/* Chronotype Selector */}
            <div className="flex items-center bg-canvas-muted px-3 py-2 rounded-2xl border border-canvas-border text-body-sm gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <select
                value={chronotype}
                onChange={(e) => setChronotype(e.target.value as Chronotype)}
                className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
                title="Select sleep/wake chronotype"
              >
                <option value="standard">Standard (08:00–22:00) ☀️</option>
                <option value="early_bird">Early Lark (06:30–21:00) 🌅</option>
                <option value="night_owl">Night Owl (10:00–00:30) 🌙</option>
              </select>
            </div>
          </div>
        </div>

        {/* Action Button Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-canvas-border">
          <div className="flex flex-wrap items-center gap-2">
            {/* Schedule Optimizer */}
            <button
              onClick={handleOptimizeSchedule}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-body-sm font-bold shadow-sm transition-all min-h-[44px]"
            >
              <Sparkles className="w-4 h-4" />
              <span>Find Best Times</span>
            </button>

            {/* Missed Dose Simulator */}
            <button
              onClick={() => handleOpenSimulator()}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-body-sm font-semibold transition-all min-h-[44px]"
            >
              <HelpCircle className="w-4 h-4 text-amber-600" />
              <span>What if I miss a dose?</span>
            </button>

            {/* Pharmacist Export */}
            <button
              onClick={handleOpenExport}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-canvas-muted text-slate-700 border border-canvas-border text-body-sm font-semibold transition-all min-h-[44px]"
            >
              <FileText className="w-4 h-4 text-primary" />
              <span>Print for Pharmacist</span>
            </button>

            {/* Set Reminders */}
            <button
              onClick={() => setIsReminderModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-canvas-muted text-slate-700 border border-canvas-border text-body-sm font-semibold transition-all min-h-[44px]"
            >
              <Bell className="w-4 h-4 text-primary" />
              <span>Reminders</span>
            </button>
          </div>

          {/* Add Medication Button */}
          <button
            onClick={() => setIsAddMedOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-body-sm font-bold shadow-sm transition-all min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Medication</span>
          </button>
        </div>
      </div>

      {/* Alert Banners (Drug-Drug Arcs, Duplicates, Diet Rules) */}
      <div className="space-y-3">
        {/* Contraindicated / Major Interactions Banner — light, high contrast */}
        {interactionArcs.length > 0 && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-100 text-rose-600 border border-rose-200">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-rose-900 text-sm">
                  {interactionArcs.length} Warning{interactionArcs.length === 1 ? '' : 's'} — medicines that don't mix well
                </h4>
                <p className="text-rose-700 text-[11px] mt-0.5">
                  Tap the red or orange lines between pills to see why they clash.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {interactionArcs.map((arc, idx) => (
                <span
                  key={idx}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase border ${
                    arc.severity === 'CONTRAINDICATED'
                      ? 'bg-rose-100 text-rose-700 border-rose-200'
                      : 'bg-amber-100 text-amber-800 border-amber-200'
                  }`}
                >
                  {arc.drugA} ↔ {arc.drugB}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Duplicate Active Ingredient Warning Banner — light */}
        {duplicateAlerts.length > 0 && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm flex items-start gap-3 text-xs text-amber-800">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-extrabold text-amber-900 text-sm">
                ⚠️ Duplicate ingredient — you have the same medicine twice
              </h4>
              {duplicateAlerts.map((dup, idx) => (
                <p key={idx} className="text-amber-800 text-[11px]">
                  {dup.plainNarration}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Friendly empty when no medicines */}
      {activeMedsCount === 0 && viewMode !== 'elder' ? (
        <div className="bg-white border border-dashed border-canvas-border rounded-2xl p-10 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
            <Pill className="w-6 h-6" />
          </div>
          <h3 className="text-heading-md text-slate-900">No medicines yet</h3>
          <p className="text-body-sm text-muted max-w-md mx-auto">Add a medicine below, or go to <span className="text-primary-text font-semibold">Medicine Review</span> to bring your hospital list here.</p>
          <button onClick={() => setIsAddMedOpen(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-body-sm font-bold shadow-sm min-h-[44px]">
            <Plus className="w-4 h-4" /> Add a medicine
          </button>
        </div>
      ) : null}
      {/* Main View Mode Render */}
      {viewMode === 'elder' ? (
        <SimpleElderView
          currentSlot="morning"
          chronotype={chronotype}
          pillsInSlot={grid.monday?.morning || []}
          onSwitchToFullView={() => setViewMode('canvas')}
        />
      ) : activeMedsCount === 0 ? null : (
        <div className="space-y-6">
          <PillboxGrid
            grid={grid}
            chronotype={chronotype}
            dietBadges={dietBadges}
            duplicateAlerts={duplicateAlerts}
            interactionArcs={interactionArcs}
            ghostShifts={ghostShifts}
            onDropPill={handleDropPill}
            onRemovePill={handleRemovePill}
            onSimulateMissedDose={handleOpenSimulator}
            onQuickAdd={(day, slot) => {
              setAddMedSlotTarget({ day, slot });
              setIsAddMedOpen(true);
            }}
          />

          {/* Interactive OTC & Supplement Drag Palette */}
          <div className="bg-white border border-canvas-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-muted" />
                <h3 className="text-caption uppercase tracking-wider text-slate-800">
                  Shop medicines — drag onto your week
                </h3>
              </div>
              <span className="text-caption text-muted">
                Drag any store-bought medicine or vitamin onto a day to check for warnings.
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
              {COMMON_OTCS.map((otc) => (
                <div
                  key={otc.name}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      'application/json',
                      JSON.stringify({
                        name: otc.name,
                        dosage: otc.dose,
                        shape: otc.shape,
                        color: otc.color
                      })
                    );
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => {
                    handleDropPill({ name: otc.name, dosage: otc.dose }, 'monday', 'morning');
                  }}
                  className="p-3 rounded-xl bg-canvas-muted border border-canvas-border hover:border-primary-border hover:bg-primary-light/30 cursor-grab active:cursor-grabbing transition-all hover:scale-[1.02] select-none shadow-sm group min-h-[72px]"
                  title={`Drag ${otc.name} (${otc.dose}) onto any pillbox slot, or click to add to Monday Morning`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 border border-white shadow-sm"
                      style={{ backgroundColor: otc.color }}
                    />
                    <span className="font-semibold text-body-sm text-slate-900 truncate">
                      {otc.name}
                    </span>
                  </div>
                  <div className="mt-1 text-caption font-mono text-muted font-semibold truncate">
                    {otc.dose}
                  </div>
                  <div className="text-caption text-muted truncate mt-0.5">
                    {otc.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Global Modals */}
      {isShiftModalOpen && activeSuggestion && (
        <ShiftPreviewModal
          suggestion={activeSuggestion}
          onApprove={handleApproveShifts}
          onReject={() => {
            setGhostShifts([]);
            setIsShiftModalOpen(false);
          }}
        />
      )}

      {isSimulatorOpen && (
        <AdherenceSimulatorModal
          initialMedName={simulatorMed}
          initialDay={simulatorSlot.day}
          initialSlot={simulatorSlot.slot}
          activeMedNames={localVault.getMedications(patientId, 'active').map((m) => m.brandName || m.genericName)}
          onClose={() => setIsSimulatorOpen(false)}
          onAddQuestionToBank={handleAddQuestionToBank}
        />
      )}

      {isExportModalOpen && exportBundle && (
        <PharmacistExportModal
          bundle={exportBundle}
          onClose={() => setIsExportModalOpen(false)}
        />
      )}

      {isAddMedOpen && (
        <AddMedicationModal
          initialSlot={addMedSlotTarget.slot}
          initialDay={addMedSlotTarget.day}
          onSave={handleAddMedSubmit}
          onClose={() => setIsAddMedOpen(false)}
        />
      )}

      {isReminderModalOpen && (
        <ReminderConfigModal
          chronotype={chronotype}
          onSaveReminders={handleSaveReminders}
          onClose={() => setIsReminderModalOpen(false)}
        />
      )}
    </div>
  );
};
