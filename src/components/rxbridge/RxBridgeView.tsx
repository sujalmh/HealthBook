/**
 * CareCanvas Component: RxBridgeView
 * Main module container for Milestone 4 (RxBridge Post-Discharge 3-List Reconciliation).
 * Features:
 * - 3-list comparative overview
 * - Quick-fill sample discharge cases (Shanti Devi / Harold Jenkins)
 * - Conversational med-by-med walkthrough wizard
 * - Interactive Teach-Back comprehension validation
 * - 1-Page printable/downloadable discharge summary export
 * - Cross-module handoff to PillMap Day 0 schedule & LocalVault meds.
 */

import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  Sparkles,
  ShieldCheck,
  Printer,
  ArrowRight,
  Bot,
  Layers,
  Table as TableIcon,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Pill,
  Send,
  Calendar,
  RotateCcw
} from 'lucide-react';
import type {
  Patient3ListDischargeDataset,
  ReconciledMedChangeItem,
  TeachBackCheck,
  PatientHomeSummaryExport
} from '../../types/rxbridge.ts';
import {
  mockShantiDevi3ListDataset,
  mockHaroldJenkins3ListDataset
} from '../../fixtures/discharge_lists.ts';
import { ClinicalReconciliationEngine } from '../../core/knowledge/reconciliationEngine.ts';
import { localVault } from '../../core/vault/LocalVault.ts';
import { eventBus } from '../../core/events/eventBus.ts';
import { ThreeListTable } from './ThreeListTable.tsx';
import { ReconciliationWalk } from './ReconciliationWalk.tsx';
import { TeachBackModal } from './TeachBackModal.tsx';
import { SummaryExportModal } from './SummaryExportModal.tsx';
import { ChangeBadge } from './ChangeBadge.tsx';

export interface RxBridgeViewProps {
  patientId?: string;
  activeProfile?: {
    userId: string;
    name: string;
    role: string;
    isProxy?: boolean;
    relationship?: string;
  };
}

