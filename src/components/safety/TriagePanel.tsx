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
import { FollowupScheduler } from './FollowupScheduler';

interface TriagePanelProps {
  patientId: string;
  dangerReports: DangerSignReport[];
  onActionDispatched?: () => void;
}

export const TriagePanel: React.FC<TriagePanelProps> = ({
  patientId,
  dangerReports,
  onActionDispatched
}) => {
  const [isFollowupOpen, setIsFollowupOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState<string | null>(null);

  const activeReport = dangerReports[0] || {
    reportId: 'danger_edema_001',
    patientId,
    symptomTags: ['edema_feet', 'dyspnea'],
    freeText: 'Sudden bilateral ankle swelling and shortness of breath climbing stairs.',
    severityRating: 'severe' as const,
    vitalSigns: { systolicBP: 185, diastolicBP: 105, heartRate: 92 },
    timestamp: new Date().toISOString(),
    triagePriority: 'URGENT' as const,
    firstAidAdvice: "Alert dispatched to Dr. Patel's triage queue."
  };

  // Remote Pillbox Action 1: Remove NSAID Ibuprofen
  const handleRemoveIbuprofen = async () => {
    setIsExecuting('remove_ibuprofen');
    try {
      const res = await webMCPEngine.execute(
        'doctor_remove_medication',
        {
          medName: 'Ibuprofen',
          reason: 'NSAID-induced peripheral fluid retention and acute kidney injury risk in CKD 3b.',
          patientId
        },
        {
          patientId,
          activeProfile: { userId: 'dr_patel_md', name: 'Dr. Anita Patel, MD', role: 'doctor', isProxy: false },
          vault: localVault,
          eventBus
        }
      );

      if (res.success) {
        eventBus.dispatchToast({
          type: 'warning',
          title: 'Stop Order Dispatched',
          message: 'Dr. Patel ordered immediate discontinuation of Ibuprofen 800mg.'
        });
        eventBus.emit('proposal_submitted', { patientId });
        if (onActionDispatched) onActionDispatched();
      }
    } catch (err) {
      console.error('Error removing medication:', err);
    } finally {
      setIsExecuting(null);
    }
  };

  // Remote Pillbox Action 2: Titrate Amlodipine 5mg -> 10mg
  const handleTitrateAmlodipine = async () => {
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
          patientId,
          activeProfile: { userId: 'dr_patel_md', name: 'Dr. Anita Patel, MD', role: 'doctor', isProxy: false },
          vault: localVault,
          eventBus
        }
      );

      if (res.success) {
        eventBus.dispatchToast({
          type: 'warning',
          title: 'Dose Increase Dispatched',
          message: 'Dr. Patel proposed titrating Amlodipine to 10mg daily.'
        });
        eventBus.emit('proposal_submitted', { patientId });
        if (onActionDispatched) onActionDispatched();
      }
    } catch (err) {
      console.error('Error titrating dose:', err);
    } finally {
      setIsExecuting(null);
    }
  };

  // Remote Pillbox Action 3: Add Diuretic Furosemide
  const handleAddDiuretic = async () => {
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
          patientId,
          activeProfile: { userId: 'dr_patel_md', name: 'Dr. Anita Patel, MD', role: 'doctor', isProxy: false },
          vault: localVault,
          eventBus
        }
      );

      if (res.success) {
        eventBus.dispatchToast({
          type: 'warning',
          title: 'Medication Addition Dispatched',
          message: 'Dr. Patel proposed adding Furosemide 20mg QAM.'
        });
        eventBus.emit('proposal_submitted', { patientId });
        if (onActionDispatched) onActionDispatched();
      }
    } catch (err) {
      console.error('Error adding diuretic:', err);
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
                  Doctor triage dashboard — Dr. Anita Patel, MD
                </span>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-clinical-red text-[10px] font-bold border border-rose-200 animate-pulse">
                  PRIORITY: {activeReport.triagePriority || 'URGENT'}
                </span>
              </div>
              <h3 className="text-heading-md text-slate-900">
                Acute safety escalation — Smt. Shanti Devi (78F)
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
              disabled={isExecuting === 'remove_ibuprofen'}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/20"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isExecuting === 'remove_ibuprofen' ? 'Dispatching...' : 'Dispatch Stop Order (doctor_remove_medication)'}</span>
            </button>
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
              disabled={isExecuting === 'titrate_amlodipine'}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-sky-600/20"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isExecuting === 'titrate_amlodipine' ? 'Dispatching...' : 'Dispatch Dose Increase (doctor_change_dose)'}</span>
            </button>
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
              disabled={isExecuting === 'add_furosemide'}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isExecuting === 'add_furosemide' ? 'Dispatching...' : 'Dispatch Add Medication (doctor_add_medication)'}</span>
            </button>
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
              onClick={() => setIsFollowupOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Configure Follow-Up Order (schedule_followup)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Followup Scheduler Modal */}
      <FollowupScheduler
        isOpen={isFollowupOpen}
        onClose={() => setIsFollowupOpen(false)}
        patientId={patientId}
        onScheduled={onActionDispatched}
      />
    </div>
  );
};
