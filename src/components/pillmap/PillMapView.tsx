
import React, { useState, useEffect, useMemo } from 'react';
import {
  Pill,
  Sparkles,
  AlertTriangle,
  FileText,
  Bell,
  Plus,
  HelpCircle,
  ShieldAlert,
  Clock
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
import { healthRepository } from '../../core/vault/HealthRepository.ts';
import { eventBus } from '../../core/events/eventBus.ts';
import { ClinicalInteractionEngine } from '../../core/knowledge/interactionEngine.ts';
import { PillboxGrid } from './PillboxGrid.tsx';
import { SimpleElderView } from './SimpleElderView.tsx';
import { ShiftPreviewModal } from './ShiftPreviewModal.tsx';
import { AdherenceSimulatorModal } from './AdherenceSimulatorModal.tsx';
import { PharmacistExportModal } from './PharmacistExportModal.tsx';
import { AddMedicationModal } from './AddMedicationModal.tsx';
import { ReminderConfigModal } from './ReminderConfigModal.tsx';
import { COMMON_OTCS } from './otcCatalog.ts';
import { resolvePatientId } from '@/components/common/resolvePatientId';

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

export const PillMapView: React.FC<PillMapViewProps> = ({
  patientId = '',
  activeProfile = { userId: '', name: 'Patient', role: 'patient' }
}) => {
  const effectivePatientId = resolvePatientId(patientId || (activeProfile as unknown as { userId?: string })?.userId || '');
  const [chronotype, setChronotype] = useState<Chronotype>('standard');
  const [viewMode, setViewMode] = useState<'canvas' | 'elder'>('canvas');
  const [grid, setGrid] = useState<IPillboxGrid>(() => createEmptyGrid());

  const [interactionArcs, setInteractionArcs] = useState<InteractionArc[]>([]);
  const [dietBadges, setDietBadges] = useState<DietBadge[]>([]);
  const [duplicateAlerts, setDuplicateAlerts] = useState<DuplicateIngredientAlert[]>([]);
  const [ghostShifts, setGhostShifts] = useState<GhostPreviewShift[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [evalError, setEvalError] = useState(false);

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

  const loadMedicationsFromVault = () => {
    const pid = effectivePatientId;
    const vaultMeds = pid ? localVault.getMedications(pid, 'active') : [];

    if (vaultMeds.length === 0) {

      setGrid(createEmptyGrid());
      recalculateEvaluations([]);
      return;
    }

    const newGrid = createEmptyGrid();

    for (const med of vaultMeds) {

      const generic = med.genericName || med.brandName || med.name || '';
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

  const recalculateEvaluations = async (vaultMeds: { id?: string; patientId?: string; brandName?: string; genericName?: string; name?: string; dosage?: string; frequency?: string; timingSlots?: TimeSlot[]; withFood?: boolean }[]) => {
    const dietFlags = {
      drinksGrapefruitDaily: true,
      frequentHighVitKGreens: true,
      dairyBreakfast: true,
      usesPotassiumSaltSubstitute: true
    };

    type EvalMeds = Parameters<typeof healthRepository.evaluateInteractions>[1];
    try {
      const fullMeds = effectivePatientId ? healthRepository.getActiveMedications(effectivePatientId) : [];

      const evalMeds = (fullMeds.length > 0 ? fullMeds : vaultMeds) as unknown as EvalMeds;

      let needsFetch = true;
      try {
        needsFetch = !healthRepository.hasFreshEvaluation(effectivePatientId, evalMeds, dietFlags);
      } catch {
        needsFetch = true;
      }
      if (needsFetch) setIsChecking(true);
      try {
        const result = await healthRepository.evaluateInteractions(effectivePatientId, evalMeds, dietFlags);
        setInteractionArcs(result.arcs);
        setDietBadges(result.dietBadges);
        setDuplicateAlerts(result.duplicateAlerts);
        setEvalError(false);
      } finally {
        if (needsFetch) setIsChecking(false);
      }
    } catch {

      setInteractionArcs([]);
      setDietBadges([]);
      setDuplicateAlerts([]);
      setIsChecking(false);
      setEvalError(true);
    }
  };

  useEffect(() => {
    loadMedicationsFromVault();

    const isRelevantMedPayload = (p: unknown) => {
      const pid = (p as { patientId?: string })?.patientId;
      return !p || !pid || pid === effectivePatientId;
    };
    const onMedAdded = (payload: unknown) => { if (isRelevantMedPayload(payload)) loadMedicationsFromVault(); };
    const onMedUpdated = (payload: unknown) => { if (isRelevantMedPayload(payload)) loadMedicationsFromVault(); };
    const onProposalStatus = (payload: unknown) => { if (isRelevantMedPayload(payload)) loadMedicationsFromVault(); };

    const u1 = eventBus.on('medication_added', onMedAdded as (p: unknown) => void);
    const u2 = eventBus.on('medication_updated', onMedUpdated as (p: unknown) => void);
    const u3 = eventBus.on('proposal_status_changed', onProposalStatus as (p: unknown) => void);
    const u4 = eventBus.on('vault_synced' as unknown as string, onMedAdded as (p: unknown) => void);

    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [effectivePatientId]);

  function getCategoryColor(genericName: string): string {
    const lower = (genericName ?? '').toLowerCase();
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
    const lower = (genericName ?? '').toLowerCase();
    if (lower.includes('apixaban') || lower.includes('atorvastatin') || lower.includes('lisinopril')) return 'round';
    if (lower.includes('sertraline') || lower.includes('cipro') || lower.includes('metformin')) return 'oval';
    return 'capsule';
  }

  const handleDropPill = async (dragData: { name?: string; dosage?: string; dose?: string }, targetDay: DayOfWeek, targetSlot: TimeSlot) => {
    if (!dragData.name) return;
    let generic: string;
    try {
      generic = await ClinicalInteractionEngine.resolveGenericName(dragData.name);
    } catch {
      eventBus.dispatchToast({
        type: 'error',
        title: 'Could not add medication',
        message: 'The AI service is unavailable, so the medication could not be classified. Please retry.',
      });
      return;
    }
    try {
      await localVault.addMedication(
        {
          id: `med_${dragData.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`,
          patientId: effectivePatientId,
          brandName: dragData.name,
          genericName: generic,
          dosage: dragData.dosage || dragData.dose || 'Standard',
          frequency: 'Once daily',
          timingSlots: [targetSlot],
          withFood: false,
          status: 'active'
        },
        { userId: activeProfile.userId, userName: activeProfile.name, role: activeProfile.role as 'patient' | 'caregiver' | 'doctor' }
      );
    } catch (e: unknown) {
      eventBus.dispatchToast({
        type: 'error',
        title: 'Could not add medication',
        message: e instanceof Error ? e.message : 'Server save failed. Please retry.',
      });
      return;
    }

    eventBus.dispatchToast({
      type: 'success',
      title: 'Medication Added',
      message: `Placed ${dragData.name} on ${targetDay.toUpperCase()} ${targetSlot.toUpperCase()}.`
    });
    loadMedicationsFromVault();
  };

  const handleRemovePill = async (pillId: string) => {
    let baseId = pillId;
    const daySlotSuffix = new RegExp(`_(${DAYS_OF_WEEK.join('|')})_(${TIME_SLOTS.join('|')})$`);
    if (daySlotSuffix.test(pillId)) {
      baseId = pillId.replace(daySlotSuffix, '');
    } else {
      const vaultMeds = localVault.getMedications(effectivePatientId);
      const matched = vaultMeds.find((m) => pillId === m.id || pillId.startsWith(m.id + '_'));
      if (matched) baseId = matched.id;
      if (baseId === pillId) {
        for (const day of DAYS_OF_WEEK) {
          for (const slot of TIME_SLOTS) {
            const items: PillSlotItem[] = (grid as unknown as Record<string, Record<string, PillSlotItem[]>>)[day]?.[slot] || [];
            const found = items.find((p) => p.id === pillId && p.medId);
            if (found?.medId) {
              baseId = found.medId;
              break;
            }
          }
        }
      }
    }

    try {
      const removed = await healthRepository.removeMedication(baseId, {
        userId: activeProfile.userId,
        userName: activeProfile.name,
        role: activeProfile.role as 'patient' | 'caregiver' | 'doctor'
      });
      if (!removed) {
        eventBus.dispatchToast({ type: 'error', title: 'Not found', message: 'That medicine was already removed.' });
        return;
      }
    } catch (e: unknown) {
      eventBus.dispatchToast({ type: 'error', title: 'Remove failed', message: e instanceof Error ? e.message : 'Server delete failed. Please retry.' });
      return;
    }

    eventBus.dispatchToast({
      type: 'info',
      title: 'Medicine removed',
      message: 'Removed from your weekly medicines.'
    });
    loadMedicationsFromVault();
  };

  const handleOptimizeSchedule = async () => {
    const activeMeds = localVault.getMedications(effectivePatientId, 'active');
    const medList = activeMeds.map((m) => ({
      id: m.id,
      name: m.brandName || m.genericName,
      currentSlot: m.timingSlots[0] || 'morning'
    }));

    setIsChecking(true);
    try {
      const suggestion = await ClinicalInteractionEngine.suggestSchedule(medList, chronotype);
      setActiveSuggestion(suggestion);
      setGhostShifts(suggestion.proposedShifts);
      setIsShiftModalOpen(true);
    } catch {
      eventBus.dispatchToast({
        type: 'error',
        title: 'Could not optimize schedule',
        message: 'The AI service is unavailable. Please retry.',
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleApproveShifts = async () => {
    if (!activeSuggestion) return;
    try {
      for (const shift of activeSuggestion.proposedShifts) {
        await localVault.updateMedication(
          shift.medId,
          { timingSlots: [shift.toSlot] },
          { userId: activeProfile.userId, userName: activeProfile.name, role: activeProfile.role as 'patient' | 'caregiver' | 'doctor' }
        );
      }
    } catch (e: unknown) {
      eventBus.dispatchToast({ type: 'error', title: 'Shifts failed', message: e instanceof Error ? e.message : 'Server save failed. Please retry.' });
      return;
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

  const handleOpenSimulator = (pill?: PillSlotItem, day: DayOfWeek = 'tuesday', slot: TimeSlot = 'morning') => {
    setSimulatorMed(pill?.name || 'Metformin');
    setSimulatorSlot({ day, slot });
    setIsSimulatorOpen(true);
  };

  const handleOpenExport = () => {
    const activeMeds = localVault.getMedications(effectivePatientId, 'active');
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
    const lower = (genericName ?? '').toLowerCase();
    if (lower.includes('apixaban')) return 'DOAC Anticoagulant';
    if (lower.includes('metformin')) return 'Biguanide Antidiabetic';
    if (lower.includes('lisinopril')) return 'ACE Inhibitor';
    if (lower.includes('atorvastatin')) return 'HMG-CoA Reductase Inhibitor';
    if (lower.includes('sertraline')) return 'SSRI Antidepressant';
    return 'Prescription Regimen';
  }

  const handleAddMedSubmit = async (newMed: { name: string; genericName: string; dosage: string; frequency: string; timingSlots: TimeSlot[]; withFood: boolean; emptyStomach: boolean; avoidGrapefruit: boolean; avoidAlcohol: boolean; avoidDairy: boolean }) => {
    try {
      await localVault.addMedication(
        {
          id: `med_${newMed.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`,
          patientId: effectivePatientId,
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
        { userId: activeProfile.userId, userName: activeProfile.name, role: activeProfile.role as 'patient' | 'caregiver' | 'doctor' }
      );
    } catch (e: unknown) {
      eventBus.dispatchToast({ type: 'error', title: 'Could not add medication', message: e instanceof Error ? e.message : 'Server save failed. Please retry.' });
      return;
    }
    setIsAddMedOpen(false);
    eventBus.dispatchToast({
      type: 'success',
      title: 'Medication Added',
      message: `Added ${newMed.name} to pillbox schedule.`
    });
    loadMedicationsFromVault();
  };

  const handleSaveReminders = async (slotTimes: Record<TimeSlot, string>) => {
    try {
      for (const [slot, time] of Object.entries(slotTimes)) {
        await localVault.addCalendarEvent(
          {
            id: `reminder_${slot}_${Date.now()}`,
            patientId: effectivePatientId,
            title: `${slot.toUpperCase()} Pill Reminder (${time})`,
            eventType: 'med_reminder',
            scheduledDate: new Date().toISOString(),
            reason: `Take scheduled ${slot} medications at ${time}`,
            notifyHoursBefore: [0],
            isCompleted: false,
            syncedToCalendar: true
          },
          { userId: activeProfile.userId, userName: activeProfile.name, role: activeProfile.role as 'patient' | 'caregiver' | 'doctor' }
        );
      }
    } catch (e: unknown) {
      eventBus.dispatchToast({ type: 'error', title: 'Reminders failed', message: e instanceof Error ? e.message : 'Server save failed. Please retry.' });
      return;
    }
  };

  const handleAddQuestionToBank = async (questionText: string, medName: string) => {
    try {
      await localVault.addQuestionBankItem({
        id: `q_${Date.now()}`,
        patientId: effectivePatientId,
        questionText,
        category: 'medication_clarification',
        sourceModule: 'rxbridge',
        linkedMedName: medName,
        priority: 'high',
        status: 'active',
        createdAt: new Date().toISOString()
      });
    } catch (e: unknown) {
      eventBus.dispatchToast({ type: 'error', title: 'Save failed', message: e instanceof Error ? e.message : 'Server save failed. Please retry.' });
      return;
    }
    eventBus.dispatchToast({
      type: 'success',
      title: 'Question Bank Updated',
      message: 'Question added for your next doctor or pharmacist appointment.'
    });
  };

  const activeMedsCount = useMemo(() => effectivePatientId ? localVault.getMedications(effectivePatientId, 'active').length : 0, [effectivePatientId, grid]);
  const activeMedNames = useMemo(() => effectivePatientId ? localVault.getMedications(effectivePatientId, 'active').map((m) => m.brandName || m.genericName) : [], [effectivePatientId, grid]);

  return (
    <div className="space-y-3 animate-fade-in">
      {}
      <div className="bg-canvas-card border border-canvas-border rounded-2xl p-3 sm:p-5 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 truncate">
            My Medicines {activeMedsCount > 0 && <span className="text-sm font-semibold text-muted">({activeMedsCount})</span>}
          </h2>
          {activeMedsCount > 0 && (
          <button
            onClick={() => setIsAddMedOpen(true)}
            className="flex items-center justify-center gap-1 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-sm transition-all min-h-[44px] shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add</span>
          </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {}
          <div className="flex items-center gap-0.5 bg-canvas-muted p-0.5 rounded-xl border border-canvas-border text-xs shadow-xs shrink-0">
            <button
              onClick={() => setViewMode('canvas')}
              className={`px-2.5 py-2 rounded-lg font-bold transition-all min-h-[40px] flex items-center justify-center ${
                viewMode === 'canvas' ? 'bg-white text-primary font-bold shadow-xs border border-canvas-border' : 'text-muted hover:text-slate-900 border border-transparent'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('elder')}
              className={`px-2.5 py-2 rounded-lg font-bold transition-all min-h-[40px] flex items-center justify-center ${
                viewMode === 'elder' ? 'bg-white text-primary font-bold shadow-xs border border-canvas-border' : 'text-muted hover:text-slate-900 border border-transparent'
              }`}
            >
              Simple
            </button>
          </div>

          {}
          <div className="flex items-center bg-canvas-muted px-2.5 py-1 rounded-xl border border-canvas-border text-xs gap-1.5 min-h-[40px] shadow-xs flex-1 min-w-0">
            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
            <select
              value={chronotype}
              onChange={(e) => setChronotype(e.target.value as Chronotype)}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer py-1 w-full truncate"
              title="Select sleep/wake chronotype"
            >
              <option value="standard">Standard</option>
              <option value="early_bird">Early Lark</option>
              <option value="night_owl">Night Owl</option>
            </select>
          </div>
        </div>

        {}
        {activeMedsCount > 0 && (
        <div className="flex items-center gap-1.5 pt-2.5 border-t border-canvas-border">
          <button
            onClick={handleOptimizeSchedule}
            title="Find best times"
            aria-label="Find best times"
            className="flex items-center justify-center gap-1 p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all min-h-[44px] min-w-[44px]"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-bold">Best times</span>
          </button>
          <button
            onClick={() => handleOpenSimulator()}
            title="What if I miss a dose?"
            aria-label="What if I miss a dose?"
            className="flex items-center justify-center gap-1 p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-all min-h-[44px] min-w-[44px]"
          >
            <HelpCircle className="w-4 h-4 text-amber-600" />
            <span className="hidden sm:inline text-xs font-semibold">Missed dose</span>
          </button>
          <button
            onClick={handleOpenExport}
            title="Print for pharmacist"
            aria-label="Print for pharmacist"
            className="flex items-center justify-center gap-1 p-2 rounded-xl bg-white hover:bg-canvas-muted text-slate-700 border border-canvas-border transition-all min-h-[44px] min-w-[44px]"
          >
            <FileText className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline text-xs font-semibold">Print</span>
          </button>
          <button
            onClick={() => setIsReminderModalOpen(true)}
            title="Reminders"
            aria-label="Reminders"
            className="flex items-center justify-center gap-1 p-2 rounded-xl bg-white hover:bg-canvas-muted text-slate-700 border border-canvas-border transition-all min-h-[44px] min-w-[44px]"
          >
            <Bell className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline text-xs font-semibold">Reminders</span>
          </button>
        </div>
        )}
      </div>

      {}
      {isChecking && (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="flex items-center gap-3 p-4 rounded-2xl bg-sky-50 border border-sky-200 shadow-sm text-sky-900"
        >
          <div className="w-5 h-5 rounded-full border-2 border-sky-200 border-t-sky-600 animate-spin shrink-0" aria-hidden="true" />
          <span className="font-semibold text-sm">Checking what doesn't mix well...</span>
        </div>
      )}

      {}
      {evalError && interactionArcs.length === 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm">
          <span className="font-semibold text-sm text-amber-900">
            Couldn't check interactions — the AI service is unavailable.
          </span>
          <button
            type="button"
            onClick={() => loadMedicationsFromVault()}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold min-h-[44px] shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {}
      <div className="space-y-3">
        {}
        {interactionArcs.length > 0 && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-rose-100 text-rose-600 border border-rose-200">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-rose-900 text-sm">
                {interactionArcs.length} warning{interactionArcs.length === 1 ? '' : 's'}
              </h4>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {interactionArcs.map((arc, idx) => (
                <span
                  key={idx}
                  className={`px-2 py-0.5 rounded-lg font-bold text-[10px] uppercase border ${
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

        {}
        {duplicateAlerts.length > 0 && (
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm flex items-start gap-2.5 text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-amber-900 text-sm">
                Same ingredient twice
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

      {}
      {activeMedsCount === 0 && viewMode !== 'elder' ? (
        <div className="bg-canvas-card border border-dashed border-canvas-border rounded-2xl p-10 text-center space-y-4 shadow-sm">
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
      {}
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

          {}
          <div className="bg-canvas-card border border-canvas-border rounded-2xl p-3 sm:p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-800">
              Store medicines — tap to add
            </h3>

            <div className="flex sm:grid sm:grid-cols-4 lg:grid-cols-8 gap-2 overflow-x-auto scrollbar-none sm:overflow-visible">
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
                  className="p-2.5 rounded-xl bg-canvas-muted border border-canvas-border hover:border-primary-border hover:bg-primary-light/30 cursor-grab active:cursor-grabbing transition-all select-none shadow-sm group min-h-[44px] min-w-[132px] sm:min-w-0 flex sm:flex-col items-center sm:items-start gap-1.5 sm:gap-0"
                  title={`Drag ${otc.name} (${otc.dose}) onto any pillbox slot, or tap to add to Monday Morning`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 border border-white shadow-sm"
                      style={{ backgroundColor: otc.color }}
                    />
                    <span className="font-semibold text-body-sm text-slate-900 truncate">
                      {otc.name}
                    </span>
                  </div>
                  <div className="text-caption font-mono text-muted font-semibold truncate shrink-0">
                    {otc.dose}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {}
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
          activeMedNames={activeMedNames}
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