export const RxBridgeView: React.FC<RxBridgeViewProps> = ({
  patientId = 'patient-s-devi',
  activeProfile = { userId: 'patient-s-devi', name: 'Shanti Devi', role: 'patient' }
}) => {
  // Case selection
  const [selectedCaseId, setSelectedCaseId] = useState<'shanti' | 'jenkins'>('shanti');
  const [activeDataset, setActiveDataset] = useState<Patient3ListDischargeDataset>(mockShantiDevi3ListDataset);

  // Reconciliation state
  const [reconciledItems, setReconciledItems] = useState<ReconciledMedChangeItem[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'walk'>('table');
  const [walkIndex, setWalkIndex] = useState(0);

  // Modals state
  const [isTeachBackOpen, setIsTeachBackOpen] = useState(false);
  const [teachBackRecord, setTeachBackRecord] = useState<TeachBackCheck | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [summaryData, setSummaryData] = useState<PatientHomeSummaryExport | null>(null);

  // Load and reconcile data
  const loadReconciliation = (dataset: Patient3ListDischargeDataset) => {
    const items = ClinicalReconciliationEngine.reconcileThreeLists(dataset);
    setReconciledItems(items);
    setWalkIndex(0);
    setTeachBackRecord(null);
  };

  useEffect(() => {
    const dataset = selectedCaseId === 'shanti' ? mockShantiDevi3ListDataset : mockHaroldJenkins3ListDataset;
    setActiveDataset(dataset);
    loadReconciliation(dataset);
  }, [selectedCaseId]);

  // M2 Relevant-only: RxBridge listens to proposal_created/status_changed (alias proposal_submitted), lab_added (alias lab_extracted, eGFR flag), medication_added/updated
  // medication adds outside RxBridge (e.g., PillMap) should refresh flags; irrelevant like danger_report/calendar filtered out
  // Alias dispatch covers legacy names without double. Handlers trigger reconciler recompute guarded by patientId.
  useEffect(() => {
    const guard = (p: any) => !p || !p.patientId || p.patientId === patientId;
    const onProposal = (payload: any) => { if (guard(payload)) loadReconciliation(activeDataset); };
    const onLab = (payload: any) => { if (guard(payload)) loadReconciliation(activeDataset); };
    const onMed = (payload: any) => { if (guard(payload)) loadReconciliation(activeDataset); };

    const u1 = eventBus.on('proposal_created', onProposal);
    const u2 = eventBus.on('proposal_status_changed', onProposal);
    const u3 = eventBus.on('lab_added', onLab);
    const u4 = eventBus.on('medication_added', onMed);
    const u5 = eventBus.on('medication_updated', onMed);

    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [patientId, activeDataset]);

  // Handle Per-Med Approval
  const handleToggleApproval = (medId: string) => {
    setReconciledItems((prev) =>
      prev.map((item) => {
        if (item.medId === medId) {
          const newStatus = !item.isApprovedByPatient;
          return { ...item, isApprovedByPatient: newStatus };
        }
        return item;
      })
    );
  };

  const handleApproveMedInWalk = (medId: string) => {
    setReconciledItems((prev) =>
      prev.map((item) => {
        if (item.medId === medId) {
          return { ...item, isApprovedByPatient: true };
        }
        return item;
      })
    );
    eventBus.dispatchToast({
      type: 'success',
      title: 'Medication Approved',
      message: 'Medication change verified and marked for Day 0 home schedule.'
    });
  };

  const handleApproveAll = () => {
    setReconciledItems((prev) => prev.map((item) => ({ ...item, isApprovedByPatient: true })));
    eventBus.dispatchToast({
      type: 'success',
      title: 'All Medications Approved',
      message: 'All post-discharge medication items marked as approved.'
    });
  };

  const handleUpdateNote = (medId: string, note: string) => {
    setReconciledItems((prev) =>
      prev.map((item) => (item.medId === medId ? { ...item, patientComment: note } : item))
    );
    eventBus.dispatchToast({
      type: 'info',
      title: 'Note Saved',
      message: 'Personal note attached to medication reconciliation record.'
    });
  };

  const handleAskDoctor = (medName: string, questionText: string) => {
    localVault.addQuestionBankItem({
      id: `q_recon_${Date.now()}`,
      patientId,
      questionText,
      category: 'medication_change',
      sourceModule: 'rxbridge',
      linkedMedName: medName,
      priority: 'high',
      status: 'active',
      createdAt: new Date().toISOString()
    });

    eventBus.dispatchToast({
      type: 'success',
      title: 'Question Added to Bank',
      message: `"${questionText.slice(0, 45)}..." added for your follow-up appointment.`
    });
  };

  // Open 1-Page Export Summary
  const handleOpenExportSummary = () => {
    const questions = localVault.getQuestions(patientId).map((q) => q.questionText);
    const summary = ClinicalReconciliationEngine.compilePatientSummary(activeDataset, questions, 'en');
    setSummaryData(summary);
    setIsExportModalOpen(true);
  };

  // Cross-Module Bridge: Finalize & Populate PillMap Day 0 Schedule — RB4 approval gate + RB9 diet-aware Day 0
  const handleFinalizeAndHandoffToPillMap = () => {
    // RB4 Approval Gate (trivial fix): block finalize unless 100% of reconciliation items approved
    const approvedCount = reconciledItems.filter((i) => i.isApprovedByPatient).length;
    const total = reconciledItems.length;
    if (approvedCount !== total) {
      eventBus.dispatchToast({
        type: 'error',
        title: 'Approval Required',
        message: `Please approve all ${total} medication changes before finalizing. Currently ${approvedCount}/${total} approved. Use Approve per med or Approve All in the walkthrough.`
      });
      return;
    }

    // RB9: diet-aware Day 0 handoff — process all discharge medications into LocalVault meds + slot reminders
    const activeDischargeMeds = activeDataset.dischargeMeds.filter((d) => d.status !== 'STOPPED');
    const stoppedMeds = activeDataset.dischargeMeds.filter((d) => d.status === 'STOPPED');

    // Add active discharge meds
    for (const d of activeDischargeMeds) {
      const generic = ClinicalReconciliationEngine.determineStatusBadge(undefined, undefined, d.dose) === 'NEW'
        ? d.medName
        : d.medName;

      localVault.addMedication(
        {
          id: `med_${d.medName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`,
          patientId,
          brandName: d.medName,
          genericName: d.medName,
          dosage: d.dose,
          frequency: d.frequency,
          timingSlots: d.timingSlots || ['morning'],
          withFood: d.dietInstructions?.toLowerCase().includes('food') || d.dietInstructions?.toLowerCase().includes('meal') || false,
          emptyStomach: d.dietInstructions?.toLowerCase().includes('empty') || false,
          avoidGrapefruit: d.dietInstructions?.toLowerCase().includes('grapefruit') || false,
          status: 'active',
          indication: d.reason
        },
        { userId: activeProfile.userId, userName: activeProfile.name, role: activeProfile.role as any }
      );
    }

    // Mark stopped meds
    for (const s of stoppedMeds) {
      const existing = localVault.getMedications(patientId).find(
        (m) => m.genericName.toLowerCase().includes(s.medName.toLowerCase()) || (m.brandName && m.brandName.toLowerCase().includes(s.medName.toLowerCase()))
      );
      if (existing) {
        localVault.updateMedicationStatus(existing.id, 'stopped', {
          userId: activeProfile.userId,
          userName: activeProfile.name,
          role: activeProfile.role as any
        });
      }
    }

    // RB9: Register diet-aware slot reminders via set_reminder semantics (calendar events grouped by slot time)
    const slotTimeMap: Record<string, string> = {};
    const defaultTimes: Record<string, string> = { morning: '08:00', noon: '12:00', evening: '18:00', bedtime: '22:00' };
    const activeSlots = new Set<string>();
    for (const d of activeDischargeMeds) {
      for (const s of (d.timingSlots || ['morning'])) activeSlots.add(s);
    }
    for (const slot of activeSlots) {
      slotTimeMap[slot] = defaultTimes[slot] || '08:00';
      // Diet-aware annotation for empty-stomach / grapefruit avoidance is persisted on MedicationRecord; reminder reason carries it
      const slotMeds = activeDischargeMeds.filter((d) => (d.timingSlots || ['morning']).includes(slot as any));
      const dietNotes = slotMeds
        .map((m) => m.dietInstructions)
        .filter(Boolean)
        .join('; ');
      localVault.addCalendarEvent(
        {
          id: `reminder_${slot}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          patientId,
          title: `${slot.toUpperCase()} Meds Reminder (${slotTimeMap[slot]})`,
          eventType: 'med_reminder',
          scheduledDate: new Date().toISOString(),
          reason: dietNotes ? `Take ${slot} meds at ${slotTimeMap[slot]} — ${dietNotes}` : `Take scheduled ${slot} medications at ${slotTimeMap[slot]}`,
          notifyHoursBefore: [0],
          isCompleted: false,
          syncedToCalendar: true
        },
        { userId: activeProfile.userId, userName: activeProfile.name, role: activeProfile.role as any }
      );
    }

    // Emit event so PillMap re-evaluates (INT2) — include patientId for relevant-only filtering
    eventBus.emit('medication_added', { patientId, source: 'rxbridge_reconciliation' });

    eventBus.dispatchToast({
      type: 'success',
      title: 'My Medicines Updated!',
      message: `Added ${activeDischargeMeds.length} medicines to your weekly box with food reminders for ${Object.keys(slotTimeMap).join(', ')}.`
    });
  };

  // Metrics
  const totalApproved = reconciledItems.filter((i) => i.isApprovedByPatient).length;
  const progressPercent = reconciledItems.length > 0 ? Math.round((totalApproved / reconciledItems.length) * 100) : 0;
  const newCount = reconciledItems.filter((i) => i.statusBadge === 'NEW').length;
  const changedCount = reconciledItems.filter((i) => i.statusBadge === 'DOSE_CHANGED').length;
  const stoppedCount = reconciledItems.filter((i) => i.statusBadge === 'STOPPED').length;
  const interactionsCount = reconciledItems.reduce(
    (acc, curr) => acc + (curr.interactions ? curr.interactions.length : 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Top Controls & Module Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Module Title */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/25">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight text-slate-900">
                  Medicine Review
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono font-bold text-xs border border-purple-500/40">
                  Before / Hospital / Now
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Check what changed after your hospital stay — approve each medicine in plain language before it goes to your weekly box.
              </p>
            </div>
          </div>

          {/* Quick-Fill Sample Dataset Switcher */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 text-xs">
            <span className="text-[11px] font-mono text-slate-600 px-2 font-bold">Example:</span>
            <button
              onClick={() => setSelectedCaseId('shanti')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                selectedCaseId === 'shanti'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Shanti Devi — heart
            </button>
            <button
              onClick={() => setSelectedCaseId('jenkins')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                selectedCaseId === 'jenkins'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Harold Jenkins — heart
            </button>
          </div>
        </div>

        {/* Statistical Overview Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2 border-t border-slate-200">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-mono text-slate-600 uppercase font-bold">Total Meds</div>
            <div className="text-xl font-black text-white mt-0.5">{reconciledItems.length}</div>
          </div>

          <div className="p-3 rounded-2xl bg-purple-950/30 border border-purple-800/50">
            <div className="text-[10px] font-mono text-purple-300 uppercase font-bold">New Meds</div>
            <div className="text-xl font-black text-purple-200 mt-0.5">{newCount}</div>
          </div>

          <div className="p-3 rounded-2xl bg-sky-50 border border-sky-800/50">
            <div className="text-[10px] font-mono text-sky-700 uppercase font-bold">Dose Changed</div>
            <div className="text-xl font-black text-sky-700 mt-0.5">{changedCount}</div>
          </div>

          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200">
            <div className="text-[10px] font-mono text-rose-700 uppercase font-bold">Stopped / Omitted</div>
            <div className="text-xl font-black text-rose-700 mt-0.5">{stoppedCount}</div>
          </div>

          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-800/50">
            <div className="text-[10px] font-mono text-amber-700 uppercase font-bold">Conflicts Flagged</div>
            <div className="text-xl font-black text-amber-700 mt-0.5">{interactionsCount}</div>
          </div>

          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-800/50">
            <div className="text-[10px] font-mono text-emerald-700 uppercase font-bold">Approved Status</div>
            <div className="text-base font-black text-emerald-700 mt-1">
              {totalApproved}/{reconciledItems.length} ({progressPercent}%)
            </div>
          </div>
        </div>

        {/* Action & View Mode Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-50 p-1 rounded-2xl border border-slate-200 text-xs">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                viewMode === 'table' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Compare Lists</span>
            </button>
            <button
              onClick={() => setViewMode('walk')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                viewMode === 'walk' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Step-by-Step</span>
            </button>
          </div>

          {/* Key Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Teach-Back Button */}
            <button
              onClick={() => setIsTeachBackOpen(true)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                teachBackRecord?.comprehensionScore === 'accurate'
                  ? 'bg-emerald-600/30 text-emerald-700 border-emerald-500/50'
                  : 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-700 border-indigo-500/40'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>{teachBackRecord ? 'Checked ✓' : 'Check My Understanding'}</span>
            </button>

            {/* 1-Page Summary Export */}
            <button
              onClick={handleOpenExportSummary}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-semibold transition-all"
            >
              <Printer className="w-4 h-4 text-sky-400" />
              <span>Print Summary</span>
            </button>

            {/* Cross-Module Handoff Button — RB4 gate disabled until 100% approved */}
            <button
              onClick={handleFinalizeAndHandoffToPillMap}
              disabled={totalApproved !== reconciledItems.length}
              title={totalApproved !== reconciledItems.length ? `Approve all ${reconciledItems.length} medicines first (${totalApproved}/${reconciledItems.length})` : 'Add to my weekly medicines'}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-lg transition-all ${
                totalApproved !== reconciledItems.length
                  ? 'bg-slate-700 text-slate-600 cursor-not-allowed border border-slate-600'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-900/30 hover:scale-102'
              }`}
            >
              <Pill className="w-4 h-4" />
              <span>Add to My Medicines{totalApproved !== reconciledItems.length ? ` (${totalApproved}/${reconciledItems.length})` : ''}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main View Mode Component */}
      {viewMode === 'table' ? (
        <ThreeListTable
          items={reconciledItems}
          onSelectMed={(item) => {
            const idx = reconciledItems.findIndex((i) => i.medId === item.medId);
            if (idx >= 0) setWalkIndex(idx);
            setViewMode('walk');
          }}
          onToggleApproval={handleToggleApproval}
          onAskDoctor={handleAskDoctor}
        />
      ) : (
        <ReconciliationWalk
          items={reconciledItems}
          currentIndex={walkIndex}
          onNavigateIndex={(idx) => setWalkIndex(idx)}
          onApproveMed={handleApproveMedInWalk}
          onAskDoctor={handleAskDoctor}
          onUpdateNote={handleUpdateNote}
          onFinishWalk={() => {
            setViewMode('table');
            if (!teachBackRecord) {
              setIsTeachBackOpen(true);
            }
          }}
          onOpenTeachBack={() => setIsTeachBackOpen(true)}
        />
      )}

      {/* Global Modals */}
      {isTeachBackOpen && (
        <TeachBackModal
          dataset={activeDataset}
          onClose={() => setIsTeachBackOpen(false)}
          onVerified={(check) => {
            setTeachBackRecord(check);
            eventBus.dispatchToast({
              type: 'success',
              title: 'Teach-Back Completed',
              message: 'Patient comprehension verified.'
            });
          }}
        />
      )}

      {isExportModalOpen && summaryData && (
        <SummaryExportModal
          summary={summaryData}
          onClose={() => setIsExportModalOpen(false)}
        />
      )}
    </div>
  );
};
