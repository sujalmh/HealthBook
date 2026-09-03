/**
 * Healthbook Component: RxBridgeView
 * Main module container for Milestone 4 (RxBridge Post-Discharge 3-List Reconciliation).
 * Features:
 * - 3-list comparative overview
 * - Quick-fill sample discharge cases (Patient / Patient)
 * - Conversational med-by-med walkthrough wizard
 * - Interactive Teach-Back comprehension validation
 * - 1-Page printable/downloadable discharge summary export
 * - Cross-module handoff to PillMap Day 0 schedule & LocalVault meds.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShieldCheck,
  Printer,
  Bot,
  Table as TableIcon,
  Pill,
} from 'lucide-react';
import type {
  Patient3ListDischargeDataset,
  ReconciledMedChangeItem,
  TeachBackCheck,
  PatientHomeSummaryExport
} from '../../types/rxbridge.ts';
// Mock datasets removed — M1: real data from vault for authenticated patient (no Patient/Jenkins fixture)
import { ClinicalReconciliationEngine } from '../../core/knowledge/reconciliationEngine.ts';
import { localVault } from '../../core/vault/LocalVault.ts';
import { eventBus } from '../../core/events/eventBus.ts';
import { webMCPEngine } from '../../core/webmcp/WebMCPEngine.ts';
import { resolvePatientId } from '@/components/common/resolvePatientId';
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
  patientId = '',
  activeProfile = { userId: '', name: 'Patient', role: 'patient' }
}) => {
  const effectivePatientId = resolvePatientId(patientId, activeProfile.userId) || 'patient-unknown';
  const emptyDataset: Patient3ListDischargeDataset = {
    patientId: effectivePatientId,
    patientName: activeProfile.name || 'Patient',
    admissionDate: new Date().toISOString().slice(0, 10),
    dischargeDate: new Date().toISOString().slice(0, 10),
    ward: 'General',
    attendingPhysician: 'Care Team',
    preAdmissionMeds: [],
    inHospitalMeds: [],
    dischargeMeds: []
  };
  const [activeDataset, setActiveDataset] = useState<Patient3ListDischargeDataset>(emptyDataset);

  // Reconciliation state
  const [reconciledItems, setReconciledItems] = useState<ReconciledMedChangeItem[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'walk'>('table');
  const [walkIndex, setWalkIndex] = useState(0);

  // Modals state
  const [isTeachBackOpen, setIsTeachBackOpen] = useState(false);
  const [teachBackRecord, setTeachBackRecord] = useState<TeachBackCheck | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [summaryData, setSummaryData] = useState<PatientHomeSummaryExport | null>(null);

  // AI narratives — per-med explanations from the AI pipeline (explain_med_change
  // tool). Fetched lazily, one call per med the patient actually opens in the
  // walkthrough, cached for the session, with inline error + retry.
  const [aiNarratives, setAiNarratives] = useState<Record<string, { explanation: string; questions: string[] }>>({});
  const [aiLoadingMeds, setAiLoadingMeds] = useState<Record<string, boolean>>({});
  const [aiNarrativeErrors, setAiNarrativeErrors] = useState<Record<string, boolean>>({});
  const [aiRetryNonce, setAiRetryNonce] = useState(0);
  const aiInflightMeds = useRef<Set<string>>(new Set());

  const loadReconciliation = async (dataset: Patient3ListDischargeDataset) => {
    // Instant deterministic render first — the list must never show empty/zeros
    // while the AI batch is still in flight (production AI takes seconds).
    try {
      setReconciledItems(ClinicalReconciliationEngine.reconcileThreeLists(dataset));
    } catch {
      // boundary — AI upgrade below still attempts
    }
    setWalkIndex(0);
    setTeachBackRecord(null);
    // New dataset → drop cached AI narratives so explanations match current meds
    setAiNarratives({});
    setAiLoadingMeds({});
    setAiNarrativeErrors({});
    aiInflightMeds.current.clear();

    // Upgrade with AI enrichment; merge by medId (deterministic across both
    // passes) so approvals and notes the patient already made are never clobbered.
    try {
      const aiItems = await ClinicalReconciliationEngine.reconcileThreeListsAI(dataset);
      const aiMap = new Map(aiItems.map((i) => [i.medId, i]));
      setReconciledItems((prev) => {
        if (prev.length === 0) return aiItems;
        return prev.map((item) => {
          const ai = aiMap.get(item.medId);
          if (!ai) return item;
          return {
            ...item,
            plainLanguageExplanation: ai.plainLanguageExplanation || item.plainLanguageExplanation,
            suggestedQuestions: ai.suggestedQuestions && ai.suggestedQuestions.length > 0 ? ai.suggestedQuestions : item.suggestedQuestions,
            interactions: ai.interactions && ai.interactions.length > 0 ? ai.interactions : item.interactions,
            dietInteractions: ai.dietInteractions && ai.dietInteractions.length > 0 ? ai.dietInteractions : item.dietInteractions,
          };
        });
      });
    } catch {
      // Sync render stands — the walkthrough shows per-med loading/error states
    }
  };

  useEffect(() => {
    const meds = localVault.getMedications(effectivePatientId);
    if (!meds.length) { setActiveDataset(emptyDataset); loadReconciliation(emptyDataset); return; }
    const preAdmissionMeds = meds.map((m) => ({ medName: (m.genericName || m.brandName || 'Medication') as string, dose: (m.dosage || 'Standard') as string, frequency: (m.frequency || 'Once daily') as string, isOTC: false }));
    const dischargeMeds = meds.map((m) => ({ medName: (m.genericName || m.brandName || 'Medication') as string, dose: (m.dosage || 'Standard') as string, frequency: (m.frequency || 'Once daily') as string, status: (m.status === 'stopped' ? 'STOPPED' : 'CONTINUED') as 'STOPPED' | 'CONTINUED', reason: 'Doctor order', timingSlots: m.timingSlots, dietInstructions: m.withFood ? 'Take with food' : undefined }));
    const dataset: Patient3ListDischargeDataset = { ...emptyDataset, preAdmissionMeds, dischargeMeds } as unknown as Patient3ListDischargeDataset;
    setActiveDataset(dataset); loadReconciliation(dataset);
  }, [effectivePatientId, activeProfile.userId]);

  useEffect(() => {
    const guard = (p: unknown) => {
      const pid = (p as { patientId?: string })?.patientId;
      return !p || !pid || pid === effectivePatientId;
    };
    const onProposal = (payload: unknown) => { if (guard(payload)) loadReconciliation(activeDataset); };
    const onLab = (payload: unknown) => { if (guard(payload)) loadReconciliation(activeDataset); };
    const onMed = (payload: unknown) => { if (guard(payload)) loadReconciliation(activeDataset); };

    const u1 = eventBus.on('proposal_created', onProposal as (p: unknown) => void);
    const u2 = eventBus.on('proposal_status_changed', onProposal as (p: unknown) => void);
    const u3 = eventBus.on('lab_added', onLab as (p: unknown) => void);
    const u4 = eventBus.on('medication_added', onMed as (p: unknown) => void);
    const u5 = eventBus.on('medication_updated', onMed as (p: unknown) => void);

    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [effectivePatientId, activeDataset]);

  // Attach the walkthrough to the AI pipeline: when the patient opens a med in
  // Step-by-Step, fetch its AI explanation via explain_med_change. One call
  // per med, cached; failures surface an inline error with retry.
  useEffect(() => {
    if (viewMode !== 'walk' || reconciledItems.length === 0) return;
    const item = reconciledItems[walkIndex] || reconciledItems[0];
    if (!item || aiNarratives[item.medId] || aiInflightMeds.current.has(item.medId)) return;
    aiInflightMeds.current.add(item.medId);
    setAiLoadingMeds((prev) => ({ ...prev, [item.medId]: true }));
    setAiNarrativeErrors((prev) => ({ ...prev, [item.medId]: false }));
    webMCPEngine
      .execute(
        'explain_med_change',
        {
          medName: item.medName,
          preHospDose: item.preHospDose,
          inHospAction: item.inHospAction,
          dischargeDose: item.dischargeDose,
          reason: item.documentedReason,
        },
        { patientId: effectivePatientId }
      )
      .then((res) => {
        const d = (res as { success?: boolean; data?: { plainLanguageExplanation?: string; suggestedQuestions?: string[] } })?.data;
        if ((res as { success?: boolean })?.success && d?.plainLanguageExplanation) {
          setAiNarratives((prev) => ({
            ...prev,
            [item.medId]: {
              explanation: d.plainLanguageExplanation as string,
              questions: Array.isArray(d.suggestedQuestions) ? (d.suggestedQuestions as string[]) : [],
            },
          }));
        } else {
          setAiNarrativeErrors((prev) => ({ ...prev, [item.medId]: true }));
        }
      })
      .catch(() => {
        setAiNarrativeErrors((prev) => ({ ...prev, [item.medId]: true }));
      })
      .finally(() => {
        aiInflightMeds.current.delete(item.medId);
        setAiLoadingMeds((prev) => ({ ...prev, [item.medId]: false }));
      });
  }, [viewMode, walkIndex, reconciledItems, effectivePatientId, aiNarratives, aiRetryNonce]);

  const handleRetryAiNarrative = (medId: string) => {
    setAiNarratives((prev) => {
      const next = { ...prev };
      delete next[medId];
      return next;
    });
    setAiNarrativeErrors((prev) => ({ ...prev, [medId]: false }));
    aiInflightMeds.current.delete(medId);
    setAiRetryNonce((n) => n + 1);
  };

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

  const handleAskDoctor = async (medName: string, questionText: string) => {
    // Dedup spam via vault (LocalVault.addQuestion checks duplicate) — AI-enriched without spam
    try {
      await localVault.addQuestionBankItem({
        id: `q_recon_${Date.now()}`,
        patientId: effectivePatientId,
        questionText,
        category: 'medication_change',
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
      title: 'Question Added to Bank',
      message: `"${questionText.slice(0, 45)}..." added for your follow-up appointment.`
    });
  };

  // Open 1-Page Export Summary — uses effectivePatientId, questions reflect AI suggest_question bank
  const handleOpenExportSummary = () => {
    const questions = localVault.getQuestions(effectivePatientId).map((q) => q.questionText);
    const summary = ClinicalReconciliationEngine.compilePatientSummary(activeDataset, questions, 'en');
    setSummaryData(summary);
    setIsExportModalOpen(true);
  };

  // Cross-Module Bridge: Finalize & Populate PillMap Day 0 Schedule — RB4 approval gate + RB9 diet-aware Day 0
  const handleFinalizeAndHandoffToPillMap = async () => {
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
    const slotTimeMap: Record<string, string> = {};
    const defaultTimes: Record<string, string> = { morning: '08:00', noon: '12:00', evening: '18:00', bedtime: '22:00' };

    // Add active discharge meds — uses effectivePatientId, AI-aware (questionBank enriched without duplicate spam)
    try {
      for (const d of activeDischargeMeds) {
        const generic = ClinicalReconciliationEngine.determineStatusBadge(undefined, undefined, d.dose) === 'NEW'
          ? d.medName
          : d.medName;

        await localVault.addMedication(
        {
          id: `med_${d.medName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`,
          patientId: effectivePatientId,
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
        { userId: activeProfile.userId, userName: activeProfile.name, role: activeProfile.role as 'patient' | 'caregiver' | 'doctor' }
      );
    }

    for (const s of stoppedMeds) {
      const existing = localVault.getMedications(effectivePatientId).find(
        (m) => m.genericName?.toLowerCase().includes(s.medName?.toLowerCase()) || (m.brandName && m.brandName?.toLowerCase().includes(s.medName?.toLowerCase()))
      );
      if (existing) {
        await localVault.updateMedicationStatus(existing.id, 'stopped', {
          userId: activeProfile.userId,
          userName: activeProfile.name,
          role: activeProfile.role as 'patient' | 'caregiver' | 'doctor'
        });
      }
    }

    // RB9: Register diet-aware slot reminders via set_reminder semantics (calendar events grouped by slot time)
    const activeSlots = new Set<string>();
    for (const d of activeDischargeMeds) {
      for (const s of (d.timingSlots || ['morning'])) activeSlots.add(s);
    }
    for (const slot of activeSlots) {
      slotTimeMap[slot] = defaultTimes[slot] || '08:00';
      // Diet-aware annotation for empty-stomach / grapefruit avoidance is persisted on MedicationRecord; reminder reason carries it
      const slotMeds = activeDischargeMeds.filter((d) => (d.timingSlots || ['morning']).includes(slot as unknown as typeof d.timingSlots extends (infer U)[] | undefined ? U : string));
      const dietNotes = slotMeds
        .map((m) => m.dietInstructions)
        .filter(Boolean)
        .join('; ');
      await localVault.addCalendarEvent(
        {
          id: `reminder_${slot}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          patientId: effectivePatientId,
          title: `${slot.toUpperCase()} Meds Reminder (${slotTimeMap[slot]})`,
          eventType: 'med_reminder',
          scheduledDate: new Date().toISOString(),
          reason: dietNotes ? `Take ${slot} meds at ${slotTimeMap[slot]} — ${dietNotes}` : `Take scheduled ${slot} medications at ${slotTimeMap[slot]}`,
          notifyHoursBefore: [0],
          isCompleted: false,
          syncedToCalendar: true
        },
        { userId: activeProfile.userId, userName: activeProfile.name, role: activeProfile.role as 'patient' | 'caregiver' | 'doctor' }
      );
    }
    } catch (e: unknown) {
      eventBus.dispatchToast({ type: 'error', title: 'Handoff failed', message: e instanceof Error ? e.message : 'Server save failed. Your Day 0 schedule was not saved.' });
      return;
    }

    // Emit event so PillMap re-evaluates (INT2) — include patientId for relevant-only filtering, never '' leak
    eventBus.emit('medication_added', { patientId: effectivePatientId, source: 'rxbridge_reconciliation' });

    eventBus.dispatchToast({
      type: 'success',
      title: 'My Medicines Updated!',
      message: `Added ${activeDischargeMeds.length} medicines to your weekly box with food reminders for ${Object.keys(slotTimeMap).join(', ')}.`
    });
  };

  const handleDischargeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const d = reader.result as string;
      const id = `doc_${Date.now()}_${f.name}`;
      await localVault.addDocument({ id, patientId: effectivePatientId, fileName: f.name, name: f.name, docType: 'discharge_summary', pageCount: 1, uploadTimestamp: new Date().toISOString(), extractedText: '', extractedFactIds: [] } as unknown as import('@/types/vault').DocumentRecord);
      try {
        await webMCPEngine.execute('extract_fact', { documentId: id, rawText: f.name, imageDataUrl: d, docType: 'discharge_summary' } as unknown as Record<string, unknown>);
      } catch { /* intentionally empty */ }
      const meds = localVault.getMedications(effectivePatientId);
      if (meds.length) {
        const pre = meds.map((m) => ({ medName: m.genericName || m.brandName || 'Medication', dose: m.dosage || 'Standard', frequency: m.frequency || 'Once daily' }));
        const dis = meds.map((m) => ({ medName: m.genericName || m.brandName || 'Medication', dose: m.dosage || 'Standard', frequency: m.frequency || 'Once daily', status: 'CONTINUED' as const, reason: 'Doctor order' }));
        const ds = { ...emptyDataset, preAdmissionMeds: pre, dischargeMeds: dis } as unknown as Patient3ListDischargeDataset;
        loadReconciliation(ds);
        setActiveDataset(ds);
      }
    };
    reader.readAsDataURL(f);
  };

  const totalApproved = reconciledItems.filter((i) => i.isApprovedByPatient).length;
  const newCount = reconciledItems.filter((i) => i.statusBadge === 'NEW').length;
  const changedCount = reconciledItems.filter((i) => i.statusBadge === 'DOSE_CHANGED').length;
  const stoppedCount = reconciledItems.filter((i) => i.statusBadge === 'STOPPED').length;
  const interactionsCount = reconciledItems.reduce(
    (acc, curr) => acc + (curr.interactions ? curr.interactions.length : 0),
    0
  );
  const doctorSourceName = useMemo(() => {
    if (activeDataset.attendingPhysician !== 'Care Team') return activeDataset.attendingPhysician;
    const proposals = localVault.getProposals(effectivePatientId).slice().sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime());
    if (proposals[0]?.doctorName) return proposals[0].doctorName;
    const grants = localVault.getDoctorGrants(effectivePatientId).slice().sort((a,b)=>new Date(b.issuedAt).getTime()-new Date(a.issuedAt).getTime());
    const g = grants[0] as unknown as { doctorName?: string } | undefined;
    return g?.doctorName || 'Care Team';
  }, [effectivePatientId, activeDataset.attendingPhysician]);
  const lastUpdatedRaw = useMemo(() => {
    let ts = activeDataset.dischargeDate;
    const p = localVault.getProposals(effectivePatientId);
    if (p.length){
      const l = [...p].sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime())[0];
      const rec = l as unknown as { approvedAt?: string; timestamp: string };
      ts = rec.approvedAt || rec.timestamp || ts;
    }
    const a = localVault.getAuditLogs(effectivePatientId);
    if (a.length){
      const la = [...a].sort((aa,bb)=>new Date(bb.timestamp).getTime()-new Date(aa.timestamp).getTime())[0].timestamp;
      if (new Date(la) > new Date(ts)) ts = la;
    }
    return ts;
  }, [effectivePatientId, activeDataset.dischargeDate]);
  const isOutdated = useMemo(() => {
    try { return Date.now()-new Date(lastUpdatedRaw).getTime()>30*24*60*60*1000; } catch { return false; }
  }, [lastUpdatedRaw]);
  const isPatientReadOnly = activeProfile.role!=='doctor' && !activeProfile.isProxy;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Top Controls & Module Banner — tokenized */}
      <div className="bg-canvas-card border border-canvas-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Medicine Review
          </h2>

          {/* Doctor source + Last updated */}
          <div className="flex flex-col gap-2">
            <div className="text-caption text-muted">Shared by {doctorSourceName} • Updated {lastUpdatedRaw.slice(0,10)}</div>
            {isOutdated && <div className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">This list may be outdated — ask your doctor for current list.</div>}
          </div>
        </div>

        {/* Summary Strip — compact counts */}
        <div className="pt-3 border-t border-canvas-border">
          <p className="text-sm text-slate-700">
            <strong className="text-slate-900">{reconciledItems.length}</strong> medicines
            {newCount > 0 && <span> • <strong className="text-slate-900">{newCount}</strong> new</span>}
            {changedCount > 0 && <span> • <strong className="text-slate-900">{changedCount}</strong> dose changed</span>}
            {stoppedCount > 0 && <span> • <strong className="text-clinical-red">{stoppedCount}</strong> stopped</span>}
            {interactionsCount > 0 && <span> • <strong className="text-clinical-amber">{interactionsCount}</strong> conflicts</span>}
            <span> • <strong className="text-clinical-emerald">{totalApproved}/{reconciledItems.length}</strong> approved</span>
          </p>
        </div>
        {isPatientReadOnly && reconciledItems.length > 0 && (
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-sm text-sky-800">This is your doctor's list — review and tap Approve for each medicine</div>
        )}
        {reconciledItems.length === 0 && (
          <div className="bg-canvas-card border border-canvas-border rounded-2xl p-6 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-900">No hospital list yet</p>
            <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold cursor-pointer"><span>Upload discharge paper</span><input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleDischargeUpload} /></label>
          </div>
        )}
      </div>

      {/* Main Mode Switcher + Action Bar — one scrollable line on phone */}
      <div className="bg-canvas-card border border-canvas-border rounded-2xl p-3 sm:p-4 shadow-sm flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        {/* Table vs Walk mode toggle */}
        <div className="flex items-center gap-0.5 bg-canvas-muted p-0.5 rounded-xl border border-canvas-border text-xs shadow-xs shrink-0">
          <button
            onClick={() => setViewMode('table')}
            title="Compare lists"
            aria-label="Compare lists"
            className={`flex items-center gap-1 px-2.5 py-2 rounded-lg font-bold transition-all min-h-[40px] ${
              viewMode === 'table' ? 'bg-white text-primary font-bold shadow-xs border border-canvas-border' : 'text-muted hover:text-slate-900 border border-transparent'
            }`}
          >
            <TableIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Compare</span>
          </button>
          <button
            onClick={() => setViewMode('walk')}
            title="Step-by-step"
            aria-label="Step-by-step"
            className={`flex items-center gap-1 px-2.5 py-2 rounded-lg font-bold transition-all min-h-[40px] ${
              viewMode === 'walk' ? 'bg-white text-primary font-bold shadow-xs border border-canvas-border' : 'text-muted hover:text-slate-900 border border-transparent'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span className="hidden sm:inline">Steps</span>
          </button>
        </div>

        {/* Teach-Back Button */}
        <button
          onClick={() => setIsTeachBackOpen(true)}
          title="Check my understanding"
          aria-label="Check my understanding"
          className={`flex items-center justify-center gap-1 p-2 rounded-xl border transition-all min-h-[44px] min-w-[44px] shrink-0 ${
            teachBackRecord?.comprehensionScore === 'accurate'
              ? 'bg-emerald-600/30 text-emerald-700 border-emerald-500/50'
              : 'bg-teal-700/20 hover:bg-teal-700/30 text-teal-800 border-teal-500/40'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-teal-500" />
          <span className="hidden sm:inline text-xs font-bold">{teachBackRecord ? 'Checked ✓' : 'Check understanding'}</span>
        </button>

        {/* 1-Page Summary Export */}
        <button
          onClick={handleOpenExportSummary}
          title="Print summary"
          aria-label="Print summary"
          className="flex items-center justify-center gap-1 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-all min-h-[44px] min-w-[44px] shrink-0"
        >
          <Printer className="w-4 h-4 text-sky-500" />
          <span className="hidden sm:inline text-xs font-semibold">Print</span>
        </button>

        {/* Cross-Module Handoff Button — RB4 gate */}
        <button
          onClick={handleFinalizeAndHandoffToPillMap}
          disabled={totalApproved !== reconciledItems.length}
          title={totalApproved !== reconciledItems.length ? `Approve all ${reconciledItems.length} medicines first (${totalApproved}/${reconciledItems.length})` : 'Add to my weekly medicines'}
          className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold shadow-md transition-all min-h-[44px] whitespace-nowrap shrink-0 ${
            totalApproved !== reconciledItems.length
              ? 'bg-canvas-muted text-muted cursor-not-allowed border border-canvas-border'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          <Pill className="w-4 h-4" />
          <span>Add to Meds{totalApproved !== reconciledItems.length ? ` (${totalApproved}/${reconciledItems.length})` : ''}</span>
        </button>
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
          aiExplanation={(reconciledItems[walkIndex] && aiNarratives[reconciledItems[walkIndex].medId]?.explanation) || undefined}
          aiQuestions={(reconciledItems[walkIndex] && aiNarratives[reconciledItems[walkIndex].medId]?.questions) || undefined}
          aiLoading={!!(reconciledItems[walkIndex] && aiLoadingMeds[reconciledItems[walkIndex].medId])}
          aiError={!!(reconciledItems[walkIndex] && aiNarrativeErrors[reconciledItems[walkIndex].medId])}
          onRetryAi={() => {
            const item = reconciledItems[walkIndex];
            if (item) handleRetryAiNarrative(item.medId);
          }}
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
