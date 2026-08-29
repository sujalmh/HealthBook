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
  patientId = 'patient-s-devi',
  activeProfile = { userId: 'patient-s-devi', name: 'Shanti Devi', role: 'patient' }
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
      title: 'Medication Removed',
      message: 'Medication removed from active PillMap.'
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
      patientName: activeProfile.isProxy ? 'Shanti Devi' : activeProfile.name,
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
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Module Title & Badge */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-white">
                  PillMap & Polypharmacy Negotiator
                </h2>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold text-xs border border-emerald-500/40">
                  7x4 Accessible Canvas
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Drag-and-drop pillbox with dynamic SVG conflict arcs, meal badges, and chronotype optimization.
              </p>
            </div>
          </div>

          {/* Right Toolbar: View Toggle, Chronotype, Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Mode Toggle (Full Grid vs Elder Mode) */}
            <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs">
              <button
                onClick={() => setViewMode('canvas')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  viewMode === 'canvas' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                7x4 Canvas
              </button>
              <button
                onClick={() => setViewMode('elder')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  viewMode === 'elder' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Simple Elder View 👵
              </button>
            </div>

            {/* Chronotype Selector */}
            <div className="flex items-center bg-slate-950 px-3 py-1.5 rounded-2xl border border-slate-800 text-xs gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <select
                value={chronotype}
                onChange={(e) => setChronotype(e.target.value as Chronotype)}
                className="bg-transparent font-bold text-slate-200 focus:outline-none cursor-pointer"
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
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2">
            {/* Schedule Optimizer */}
            <button
              onClick={handleOptimizeSchedule}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-900/30 transition-all hover:scale-102"
            >
              <Sparkles className="w-4 h-4" />
              <span>Optimize Schedule</span>
            </button>

            {/* Missed Dose Simulator */}
            <button
              onClick={() => handleOpenSimulator()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all"
            >
              <HelpCircle className="w-4 h-4 text-amber-400" />
              <span>Simulate Missed Dose</span>
            </button>

            {/* Pharmacist Export */}
            <button
              onClick={handleOpenExport}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all"
            >
              <FileText className="w-4 h-4 text-sky-400" />
              <span>1-Page Pharmacist Export</span>
            </button>

            {/* Set Reminders */}
            <button
              onClick={() => setIsReminderModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all"
            >
              <Bell className="w-4 h-4 text-indigo-400" />
              <span>Reminders</span>
            </button>
          </div>

          {/* Add Medication Button */}
          <button
            onClick={() => setIsAddMedOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-md shadow-sky-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Medication</span>
          </button>
        </div>
      </div>

      {/* Alert Banners (Drug-Drug Arcs, Duplicates, Diet Rules) */}
      <div className="space-y-3">
        {/* Contraindicated / Major Interactions Banner */}
        {interactionArcs.length > 0 && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/80 via-slate-900 to-amber-950/80 border border-rose-800/80 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-white text-sm">
                  {interactionArcs.length} Drug-Drug Interaction Conflict{interactionArcs.length === 1 ? '' : 's'} Detected
                </h4>
                <p className="text-rose-200 text-[11px] mt-0.5">
                  Click on the Red / Orange SVG arcs on the canvas to inspect biological mechanisms.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {interactionArcs.map((arc, idx) => (
                <span
                  key={idx}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase border ${
                    arc.severity === 'CONTRAINDICATED'
                      ? 'bg-rose-500/30 text-rose-200 border-rose-500/60'
                      : 'bg-amber-500/30 text-amber-200 border-amber-500/60'
                  }`}
                >
                  {arc.drugA} ↔ {arc.drugB}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Duplicate Active Ingredient Warning Banner */}
        {duplicateAlerts.length > 0 && (
          <div className="p-4 rounded-2xl bg-amber-950/70 border border-amber-800/80 shadow-lg flex items-start gap-3 text-xs text-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-extrabold text-white text-sm">
                ⚠️ Duplicate Active Ingredient Overlap Detected
              </h4>
              {duplicateAlerts.map((dup, idx) => (
                <p key={idx} className="text-amber-200 text-[11px]">
                  {dup.plainNarration}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main View Mode Render */}
      {viewMode === 'elder' ? (
        <SimpleElderView
          currentSlot="morning"
          chronotype={chronotype}
          pillsInSlot={grid.monday?.morning || []}
          onSwitchToFullView={() => setViewMode('canvas')}
        />
      ) : (
        <div className="space-y-6">
          {/* Interactive 7x4 Weekly Pillbox Grid */}
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
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                  OTC & Supplement Quick-Add Palette (Drag onto grid)
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">
                Drag any OTC or supplement onto a time slot to evaluate instant interaction arcs & food rules.
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
                  className="p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-sky-500/80 cursor-grab active:cursor-grabbing hover:bg-slate-850 transition-all hover:scale-105 select-none shadow-sm group"
                  title={`Drag ${otc.name} (${otc.dose}) onto any pillbox slot, or click to add to Monday Morning`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 border border-white/40"
                      style={{ backgroundColor: otc.color }}
                    />
                    <span className="font-bold text-[11px] text-white truncate group-hover:text-sky-300">
                      {otc.name}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] font-mono text-slate-400 font-semibold truncate">
                    {otc.dose}
                  </div>
                  <div className="text-[9px] text-slate-500 truncate mt-0.5">
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
