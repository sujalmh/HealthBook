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
  activeProfile = { userId: '', name: 'Patient', role: 'patient' },
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
      await webMCPEngine.execute(
        'approve_dosage_change',
        {
          proposalId: proposal.id,
          action: 'approve',
          approvedBy: activeProfile.name,
          role: activeProfile.role,
          onBehalfOf: activeProfile.isProxy ? (activeProfile.onBehalfOf || 'Patient') : undefined
        },
        {
          patientId: proposal.patientId,
          activeProfile: {
            userId: activeProfile.userId,
            name: activeProfile.name,
            role: activeProfile.role as 'patient' | 'caregiver' | 'doctor',
            isProxy: !!activeProfile.isProxy,
            onBehalfOf: activeProfile.onBehalfOf
          },
          vault: localVault,
          eventBus
        }
      );

      await webMCPEngine.execute(
        'sync_pillmap_from_proposal',
        { proposalId: proposal.id },
        {
          patientId: proposal.patientId,
          activeProfile: {
            userId: activeProfile.userId,
            name: activeProfile.name,
            role: activeProfile.role as 'patient' | 'caregiver' | 'doctor',
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
    } catch {
      // approval failure handled via toast
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
            role: activeProfile.role as 'patient' | 'caregiver' | 'doctor',
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
    } catch {
      // reject failure handled via toast
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddQuestionToBank = () => {
    const qText = `${(proposal.doctorName || '').trim() || 'Your doctor'}: Why is my ${proposal.medName} being changed to ${proposal.proposedDose}?`;
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
      className={`rounded-2xl border p-5 sm:p-6 transition-all shadow-sm space-y-5 ${
        isPending
          ? 'bg-white border-amber-200'
          : isApproved
          ? 'bg-white border-emerald-200'
          : 'bg-canvas-muted border-canvas-border opacity-80'
      }`}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
              isPending
                ? 'bg-amber-50 text-amber-600 border-amber-200'
                : isApproved
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                : 'bg-canvas-muted text-muted border-canvas-border'
            }`}
          >
            <HeartPulse className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-caption font-mono text-muted uppercase tracking-wider">
                Doctor Dosage Proposal
              </span>
              {isPending && (
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-caption font-semibold border border-amber-200">
                  Pending Your Approval
                </span>
              )}
              {isApproved && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-caption font-semibold border border-emerald-200">
                  Approved & Synchronized
                </span>
              )}
              {isRejected && (
                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-caption font-semibold border border-rose-200">
                  Rejected
                </span>
              )}
            </div>
            <h4 className="text-heading-md text-slate-900 truncate max-w-[60%] min-w-0">{(proposal.doctorName || '').trim() || 'Your doctor'}</h4>
          </div>
        </div>

        <div className="text-right text-body-sm text-muted">
          <span className="flex items-center gap-1 font-medium">
            <Clock className="w-3.5 h-3.5" />
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
      <div className="bg-canvas-muted rounded-2xl p-4 border border-canvas-border space-y-3">
        <div className="flex items-center justify-between text-body-sm text-muted">
          <span className="font-semibold uppercase tracking-wider">Medication Regimen Adjustment</span>
          <span className="font-semibold text-primary-text">{proposal.medName}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          {/* Current Dose */}
          <div className="bg-white rounded-xl p-3.5 border border-canvas-border space-y-1">
            <span className="text-caption uppercase font-bold text-muted tracking-wider">
              Current Active Regimen
            </span>
            <div className="text-body font-bold text-slate-700 line-through">
              {proposal.previousDose || '1000 mg BID (Morning & Evening)'}
            </div>
            <span className="text-caption text-muted">2 tablets daily</span>
          </div>

          {/* Proposed Dose */}
          <div className="bg-emerald-50 rounded-xl p-3.5 border border-emerald-200 space-y-1 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-caption uppercase font-bold text-emerald-700 tracking-wider">
                Proposed New Regimen
              </span>
              <span className="text-caption font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                DOSE HALVED ⬇️
              </span>
            </div>
            <div className="text-body font-bold text-emerald-800">
              {proposal.proposedDose || '500 mg PO Daily (Morning Only)'}
            </div>
            <span className="text-caption text-emerald-700">1 tablet daily</span>
          </div>
        </div>
      </div>

      {/* Linked Biomarker & Clinical Rationale */}
      <div className="space-y-3">
        {proposal.linkedLabId && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-body-sm font-semibold text-rose-700">
            <AlertCircle className="w-4 h-4 text-rose-500" />
            <span>Triggered by Lab Result: eGFR = 28 mL/min (Reported Aug 28)</span>
          </div>
        )}

        <div className="bg-canvas-muted rounded-2xl p-4 border border-canvas-border space-y-2">
          <div className="flex items-center gap-2 text-body-sm font-bold text-slate-700">
            <Sparkles className="w-4 h-4 text-primary" />
            Why
          </div>
          <p className="text-body-sm text-slate-700 leading-relaxed">
            {proposal.reason?.split('.')[0] ? proposal.reason.split('.')[0] + '.' : proposal.plainNarration?.split('.')[0] ? proposal.plainNarration.split('.')[0] + '.' : "Kidneys at 28. Lower dose safer."}
          </p>
        </div>
      </div>

      {/* Action Buttons / Human In The Loop Gate */}
      {isPending ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-canvas-border">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleAddQuestionToBank}
              disabled={isQuestionAdded}
              className={`flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-body-sm font-semibold border transition-colors min-h-[44px] ${
                isQuestionAdded
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-white hover:bg-canvas-muted border-canvas-border text-slate-700'
              }`}
            >
              <HelpCircle className="w-4 h-4 text-amber-500" />
              <span>{isQuestionAdded ? 'Question In Bank' : `Ask ${(proposal.doctorName || '').trim() || 'your doctor'}`}</span>
            </button>

            <button
              onClick={handleReject}
              disabled={isProcessing}
              className="flex items-center justify-center px-4 py-2.5 rounded-xl bg-white hover:bg-rose-50 text-muted hover:text-rose-700 text-body-sm font-semibold border border-canvas-border hover:border-rose-200 transition-colors min-h-[44px]"
            >
              Reject Change
            </button>
          </div>

          <button
            onClick={handleApprove}
            disabled={isProcessing}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-body-sm font-bold transition-all shadow-sm min-h-[44px]"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {activeProfile.isProxy ? `Approve for ${activeProfile.onBehalfOf || 'Patient'}` : 'Approve Dose Reduction'}
            </span>
          </button>
        </div>
      ) : isApproved ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-body-sm text-emerald-700 flex items-center justify-between">
          <span className="flex items-center gap-2 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Approved by {proposal.approvedBy || activeProfile.name}
            {proposal.onBehalfOf ? ` on behalf of ${proposal.onBehalfOf}` : ''}
          </span>
          <span className="text-caption text-muted font-mono">
            {proposal.approvedAt ? new Date(proposal.approvedAt).toLocaleDateString() : 'Active'}
          </span>
        </div>
      ) : null}
    </div>
  );
};
