import React, { useState, useEffect } from 'react';
import {
  HeartPulse,
  Calendar,
  UploadCloud,
  FileText,
  Clock,
  Sparkles,
  Shield,
  UserCheck,
  Stethoscope,
  Activity,
  AlertTriangle,
  RefreshCw,
  Plus,
  CheckCircle2
} from 'lucide-react';
import { DueCardList } from './DueCardList';
import { UploadLabModal } from './UploadLabModal';
import { ProposalCard } from './ProposalCard';
import { DoctorInbox } from './DoctorInbox';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';
import type { DueCardRecord, ProposalRecord, LabRecord } from '@/types/vault';

interface HomeLabViewProps {
  patientId: string;
  activeProfile?: {
    userId: string;
    name: string;
    role: string;
    isProxy?: boolean;
    relationship?: string;
    onBehalfOf?: string;
  };
}

export const HomeLabView: React.FC<HomeLabViewProps> = ({
  patientId,
  activeProfile = { userId: patientId, name: 'Patient', role: 'patient' }
}) => {
  const [activeTab, setActiveTab] = useState<'patient_loop' | 'doctor_inbox'>('patient_loop');
  const [dueCards, setDueCards] = useState<DueCardRecord[]>([]);
  const [proposals, setProposals] = useState<ProposalRecord[]>([]);
  const [labs, setLabs] = useState<LabRecord[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedDueCardId, setSelectedDueCardId] = useState<string | undefined>(undefined);

  const loadData = () => {
    // Read-only vault loads — no per-view seeding (centralized src/core/vault/seed.ts owns baseline via main.tsx bootstrap).
    const cards = localVault.getDueCards(patientId);
    setDueCards(cards);

    const props = localVault.getProposals(patientId);
    setProposals(props);

    const patientLabs = localVault.getLabs(patientId);
    setLabs(patientLabs);
  };

  // M2 Relevant-only: HomeLab listens to due_card_* , proposal_created/status_changed (alias proposal_submitted), lab_added (alias lab_extracted), fact_confirmed
  // medication_* / danger_* / calendar_* are irrelevant — spurious guard
  // Alias dispatch covers legacy proposal_submitted / lab_extracted without double subscription.
  useEffect(() => {
    loadData();

    const guard = (p: any) => !p || !p.patientId || p.patientId === patientId;
    const mk = (h: () => void) => (payload: any) => { if (guard(payload)) h(); };

    const u1 = eventBus.on('due_card_added', mk(loadData));
    const u2 = eventBus.on('due_card_updated', mk(loadData));
    const u3 = eventBus.on('proposal_created', mk(loadData));
    const u4 = eventBus.on('proposal_status_changed', mk(loadData));
    const u5 = eventBus.on('lab_added', mk(loadData));
    const u6 = eventBus.on('fact_confirmed', mk(loadData));

    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
    };
  }, [patientId]);

  const handleOpenUpload = (cardId?: string) => {
    setSelectedDueCardId(cardId);
    setIsUploadModalOpen(true);
  };

  const handleCompleteCard = (cardId: string) => {
    localVault.updateDueCard(cardId, { status: 'completed' });
    loadData();
    eventBus.dispatchToast({
      type: 'success',
      title: 'Lab Card Completed',
      message: 'Prescribed due card marked as completed.'
    });
  };

  const pendingProposals = proposals.filter((p) => p.status === 'pending');
  const activeDueCards = dueCards.filter((c) => c.status !== 'completed');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner & Mode Toggle */}
      <div className="bg-white border border-canvas-border rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
            <HeartPulse className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-heading-lg text-slate-900 tracking-tight">Tests to Do</h2>
              <span className="text-caption px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-semibold border border-rose-200">
                From your doctor
              </span>
            </div>
            <p className="text-body-sm text-muted">
              Tests your doctor asked you to do at home — upload a photo and see dose changes.
            </p>
          </div>
        </div>

        {/* View Mode Tabs: Patient Remote Loop vs Doctor Review */}
        <div className="flex items-center bg-canvas-muted p-1 rounded-2xl border border-canvas-border self-start md:self-auto">
          <button
            onClick={() => setActiveTab('patient_loop')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-body-sm font-semibold transition-all min-h-[44px] ${
              activeTab === 'patient_loop'
                ? 'bg-primary text-white shadow-sm'
                : 'text-muted hover:text-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>My Tasks</span>
            {activeDueCards.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-white text-caption font-mono">
                {activeDueCards.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('doctor_inbox')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-body-sm font-semibold transition-all min-h-[44px] ${
              activeTab === 'doctor_inbox'
                ? 'bg-primary text-white shadow-sm'
                : 'text-muted hover:text-slate-800'
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            <span>Doctor's View</span>
            {pendingProposals.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-caption font-mono border border-amber-200">
                {pendingProposals.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'patient_loop' ? (
        <div className="space-y-6">
          {/* Section 1: Prescribed Due Cards */}
          <div className="bg-white border border-canvas-border rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <DueCardList
              dueCards={dueCards}
              onUploadClick={handleOpenUpload}
              onCompleteCard={handleCompleteCard}
            />
          </div>

          {/* Section 2: Active Doctor Dosage Proposals */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-rose-500" />
                <h3 className="text-heading-md text-slate-900">Dose Changes From Your Doctor</h3>
              </div>
              <span className="text-body-sm text-muted">
                {pendingProposals.length} waiting for your okay
              </span>
            </div>

            {proposals.length === 0 ? (
              <div className="bg-canvas-muted border border-canvas-border rounded-2xl p-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="text-body-sm font-semibold text-slate-800">You're all caught up!</p>
                <p className="text-body-sm text-muted">No dose changes right now.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {proposals.map((proposal) => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    activeProfile={activeProfile}
                    onDecision={() => loadData()}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Doctor Review Inbox Tab */
        <DoctorInbox
          patientId={patientId}
          labs={labs}
          onProposalCreated={() => loadData()}
          onCommentPinned={() => loadData()}
        />
      )}

      {/* Upload Lab Modal */}
      <UploadLabModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        linkedDueCardId={selectedDueCardId}
        patientId={patientId}
        onSuccess={() => loadData()}
      />
    </div>
  );
};
