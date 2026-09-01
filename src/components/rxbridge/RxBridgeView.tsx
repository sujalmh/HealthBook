/**
 * CareCanvas Component: RxBridgeView
 * Main module container for Milestone 4 (RxBridge Post-Discharge 3-List Reconciliation).
 * Features:
 * - 3-list comparative overview
 * - Quick-fill sample discharge cases (Patient / Patient)
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
// Mock datasets removed — M1: real data from vault for authenticated patient (no Patient/Jenkins fixture)
import { ClinicalReconciliationEngine } from '../../core/knowledge/reconciliationEngine.ts';
import { localVault } from '../../core/vault/LocalVault.ts';
import { eventBus } from '../../core/events/eventBus.ts';
import { getAIConfig, isAIEnabled } from '../../core/ai/config.ts';
import { webMCPEngine } from '../../core/webmcp/WebMCPEngine.ts';
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

function deriveRxPatientId(passed: string, fallback?: string): string {
  if (passed && passed.trim() !== '' && passed !== 'patient-s-devi') return passed.trim();
  if (fallback && fallback.trim() !== '' && fallback !== 'patient-s-devi') return fallback.trim();
  try {
    const g: any = typeof globalThis !== 'undefined' ? (globalThis as any) : undefined;
    const ls = g?.localStorage || (typeof localStorage !== 'undefined' ? (localStorage as any) : undefined);
    if (ls) {
      const raw = ls.getItem('carecanvas_active_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        const pid = parsed?.userId || parsed?.id || parsed?.patientId;
        if (typeof pid === 'string' && pid.trim() !== '') return pid.trim();
      }
    }
  } catch {}
  return passed || fallback || 'patient-unknown';
}

export const RxBridgeView: React.FC<RxBridgeViewProps> = ({
  patientId = '',
  activeProfile = { userId: '', name: 'Patient', role: 'patient' }
}) => {
  const effectivePatientId = deriveRxPatientId(patientId, activeProfile.userId);
  // Real data — vault-derived (no mock case selection) — uses effectivePatientId for isolation
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
  const [selectedCaseId] = useState<'shanti' | 'jenkins'>('shanti');
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

  // Load and reconcile data — AI-enhanced via knowledge engine when enabled (reconciliation + question synthesis)
  const loadReconciliation = async (dataset: Patient3ListDischargeDataset) => {
    try {
      let useAI = false;
      try { useAI = isAIEnabled(getAIConfig()) && typeof (ClinicalReconciliationEngine as any).reconcileThreeListsAI === 'function'; } catch {}
      const items = useAI
        ? await (ClinicalReconciliationEngine as any).reconcileThreeListsAI(dataset)
        : ClinicalReconciliationEngine.reconcileThreeLists(dataset);
      setReconciledItems(items);
    } catch {
      const items = ClinicalReconciliationEngine.reconcileThreeLists(dataset);
      setReconciledItems(items);
    }
    setWalkIndex(0);
    setTeachBackRecord(null);
  };

  useEffect(() => {
    const meds = localVault.getMedications(effectivePatientId);
    if (!meds.length) { setActiveDataset(emptyDataset); loadReconciliation(emptyDataset); return; }
    const preAdmissionMeds = meds.map((m:any)=> ({ medName: m.genericName||m.brandName||'Medication', dose: m.dosage||'Standard', frequency: m.frequency||'Once daily', isOTC:false }));
    const dischargeMeds = meds.map((m:any)=> ({ medName: m.genericName||m.brandName||'Medication', dose: m.dosage||'Standard', frequency: m.frequency||'Once daily', status: m.status==='stopped'?'STOPPED':'CONTINUED' as any, reason:'Doctor order', timingSlots:m.timingSlots, dietInstructions:m.withFood?'Take with food':undefined }));
    const dataset: Patient3ListDischargeDataset = { ...emptyDataset, preAdmissionMeds, dischargeMeds } as any;
    setActiveDataset(dataset); loadReconciliation(dataset);
  }, [effectivePatientId, activeProfile.userId]);

  // M2 Relevant-only: RxBridge listens to proposal_created/status_changed (alias proposal_submitted), lab_added (alias lab_extracted, eGFR flag), medication_added/updated
  // medication adds outside RxBridge (e.g., PillMap) should refresh flags; irrelevant like danger_report/calendar filtered out
  // Alias dispatch covers legacy names without double. Handlers trigger reconciler recompute guarded by patientId.
  useEffect(() => {
    const guard = (p: any) => !p || !p.patientId || p.patientId === effectivePatientId;
    const onProposal = (payload: any) => { if (guard(payload)) loadReconciliation(activeDataset); };
    const onLab = (payload: any) => { if (guard(payload)) loadReconciliation(activeDataset); };
    const onMed = (payload: any) => { if (guard(payload)) loadReconciliation(activeDataset); };

    const u1 = eventBus.on('proposal_created', onProposal);
    const u2 = eventBus.on('proposal_status_changed', onProposal);
    const u3 = eventBus.on('lab_added', onLab);
    const u4 = eventBus.on('medication_added', onMed);
    const u5 = eventBus.on('medication_updated', onMed);

    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [effectivePatientId, activeDataset]);

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
    // Dedup spam via vault (LocalVault.addQuestion checks duplicate) — AI-enriched without spam
    localVault.addQuestionBankItem({
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

    // Add active discharge meds — uses effectivePatientId, AI-aware (questionBank enriched without duplicate spam)
    for (const d of activeDischargeMeds) {
      const generic = ClinicalReconciliationEngine.determineStatusBadge(undefined, undefined, d.dose) === 'NEW'
        ? d.medName
        : d.medName;

      localVault.addMedication(
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
        { userId: activeProfile.userId, userName: activeProfile.name, role: activeProfile.role as any }
      );
    }

    // Mark stopped meds
    for (const s of stoppedMeds) {
      const existing = localVault.getMedications(effectivePatientId).find(
        (m) => m.genericName?.toLowerCase().includes(s.medName?.toLowerCase()) || (m.brandName && m.brandName?.toLowerCase().includes(s.medName?.toLowerCase()))
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
          patientId: effectivePatientId,
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

    // Emit event so PillMap re-evaluates (INT2) — include patientId for relevant-only filtering, never '' leak
    eventBus.emit('medication_added', { patientId: effectivePatientId, source: 'rxbridge_reconciliation' });

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
  const doctorSourceName = activeDataset.attendingPhysician!=='Care Team'?activeDataset.attendingPhysician:(localVault.getProposals(effectivePatientId).sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime())[0]?.doctorName||(localVault.getDoctorGrants(effectivePatientId).sort((a,b)=>new Date(b.issuedAt).getTime()-new Date(a.issuedAt).getTime())[0] as any)?.doctorName||'Care Team');
  const lastUpdatedRaw = (()=>{let ts=activeDataset.dischargeDate;const p=localVault.getProposals(effectivePatientId);if(p.length){const l=[...p].sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime())[0];ts=(l as any).approvedAt||l.timestamp||ts;}const a=localVault.getAuditLogs(effectivePatientId);if(a.length){const la=[...a].sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime())[0].timestamp;if(new Date(la)>new Date(ts))ts=la;}return ts;})();
  const isOutdated = (()=>{try{return Date.now()-new Date(lastUpdatedRaw).getTime()>30*24*60*60*1000;}catch{return false;}})();
  const isPatientReadOnly = activeProfile.role!=='doctor' && !activeProfile.isProxy;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Controls & Module Banner — tokenized */}
      <div className="bg-canvas-card border border-canvas-border rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Module Title */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-primary-light text-primary border border-primary-border flex items-center justify-center shadow-sm shrink-0">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Medicine Review
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-primary-light text-primary-text font-bold text-caption border border-primary-border">
                  Before / Hospital / Now
                </span>
              </div>
              <p className="text-xs text-muted">
                Check what changed after your hospital stay — approve each medicine in plain language before it goes to your weekly box.
              </p>
            </div>
          </div>

          {/* Doctor source + Last updated */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-full bg-primary-light text-primary-text font-bold text-caption border border-primary-border">From your hospital stay — doctor's list</span>
              <span className="text-caption text-muted">Shared by Dr {doctorSourceName} on {lastUpdatedRaw.slice(0,10)}</span>
            </div>
            <div className="text-caption text-muted">Last updated: {lastUpdatedRaw.slice(0,10)}</div>
            {isOutdated && <div className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">This list may be outdated — ask your doctor for current list.</div>}
            <div className="flex items-center gap-2 bg-canvas-muted p-1.5 rounded-xl border border-canvas-border text-body-sm">
              <span className="text-caption font-semibold text-muted px-2">Your discharge list — vault data for {activeProfile.name || 'Patient'}</span>
            </div>
          </div>
        </div>

        {/* Statistical Overview Strip — tokenized light */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4 border-t border-canvas-border">
          <div className="p-3 rounded-xl bg-canvas-muted border border-canvas-border">
            <div className="text-caption font-mono text-muted uppercase font-bold">Total meds</div>
            <div className="text-xl font-black text-slate-900 mt-0.5">{reconciledItems.length}</div>
          </div>

          <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
            <div className="text-caption font-mono text-clinical-purple uppercase font-bold">New meds</div>
            <div className="text-xl font-black text-clinical-purple mt-0.5">{newCount}</div>
          </div>

          <div className="p-3 rounded-xl bg-sky-50 border border-sky-200">
            <div className="text-caption font-mono text-clinical-blue uppercase font-bold">Dose changed</div>
            <div className="text-xl font-black text-clinical-blue mt-0.5">{changedCount}</div>
          </div>

          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
            <div className="text-caption font-mono text-clinical-red uppercase font-bold">Stopped / Omitted</div>
            <div className="text-xl font-black text-clinical-red mt-0.5">{stoppedCount}</div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <div className="text-caption font-mono text-clinical-amber uppercase font-bold">Conflicts flagged</div>
            <div className="text-xl font-black text-clinical-amber mt-0.5">{interactionsCount}</div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <div className="text-caption font-mono text-clinical-emerald uppercase font-bold">Approved</div>
            <div className="text-xl font-black text-clinical-emerald mt-0.5">{totalApproved}/{reconciledItems.length}</div>
          </div>
        </div>
        {isPatientReadOnly && reconciledItems.length > 0 && (
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-sm text-sky-800">This is your doctor's list — review and tap Approve for each medicine</div>
        )}
        {reconciledItems.length === 0 && (
          <div className="bg-canvas-card border border-canvas-border rounded-2xl p-6 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-900">No hospital list yet — your doctor can share one, or add medicines in Weekly Planner</p>
            <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold cursor-pointer"><span>Upload discharge paper</span><input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={async (e)=>{const f=(e.target as HTMLInputElement).files?.[0];if(!f)return;const r=new FileReader();r.onload=async()=>{const d=r.result as string;const id=`doc_${Date.now()}_${f.name}`;await localVault.addDocument({id,patientId:effectivePatientId,fileName:f.name,name:f.name,docType:'discharge_summary' as any,pageCount:1,uploadTimestamp:new Date().toISOString(),extractedText:'',extractedFactIds:[]}as any);try{await webMCPEngine.execute('extract_fact',{documentId:id,rawText:f.name,imageDataUrl:d,docType:'discharge_summary'}as any);}catch{}const meds=localVault.getMedications(effectivePatientId);if(meds.length){const pre=meds.map((m:any)=>({medName:m.genericName||m.brandName||'Medication',dose:m.dosage||'Standard',frequency:m.frequency||'Once daily'}));const dis=meds.map((m:any)=>({medName:m.genericName||m.brandName||'Medication',dose:m.dosage||'Standard',frequency:m.frequency||'Once daily',status:'CONTINUED' as any,reason:'Doctor order'}));const ds={...emptyDataset,preAdmissionMeds:pre,dischargeMeds:dis}as any;loadReconciliation(ds);setActiveDataset(ds);}};r.readAsDataURL(f);}} /></label>
            <p className="text-caption text-muted">or add medicines in Weekly Planner</p>
          </div>
        )}
      </div>

      {/* Main Mode Switcher + Action Bar */}
      <div className="bg-canvas-card border border-canvas-border rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Table vs Walk mode toggle */}
          <div className="flex items-center gap-1 bg-canvas-muted p-1 rounded-xl border border-canvas-border text-body-sm shadow-xs">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold transition-all min-h-[36px] ${
                viewMode === 'table' ? 'bg-white text-primary font-bold shadow-xs border border-canvas-border' : 'text-muted hover:text-slate-900 border border-transparent'
              }`}
            >
              <TableIcon className="w-4 h-4" />
              <span>Compare Lists</span>
            </button>
            <button
              onClick={() => setViewMode('walk')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold transition-all min-h-[36px] ${
                viewMode === 'walk' ? 'bg-white text-primary font-bold shadow-xs border border-canvas-border' : 'text-muted hover:text-slate-900 border border-transparent'
              }`}
            >
              <Bot className="w-4 h-4" />
              <span>Step-by-Step</span>
            </button>
          </div>
        </div>

        {/* Key Actions */}
        <div className="flex flex-wrap items-center gap-2">
            {/* Teach-Back Button */}
            <button
              onClick={() => setIsTeachBackOpen(true)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all min-h-[40px] ${
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
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-semibold transition-all min-h-[40px]"
            >
              <Printer className="w-4 h-4 text-sky-500" />
              <span>Print Summary</span>
            </button>

            {/* Cross-Module Handoff Button — RB4 gate */}
            <button
              onClick={handleFinalizeAndHandoffToPillMap}
              disabled={totalApproved !== reconciledItems.length}
              title={totalApproved !== reconciledItems.length ? `Approve all ${reconciledItems.length} medicines first (${totalApproved}/${reconciledItems.length})` : 'Add to my weekly medicines'}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-body-sm font-bold shadow-md transition-all min-h-[44px] ${
                totalApproved !== reconciledItems.length
                  ? 'bg-canvas-muted text-muted cursor-not-allowed border border-canvas-border'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/20 hover:scale-[1.01]'
              }`}
            >
              <Pill className="w-4 h-4" />
              <span>Add to My Medicines{totalApproved !== reconciledItems.length ? ` (${totalApproved}/${reconciledItems.length})` : ''}</span>
            </button>
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
