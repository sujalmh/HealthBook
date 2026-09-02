import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  User,
  Activity,
  Pill,
  Trash2,
  TrendingUp,
  PlusCircle,
  Calendar,
  Send,
  CheckCircle2,
  FileText,
  Camera,
  Heart
} from 'lucide-react';
import type { DangerSignReport } from '@/types/safety';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';
import { resolvePatientId } from '@/components/common/resolvePatientId';
import { FollowupScheduler } from './FollowupScheduler';

interface TriagePanelProps {
  patientId: string;
  dangerReports: DangerSignReport[];
  activeProfile?: {
    userId: string;
    name: string;
    role: string;
    isProxy?: boolean;
    onBehalfOf?: string;
    permissionLevel?: 'view_only' | 'manage' | 'full';
  };
  onActionDispatched?: () => void;
}

export const TriagePanel: React.FC<TriagePanelProps> = ({
  patientId,
  dangerReports,
  activeProfile,
  onActionDispatched
}) => {
  const [isFollowupOpen, setIsFollowupOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState<string | null>(null);

  const effectiveTriagePatientId = resolvePatientId(patientId);
  const callerRole = (activeProfile as unknown as { role?: string })?.role || 'patient';
  const callerPermission = (activeProfile as unknown as { permissionLevel?: "view_only" | "manage" | "full" })?.permissionLevel || 'manage';
  const isViewOnly = callerPermission === 'view_only';
  const canDispatchDoctor = callerRole === 'doctor' || callerPermission === 'full';
  const isDispatchDisabled = isViewOnly || !canDispatchDoctor;
  const activeReport = dangerReports[0] || (() => {
    try {
      const vaultReports = localVault.getDangerReports(effectiveTriagePatientId);
      if (vaultReports.length > 0) return vaultReports[0];
    } catch { /* intentionally empty */ }
    return {
      reportId: `danger_empty_${effectiveTriagePatientId || 'none'}`,
      patientId: effectiveTriagePatientId,
      symptomTags: [] as unknown as DangerSignReport['symptomTags'],
      freeText: 'No danger signs reported yet. Red flags inferred via AI vision/text will appear here and still require clinician review.',
      severityRating: 'moderate' as const,
      vitalSigns: undefined,
      timestamp: new Date().toISOString(),
      triagePriority: 'ROUTINE' as const,
      firstAidAdvice: 'No active triage. AI triage via vision+text will assess new documents for red flags; clinician review still required.'
    } as DangerSignReport;
  })();

  const getAuditProfile = (): { userId: string; name: string; role: "patient" | "caregiver" | "doctor"; isProxy: boolean; permissionLevel: "view_only" | "manage" | "full"; onBehalfOf?: string } => {
    const ca = (activeProfile || { userId: effectiveTriagePatientId, name: 'Patient', role: 'patient', isProxy: false, permissionLevel: 'manage' }) as unknown as { userId?: string; name?: string; role?: string; isProxy?: boolean; permissionLevel?: "view_only" | "manage" | "full"; onBehalfOf?: string };
    return { userId: ca.userId || effectiveTriagePatientId, name: ca.name || 'Patient', role: (ca.role as "patient" | "caregiver" | "doctor") || 'patient', isProxy: !!ca.isProxy, permissionLevel: (ca.permissionLevel as "view_only" | "manage" | "full") || 'manage', onBehalfOf: ca.onBehalfOf };
  };

  const handleRemoveIbuprofen = async () => {
    if (isViewOnly) {
      eventBus.dispatchToast({ type: 'error', title: 'Permission denied', message: 'View-only cannot dispatch doctor orders (PERMISSION_DENIED)' });
      return;
    }
    if (!canDispatchDoctor) {
      eventBus.dispatchToast({ type: 'error', title: 'Permission denied', message: 'Doctor actions — requires clinician login (PERMISSION_DENIED)' });
      return;
    }
    setIsExecuting('remove_ibuprofen');
    try {
      const res = await webMCPEngine.execute(
        'doctor_remove_medication',
        {
          medName: 'Ibuprofen',
          reason: 'NSAID-induced peripheral fluid retention and acute kidney injury risk in CKD 3b.',
          patientId: effectiveTriagePatientId
        },
        {
          patientId: effectiveTriagePatientId,
          activeProfile: getAuditProfile(),
          vault: localVault,
          eventBus
        }
      );

      if (res.success) {
        eventBus.dispatchToast({
          type: 'warning',
          title: 'Stop Order Dispatched',
          message: 'Your care team ordered immediate discontinuation of Ibuprofen 800mg.'
        });
        eventBus.emit('proposal_submitted', { patientId: effectiveTriagePatientId });
        if (onActionDispatched) onActionDispatched();
      }
    } catch {
      // dispatch failure handled via toast
    } finally {
      setIsExecuting(null);
    }
  };

  const handleTitrateAmlodipine = async () => {
    if (isViewOnly) {
      eventBus.dispatchToast({ type: 'error', title: 'Permission denied', message: 'View-only cannot dispatch dose changes (PERMISSION_DENIED)' });
      return;
    }
    if (!canDispatchDoctor) {
      eventBus.dispatchToast({ type: 'error', title: 'Permission denied', message: 'Doctor actions — requires clinician login (PERMISSION_DENIED)' });
      return;
    }
    setIsExecuting('titrate_amlodipine');
    try {
      const res = await webMCPEngine.execute(
        'doctor_change_dose',
        {
          medName: 'Amlodipine',
          newDose: '10mg PO Daily',
          reason: 'Severe hypertensive crisis (BP 185/105 mmHg). Increasing calcium channel blocker dose for BP control.'
        },
        {
          patientId: effectiveTriagePatientId,
          activeProfile: getAuditProfile(),
          vault: localVault,
          eventBus
        }
      );

      if (res.success) {
        eventBus.dispatchToast({
          type: 'warning',
          title: 'Dose Increase Dispatched',
          message: 'Your care team proposed titrating Amlodipine to 10mg daily.'
        });
        eventBus.emit('proposal_submitted', { patientId: effectiveTriagePatientId });
        if (onActionDispatched) onActionDispatched();
      }
    } catch {
      // dispatch failure handled via toast
    } finally {
      setIsExecuting(null);
    }
  };

  const handleAddDiuretic = async () => {
    if (isViewOnly) {
      eventBus.dispatchToast({ type: 'error', title: 'Permission denied', message: 'View-only cannot add medications (PERMISSION_DENIED)' });
      return;
    }
    if (!canDispatchDoctor) {
      eventBus.dispatchToast({ type: 'error', title: 'Permission denied', message: 'Doctor actions — requires clinician login (PERMISSION_DENIED)' });
      return;
    }
    setIsExecuting('add_furosemide');
    try {
      const res = await webMCPEngine.execute(
        'doctor_add_medication',
        {
          medName: 'Furosemide',
          dose: '20mg PO QAM',
          slot: 'morning',
          reason: 'Initiate loop diuretic for acute pedal edema and bilateral fluid retention.'
        },
        {
          patientId: effectiveTriagePatientId,
          activeProfile: getAuditProfile(),
          vault: localVault,
          eventBus
        }
      );

      if (res.success) {
        eventBus.dispatchToast({
          type: 'warning',
          title: 'Medication Addition Dispatched',
          message: 'Your care team proposed adding Furosemide 20mg QAM.'
        });
        eventBus.emit('proposal_submitted', { patientId: effectiveTriagePatientId });
        if (onActionDispatched) onActionDispatched();
      }
    } catch {
      // dispatch failure handled via toast
    } finally {
      setIsExecuting(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Triage Banner — light clinical */}
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-clinical-red flex items-center justify-center border border-rose-200 shadow-sm">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-caption text-clinical-red uppercase tracking-wider font-bold">
                  Doctor triage dashboard — Your care team
                </span>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-clinical-red text-[10px] font-bold border border-rose-200">
                  PRIORITY: {activeReport.triagePriority || 'URGENT'}
                </span>
              </div>
              <h3 className="text-heading-md text-slate-900">
                Acute safety escalation — Patient (78F)
              </h3>
            </div>
          </div>

          <div className="text-right text-xs text-slate-600">
            <span>Reported: {new Date(activeReport.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Symptoms & Vitals Snapshot */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="bg-canvas-card rounded-xl p-3.5 border border-canvas-border shadow-sm space-y-1">
            <span className="text-caption text-muted font-semibold">Reported symptoms</span>
            <div className="flex flex-wrap gap-1">
              {activeReport.symptomTags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-md bg-rose-50 text-clinical-red text-[11px] font-bold border border-rose-200"
                >
                  {tag.replace('_', ' ').toUpperCase()}
                </span>
              ))}
            </div>
            <p className="text-body-sm text-slate-700 pt-1">{activeReport.freeText}</p>
          </div>

          <div className="bg-canvas-card rounded-xl p-3.5 border border-canvas-border shadow-sm space-y-1">
            <span className="text-caption text-muted font-semibold">Reported vitals</span>
            <div className="text-heading-md text-clinical-red">
              BP: {activeReport.vitalSigns?.systolicBP || 185}/{activeReport.vitalSigns?.diastolicBP || 105} mmHg
            </div>
            <div className="text-body-sm text-slate-700">
              Heart rate: {activeReport.vitalSigns?.heartRate || 92} bpm (elevated)
            </div>
          </div>

          <div className="bg-canvas-card rounded-xl p-3.5 border border-canvas-border shadow-sm space-y-1">
            <span className="text-caption text-muted font-semibold">Clinical photo & lab context</span>
            <div className="flex items-center gap-2 text-body-sm text-accent font-medium">
              <Camera className="w-4 h-4" />
              <span>Ankle_Edema_Photo.jpg (attached)</span>
            </div>
            <div className="text-body-sm text-muted">
              eGFR: <strong className="text-clinical-red">28 mL/min</strong> | K+: 4.8 mEq/L
            </div>
          </div>
        </div>
      </div>

      {/* Doctor Intervention Controls */}
      <div className="bg-canvas-card border border-canvas-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-canvas-border pb-3">
          <div className="flex items-center gap-2">
            <Pill className="w-5 h-5 text-clinical-red" />
            <h4 className="text-heading-md text-slate-900">Doctor remote pillbox actions & emergency orders</h4>
          </div>
          <span className="text-caption text-muted">Staged for human approval</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Action 1: Remove Ibuprofen */}
          <div className="bg-canvas-muted rounded-xl p-4 border border-rose-200 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <span className="text-caption uppercase font-bold text-clinical-red tracking-wider">
                  Emergency stop order
                </span>
                <h5 className="text-heading-md text-slate-800">Discontinue Ibuprofen 800mg TID</h5>
                <p className="text-body-sm text-muted leading-relaxed">
                  NSAID causes severe sodium/fluid retention and acute renal perfusion drop in CKD Stage 3b.
                </p>
              </div>
              <Trash2 className="w-5 h-5 text-clinical-red shrink-0" />
            </div>

            <button
              onClick={handleRemoveIbuprofen}
              disabled={isExecuting === 'remove_ibuprofen' || isDispatchDisabled}
              aria-disabled={isDispatchDisabled}
              title={isDispatchDisabled ? (isViewOnly ? 'View-only: cannot dispatch — PERMISSION_DENIED' : 'Doctor actions — requires clinician login') : undefined}
              className={`w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-md min-h-[44px] ${isDispatchDisabled ? 'bg-slate-300 cursor-not-allowed opacity-60 shadow-none' : 'bg-rose-600 hover:bg-rose-500'}`}
            >
              <Send className="w-4 h-4 shrink-0" />
              <span>{isExecuting === 'remove_ibuprofen' ? 'Dispatching...' : 'Dispatch Stop Order'}</span>
              <span className="hidden sm:inline font-mono opacity-80">(doctor_remove_medication)</span>
            </button>
            {isDispatchDisabled && <p className="text-caption text-amber-700 font-semibold">Doctor actions — requires clinician login {isViewOnly ? '(view_only PERMISSION_DENIED)' : ''}</p>}
          </div>

          {/* Action 2: Titrate Amlodipine */}
          <div className="bg-canvas-muted rounded-xl p-4 border border-sky-200 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <span className="text-caption uppercase font-bold text-clinical-blue tracking-wider">
                  Hypertension titration
                </span>
                <h5 className="text-heading-md text-slate-800">Increase Amlodipine 5mg → 10mg Daily</h5>
                <p className="text-body-sm text-muted leading-relaxed">
                  Escalate calcium channel blocker to safely reduce severe blood pressure spikes (185/105 mmHg).
                </p>
              </div>
              <TrendingUp className="w-5 h-5 text-clinical-blue shrink-0" />
            </div>

            <button
              onClick={handleTitrateAmlodipine}
              disabled={isExecuting === 'titrate_amlodipine' || isDispatchDisabled}
              aria-disabled={isDispatchDisabled}
              title={isDispatchDisabled ? (isViewOnly ? 'View-only: cannot dispatch — PERMISSION_DENIED' : 'Doctor actions — requires clinician login') : undefined}
              className={`w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-md min-h-[44px] ${isDispatchDisabled ? 'bg-slate-300 cursor-not-allowed opacity-60 shadow-none' : 'bg-sky-600 hover:bg-sky-500'}`}
            >
              <Send className="w-4 h-4 shrink-0" />
              <span>{isExecuting === 'titrate_amlodipine' ? 'Dispatching...' : 'Dispatch Dose Increase'}</span>
              <span className="hidden sm:inline font-mono opacity-80">(doctor_change_dose)</span>
            </button>
            {isDispatchDisabled && <p className="text-caption text-amber-700 font-semibold">Doctor actions — requires clinician login {isViewOnly ? '(view_only PERMISSION_DENIED)' : ''}</p>}
          </div>

          {/* Action 3: Add Diuretic */}
          <div className="bg-canvas-muted rounded-xl p-4 border border-emerald-200 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <span className="text-caption uppercase font-bold text-clinical-emerald tracking-wider">
                  Fluid overload diuretic
                </span>
                <h5 className="text-heading-md text-slate-800">Add Furosemide 20mg PO QAM</h5>
                <p className="text-body-sm text-muted leading-relaxed">
                  Initiate low-dose loop diuretic for rapid symptomatic relief of bilateral ankle edema.
                </p>
              </div>
              <PlusCircle className="w-5 h-5 text-clinical-emerald shrink-0" />
            </div>

            <button
              onClick={handleAddDiuretic}
              disabled={isExecuting === 'add_furosemide' || isDispatchDisabled}
              aria-disabled={isDispatchDisabled}
              title={isDispatchDisabled ? (isViewOnly ? 'View-only: cannot dispatch — PERMISSION_DENIED' : 'Doctor actions — requires clinician login') : undefined}
              className={`w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-md min-h-[44px] ${isDispatchDisabled ? 'bg-slate-300 cursor-not-allowed opacity-60 shadow-none' : 'bg-emerald-600 hover:bg-emerald-500'}`}
            >
              <Send className="w-4 h-4 shrink-0" />
              <span>{isExecuting === 'add_furosemide' ? 'Dispatching...' : 'Dispatch Add Medication'}</span>
              <span className="hidden sm:inline font-mono opacity-80">(doctor_add_medication)</span>
            </button>
            {isDispatchDisabled && <p className="text-caption text-amber-700 font-semibold">Doctor actions — requires clinician login {isViewOnly ? '(view_only PERMISSION_DENIED)' : ''}</p>}
          </div>

          {/* Action 4: Urgent Follow-Up */}
          <div className="bg-canvas-muted rounded-xl p-4 border border-primary-border space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <span className="text-caption uppercase font-bold text-primary tracking-wider">
                  Clinical evaluation
                </span>
                <h5 className="text-heading-md text-slate-800">Order urgent clinic review</h5>
                <p className="text-body-sm text-muted leading-relaxed">
                  In-clinic evaluation in 3 days with automated 24h & 2h patient reminders and iCal sync.
                </p>
              </div>
              <Calendar className="w-5 h-5 text-primary shrink-0" />
            </div>

            <button
              onClick={() => {
                if (isViewOnly) {
                  eventBus.dispatchToast({ type: 'error', title: 'Permission denied', message: 'View-only cannot schedule (PERMISSION_DENIED)' });
                  return;
                }
                if (!canDispatchDoctor) {
                  eventBus.dispatchToast({ type: 'error', title: 'Permission denied', message: 'Doctor actions — requires clinician login (PERMISSION_DENIED)' });
                  return;
                }
                setIsFollowupOpen(true);
              }}
              disabled={isDispatchDisabled}
              aria-disabled={isDispatchDisabled}
              title={isDispatchDisabled ? (isViewOnly ? 'View-only: cannot schedule — PERMISSION_DENIED' : 'Doctor actions — requires clinician login') : undefined}
              className={`w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-md min-h-[44px] ${isDispatchDisabled ? 'bg-slate-300 cursor-not-allowed opacity-60 shadow-none' : 'bg-primary hover:bg-primary-hover'}`}
            >
              <Calendar className="w-4 h-4 shrink-0" />
              <span>Configure Follow-Up Order</span>
              <span className="hidden sm:inline font-mono opacity-80">(schedule_followup)</span>
            </button>
            {isDispatchDisabled && <p className="text-caption text-amber-700 font-semibold">Doctor actions — requires clinician login {isViewOnly ? '(view_only PERMISSION_DENIED)' : ''}</p>}
          </div>
        </div>
      </div>

      {/* Followup Scheduler Modal — pass activeProfile for RBAC */}
      <FollowupScheduler
        isOpen={isFollowupOpen}
        onClose={() => setIsFollowupOpen(false)}
        patientId={effectiveTriagePatientId}
        activeProfile={activeProfile as unknown as { userId: string; name: string; role: "patient" | "caregiver" | "doctor"; isProxy?: boolean; onBehalfOf?: string; permissionLevel?: "view_only" | "manage" | "full" }}
        onScheduled={onActionDispatched}
      />
    </div>
  );
};
