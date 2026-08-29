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
      {/* Triage Banner */}
      <div className="bg-gradient-to-r from-rose-950/60 via-slate-900 to-slate-900 border border-rose-500/40 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/40">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-rose-400 uppercase tracking-wider font-bold">
                  Doctor Triage Dashboard (Dr. Anita Patel, MD)
                </span>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/40 animate-pulse">
                  PRIORITY: {activeReport.triagePriority || 'URGENT'}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-100">
                Acute Safety Escalation: Smt. Shanti Devi (78F)
              </h3>
            </div>
          </div>

          <div className="text-right text-xs text-slate-400">
            <span>Reported: {new Date(activeReport.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Symptoms & Vitals Snapshot */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="bg-slate-950 rounded-2xl p-3.5 border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 font-semibold">Reported Symptoms</span>
            <div className="flex flex-wrap gap-1">
              {activeReport.symptomTags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 text-[11px] font-bold border border-rose-500/30"
                >
                  {tag.replace('_', ' ').toUpperCase()}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-slate-300 pt-1">{activeReport.freeText}</p>
          </div>

          <div className="bg-slate-950 rounded-2xl p-3.5 border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 font-semibold">Reported Vitals</span>
            <div className="text-sm font-black text-rose-400">
              BP: {activeReport.vitalSigns?.systolicBP || 185}/{activeReport.vitalSigns?.diastolicBP || 105} mmHg
            </div>
            <div className="text-xs text-slate-300">
              Heart Rate: {activeReport.vitalSigns?.heartRate || 92} bpm (Elevated)
            </div>
          </div>

          <div className="bg-slate-950 rounded-2xl p-3.5 border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 font-semibold">Clinical Photo & Lab Context</span>
            <div className="flex items-center gap-2 text-xs text-sky-400 font-medium">
              <Camera className="w-4 h-4" />
              <span>Ankle_Edema_Photo.jpg (Attached)</span>
            </div>
            <div className="text-xs text-slate-400">
              eGFR: <strong className="text-rose-400">28 mL/min</strong> | K+: 4.8 mEq/L
            </div>
          </div>
        </div>
      </div>

      {/* Doctor Intervention Controls (SF3) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Pill className="w-5 h-5 text-rose-400" />
            <h4 className="text-sm font-bold text-slate-100">Doctor Remote Pillbox Actions & Emergency Orders</h4>
          </div>
          <span className="text-[11px] text-slate-400">Staged for human approval</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Action 1: Remove Ibuprofen */}
          <div className="bg-slate-950 rounded-2xl p-4 border border-rose-500/30 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">
                  Emergency Stop Order
                </span>
                <h5 className="text-sm font-bold text-slate-200">Discontinue Ibuprofen 800mg TID</h5>
                <p className="text-xs text-slate-400 leading-relaxed">
                  NSAID causes severe sodium/fluid retention and acute renal perfusion drop in CKD Stage 3b.
                </p>
              </div>
              <Trash2 className="w-5 h-5 text-rose-400 shrink-0" />
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
          <div className="bg-slate-950 rounded-2xl p-4 border border-sky-500/30 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-sky-400 tracking-wider">
                  Hypertension Titration
                </span>
                <h5 className="text-sm font-bold text-slate-200">Increase Amlodipine 5mg → 10mg Daily</h5>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Escalate calcium channel blocker to safely reduce severe blood pressure spikes (185/105 mmHg).
                </p>
              </div>
              <TrendingUp className="w-5 h-5 text-sky-400 shrink-0" />
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
          <div className="bg-slate-950 rounded-2xl p-4 border border-emerald-500/30 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                  Fluid Overload Diuretic
                </span>
                <h5 className="text-sm font-bold text-slate-200">Add Furosemide 20mg PO QAM</h5>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Initiate low-dose loop diuretic for rapid symptomatic relief of bilateral ankle edema.
                </p>
              </div>
              <PlusCircle className="w-5 h-5 text-emerald-400 shrink-0" />
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
          <div className="bg-slate-950 rounded-2xl p-4 border border-indigo-500/30 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
                  Clinical Evaluation
                </span>
                <h5 className="text-sm font-bold text-slate-200">Order Urgent Clinic Review</h5>
                <p className="text-xs text-slate-400 leading-relaxed">
                  In-clinic evaluation in 3 days with automated 24h & 2h patient reminders and iCal sync.
                </p>
              </div>
              <Calendar className="w-5 h-5 text-indigo-400 shrink-0" />
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
