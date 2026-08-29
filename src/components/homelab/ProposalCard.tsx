import React, { useState } from 'react';
import {
  HeartPulse,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  UserCheck,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Edit2
} from 'lucide-react';
import type { ProposalRecord } from '@/types/vault';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';

interface ProposalCardProps {
  proposal: ProposalRecord;
  activeProfile?: {
    userId: string;
    name: string;
    role: string;
    isProxy?: boolean;
    relationship?: string;
    onBehalfOf?: string;
  };
  onDecision?: (proposalId: string, decision: 'approved' | 'rejected') => void;
}

export const ProposalCard: React.FC<ProposalCardProps> = ({
  proposal,
  activeProfile = { userId: 'patient-s-devi', name: 'Shanti Devi', role: 'patient' },
  onDecision
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isQuestionAdded, setIsQuestionAdded] = useState(false);

  const isPending = proposal.status === 'pending';
  const isApproved = proposal.status === 'approved';
  const isRejected = proposal.status === 'rejected';

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      // 1. Approve proposal
      const res = await webMCPEngine.execute(
        'approve_dosage_change',
        {
          proposalId: proposal.id,
          action: 'approve',
          approvedBy: activeProfile.name,
          role: activeProfile.role,
          onBehalfOf: activeProfile.isProxy ? (activeProfile.onBehalfOf || 'Shanti Devi') : undefined
        },
        {
          patientId: proposal.patientId,
          activeProfile: {
            userId: activeProfile.userId,
            name: activeProfile.name,
            role: activeProfile.role as any,
            isProxy: !!activeProfile.isProxy,
            onBehalfOf: activeProfile.onBehalfOf
          },
          vault: localVault,
          eventBus
        }
      );

      // 2. Sync PillMap and trigger diff animation
      await webMCPEngine.execute(
        'sync_pillmap_from_proposal',
        { proposalId: proposal.id },
        {
          patientId: proposal.patientId,
          activeProfile: {
            userId: activeProfile.userId,
            name: activeProfile.name,
            role: activeProfile.role as any,
            isProxy: !!activeProfile.isProxy
          },
          vault: localVault,
          eventBus
        }
      );

      eventBus.dispatchToast({
        type: 'success',
        title: 'Dosage Change Approved',
        message: `${proposal.medName} updated to ${proposal.proposedDose}. PillMap & LabStory updated.`
      });

      eventBus.emit('proposal_status_changed', { ...proposal, status: 'approved' });
      if (onDecision) onDecision(proposal.id, 'approved');
    } catch (err) {
      console.error('Error approving proposal:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await webMCPEngine.execute(
        'approve_dosage_change',
        {
          proposalId: proposal.id,
          action: 'reject',
          approvedBy: activeProfile.name
        },
        {
          patientId: proposal.patientId,
          activeProfile: {
            userId: activeProfile.userId,
            name: activeProfile.name,
            role: activeProfile.role as any,
            isProxy: !!activeProfile.isProxy
          },
          vault: localVault,
          eventBus
        }
      );

      eventBus.dispatchToast({
        type: 'info',
        title: 'Proposal Rejected',
        message: `Proposal for ${proposal.medName} was rejected. Current dose retained.`
      });

      eventBus.emit('proposal_status_changed', { ...proposal, status: 'rejected' });
      if (onDecision) onDecision(proposal.id, 'rejected');
    } catch (err) {
      console.error('Error rejecting proposal:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddQuestionToBank = () => {
    const qText = `Dr. ${proposal.doctorName}: Why is my ${proposal.medName} being changed to ${proposal.proposedDose}?`;
    localVault.addQuestion({
      id: `q_${Date.now()}`,
      patientId: proposal.patientId,
      questionText: qText,
      category: 'medication_change',
      sourceModule: 'homelab',
      linkedMedName: proposal.medName,
      status: 'pending',
      priority: 'high',
      createdAt: new Date().toISOString()
    });

    setIsQuestionAdded(true);
    eventBus.dispatchToast({
      type: 'info',
      title: 'Question Added',
      message: 'Question added to your Central Doctor Question Bank.'
    });
    eventBus.emit('question_bank', { patientId: proposal.patientId });
  };

  return (
    <div
      className={`rounded-3xl border p-6 transition-all shadow-xl space-y-5 ${
        isPending
          ? 'bg-white border-amber-200 shadow-amber-100'
          : isApproved
          ? 'bg-white border-emerald-200'
          : 'bg-slate-50 border-slate-200 opacity-75'
      }`}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
              isPending
                ? 'bg-amber-500/10 text-amber-400 border-amber-200'
                : isApproved
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            <HeartPulse className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-600 uppercase tracking-wider">
                Doctor Dosage Proposal
              </span>
              {isPending && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 text-[10px] font-bold border border-amber-200 animate-pulse">
                  Pending Your Approval
                </span>
              )}
              {isApproved && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                  Approved & Synchronized
                </span>
              )}
              {isRejected && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-700 text-[10px] font-bold border border-rose-200">
                  Rejected
                </span>
              )}
            </div>
            <h4 className="text-base font-bold text-slate-900">{proposal.doctorName || 'Dr. Anita Patel, MD'}</h4>
          </div>
        </div>

        <div className="text-right text-xs text-slate-600">
          <span className="flex items-center gap-1 font-medium">
            <Clock className="w-3.5 h-3.5 text-slate-600" />
            {new Date(proposal.timestamp).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>
      </div>

      {/* Before / After Comparison Banner */}
      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span className="font-semibold uppercase tracking-wider">Medication Regimen Adjustment</span>
          <span className="font-bold text-sky-400">{proposal.medName}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          {/* Current Dose */}
          <div className="bg-white/90 rounded-xl p-3.5 border border-slate-200 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-600 tracking-wider">
              Current Active Regimen
            </span>
            <div className="text-sm font-black text-slate-700 line-through">
              {proposal.previousDose || '1000 mg BID (Morning & Evening)'}
            </div>
            <span className="text-[11px] text-slate-600">2 tablets daily</span>
          </div>

          {/* Proposed Dose */}
          <div className="bg-emerald-50 rounded-xl p-3.5 border border-emerald-200 space-y-1 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                Proposed New Regimen
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-700">
                DOSE HALVED ⬇️
              </span>
            </div>
            <div className="text-sm font-black text-emerald-700">
              {proposal.proposedDose || '500 mg PO Daily (Morning Only)'}
            </div>
            <span className="text-[11px] text-emerald-400/80">1 tablet daily</span>
          </div>
        </div>
      </div>

      {/* Linked Biomarker & Clinical Rationale */}
      <div className="space-y-3">
        {proposal.linkedLabId && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-700">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>Triggered by Lab Result: eGFR = 28 mL/min (Reported Aug 28)</span>
          </div>
        )}

        <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-200 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Sparkles className="w-4 h-4 text-sky-400" />
            Clinician Rationale & Explanation
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            {proposal.reason ||
              proposal.plainNarration ||
              "Kidney filtration marker decreased on today's lab slip. Reducing dose protects renal function while maintaining glycemic stability."}
          </p>
        </div>
      </div>

      {/* Action Buttons / Human In The Loop Gate */}
      {isPending ? (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddQuestionToBank}
              disabled={isQuestionAdded}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                isQuestionAdded
                  ? 'bg-amber-500/20 border-amber-200 text-amber-700'
                  : 'bg-slate-100 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              <HelpCircle className="w-4 h-4 text-amber-400" />
              <span>{isQuestionAdded ? 'Question In Bank' : 'Ask Dr. Patel'}</span>
            </button>

            <button
              onClick={handleReject}
              disabled={isProcessing}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-xs font-semibold border border-slate-200 hover:border-rose-200 transition-colors"
            >
              Reject Change
            </button>
          </div>

          <button
            onClick={handleApprove}
            disabled={isProcessing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/20"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {activeProfile.isProxy ? `Approve on Behalf of ${activeProfile.onBehalfOf || 'Patient'}` : 'Approve Dose Reduction'}
            </span>
          </button>
        </div>
      ) : isApproved ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-xs text-emerald-700 flex items-center justify-between">
          <span className="flex items-center gap-2 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Approved by {proposal.approvedBy || activeProfile.name}
            {proposal.onBehalfOf ? ` on behalf of ${proposal.onBehalfOf}` : ''}
          </span>
          <span className="text-[11px] text-slate-600 font-mono">
            {proposal.approvedAt ? new Date(proposal.approvedAt).toLocaleDateString() : 'Active'}
          </span>
        </div>
      ) : null}
    </div>
  );
};
