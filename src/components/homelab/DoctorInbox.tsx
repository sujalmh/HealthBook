import React, { useState } from 'react';
import {
  Inbox,
  Pin,
  HeartPulse,
  Send,
  Sparkles,
  Calendar,
  AlertTriangle,
  FileText,
  User,
  CheckCircle2,
  PlusCircle,
  Activity,
  Layers
} from 'lucide-react';
import type { LabRecord } from '@/types/vault';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';

interface DoctorInboxProps {
  patientId: string;
  labs: LabRecord[];
  onProposalCreated?: () => void;
  onCommentPinned?: () => void;
}

export const DoctorInbox: React.FC<DoctorInboxProps> = ({
  patientId,
  labs,
  onProposalCreated,
  onCommentPinned
}) => {
  // Pinned Note Form
  const [selectedLabId, setSelectedLabId] = useState<string>(labs[0]?.id || 'lab_egfr_current');
  const [pinnedText, setPinnedText] = useState<string>(
    'Stage 4 renal strain detected. eGFR 28 mL/min. Halve Metformin to 500mg QAM to avoid lactic acidosis.'
  );
  const [isPinning, setIsPinning] = useState(false);

  // Proposal Builder Form
  const [propMedName, setPropMedName] = useState('Metformin');
  const [propCurrentDose, setPropCurrentDose] = useState('1000mg BID');
  const [propNewDose, setPropNewDose] = useState('500mg Daily (Morning Only)');
  const [propReason, setPropReason] = useState(
    'Kidney filtration decreased to 28 mL/min on remote lab slip. Dose reduction avoids drug accumulation.'
  );
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);

  // Cadence Form
  const [nextCadence, setNextCadence] = useState('4_weeks');
  const [cadenceTestPanel, setCadenceTestPanel] = useState('Repeat eGFR & Serum Potassium');
  const [isSchedulingCadence, setIsSchedulingCadence] = useState(false);

  const handlePinComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinnedText.trim()) return;

    setIsPinning(true);
    try {
      const res = await webMCPEngine.execute(
        'doctor_review_comment',
        {
          labId: selectedLabId,
          commentText: pinnedText,
          doctorName: 'Dr. Anita Patel, MD (Nephrology)',
          doctorId: 'dr_patel_md',
          pinnedMarker: 'eGFR 28 mL/min'
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
          type: 'success',
          title: 'Clinical Note Pinned (📌)',
          message: 'Note anchored to longitudinal LabStory chart.'
        });
        eventBus.emit('lab_status_changed', { labId: selectedLabId });
        if (onCommentPinned) onCommentPinned();
      }
    } catch (err) {
      console.error('Error pinning doctor comment:', err);
    } finally {
      setIsPinning(false);
    }
  };

  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propMedName || !propNewDose || !propReason) return;

    setIsSubmittingProposal(true);
    try {
      const res = await webMCPEngine.execute(
        'propose_dosage_change',
        {
          medName: propMedName,
          currentDose: propCurrentDose,
          proposedDose: propNewDose,
          reason: propReason,
          doctorName: 'Dr. Anita Patel, MD',
          linkedLabId: selectedLabId
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
          title: 'Dosage Proposal Staged',
          message: `Proposed ${propMedName} ${propNewDose}. Delivered to patient action queue.`
        });
        eventBus.emit('proposal_submitted', { patientId });
        if (onProposalCreated) onProposalCreated();
      }
    } catch (err) {
      console.error('Error submitting proposal:', err);
    } finally {
      setIsSubmittingProposal(false);
    }
  };

  const handleScheduleCadence = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSchedulingCadence(true);
    try {
      const res = await webMCPEngine.execute(
        'schedule_lab',
        {
          cadence: nextCadence,
          testPanel: cadenceTestPanel,
          targetDate: new Date(Date.now() + 28 * 86400000).toISOString()
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
          type: 'info',
          title: 'Next Cadence Set',
          message: `Repeat lab cadence set for 4 weeks: ${cadenceTestPanel}.`
        });
        eventBus.emit('due_card_added', res.data);
      }
    } catch (err) {
      console.error('Error scheduling lab cadence:', err);
    } finally {
      setIsSchedulingCadence(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Clinician Header */}
      <div className="bg-gradient-to-r from-indigo-50 via-slate-50 to-white border border-indigo-200 rounded-3xl p-6 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-inner">
            <Inbox className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-indigo-400 uppercase tracking-wider font-bold">
                Doctor Triage & Review Inbox
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                Dr. Anita Patel, MD (Active)
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Remote Patient Monitoring: Shanti Devi (78F)
            </h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Pinned Annotation Creator (📌) */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <Pin className="w-5 h-5 text-amber-400" />
              <h4 className="text-sm font-bold text-slate-900">Pin Clinical Note to LabStory Chart (📌)</h4>
            </div>
            <span className="text-[11px] text-slate-600">Anchors to lab point</span>
          </div>

          <form onSubmit={handlePinComment} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Select Lab Result Point</label>
              <select
                value={selectedLabId}
                onChange={(e) => setSelectedLabId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
              >
                {labs.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.marker}: {l.value} {l.unit} ({new Date(l.drawDate).toLocaleDateString()}) - {l.flag || 'NORMAL'}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Clinical Comment & Interpretation</label>
              <textarea
                value={pinnedText}
                onChange={(e) => setPinnedText(e.target.value)}
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 leading-relaxed placeholder-slate-500"
                placeholder="Enter authenticated clinical observation..."
              />
            </div>

            <button
              type="submit"
              disabled={isPinning || !pinnedText.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-amber-600/20"
            >
              <Pin className="w-4 h-4" />
              <span>{isPinning ? 'Pinning to Chart...' : 'Pin Note to Patient Lab Timeline (📌)'}</span>
            </button>
          </form>
        </div>

        {/* Right Column: Dosage Proposal Builder */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <HeartPulse className="w-5 h-5 text-rose-400" />
              <h4 className="text-sm font-bold text-slate-900">Build Medication Dosage Proposal</h4>
            </div>
            <span className="text-[11px] text-slate-600">Dispatches proposal card</span>
          </div>

          <form onSubmit={handleSubmitProposal} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Target Medication</label>
                <input
                  type="text"
                  value={propMedName}
                  onChange={(e) => setPropMedName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold"
                  placeholder="e.g. Metformin"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Current Dose</label>
                <input
                  type="text"
                  value={propCurrentDose}
                  onChange={(e) => setPropCurrentDose(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                  placeholder="e.g. 1000mg BID"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Proposed New Regimen</label>
              <input
                type="text"
                value={propNewDose}
                onChange={(e) => setPropNewDose(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-emerald-400 font-bold"
                placeholder="e.g. 500mg Daily (Morning Only)"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Clinical Rationale for Patient</label>
              <textarea
                value={propReason}
                onChange={(e) => setPropReason(e.target.value)}
                rows={2}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 leading-relaxed placeholder-slate-500"
                placeholder="Explain the medical reason in patient-friendly terms..."
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingProposal || !propMedName || !propNewDose}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/20"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmittingProposal ? 'Staging Proposal...' : 'Stage Dosage Proposal for Patient Approval'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Auto-Set Next Lab Cadence (HL7) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-sky-400" />
            <h4 className="text-sm font-bold text-slate-900">Set Next Lab Cadence (Auto-Spawns Due Card)</h4>
          </div>
          <span className="text-[11px] text-slate-600">Doctor Prescribed Cadence</span>
        </div>

        <form onSubmit={handleScheduleCadence} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Monitoring Cadence</label>
            <select
              value={nextCadence}
              onChange={(e) => setNextCadence(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
            >
              <option value="2_weeks">Repeat in 2 Weeks</option>
              <option value="4_weeks">Repeat in 4 Weeks (1 Month)</option>
              <option value="3_months">Repeat in 3 Months (Quarterly)</option>
              <option value="6_months">Repeat in 6 Months</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Lab Test Panel</label>
            <input
              type="text"
              value={cadenceTestPanel}
              onChange={(e) => setCadenceTestPanel(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold"
              placeholder="e.g. Creatinine & eGFR Blood Test"
            />
          </div>

          <button
            type="submit"
            disabled={isSchedulingCadence}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-sky-600/20"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{isSchedulingCadence ? 'Setting Cadence...' : 'Prescribe Lab Cadence'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
