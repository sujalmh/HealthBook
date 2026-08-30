import React, { useState, useEffect } from 'react';
import {
  FolderLock,
  Clock,
  AlertOctagon,
  FileText,
  KeyRound,
  Download,
  Shield,
  Activity,
  Pill,
  Sparkles,
  RefreshCw,
  Share2,
  ExternalLink,
  ShieldCheck,
  Check,
  UserCheck
} from 'lucide-react';
import { EmergencySnapshotCard } from './EmergencySnapshotCard';
import { DossierTimeline } from './DossierTimeline';
import { SourceLinkViewer } from './SourceLinkViewer';
import { DoctorAccessModal } from './DoctorAccessModal';
import { DossierExportModal } from './DossierExportModal';
import { localVault } from '@/core/vault/LocalVault';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { eventBus } from '@/core/events/eventBus';
import type {
  CompiledHealthRecord,
  DossierTimelineItem,
  DossierTimelineCategory
} from '@/types/dossier';
import type { DoctorAccessGrant } from '@/types/carecircle';
import type { BoundingBox } from '@/types/vault';

interface DossierViewProps {
  patientId: string;
  activeProfile: {
    userId: string;
    name: string;
    role: string;
    isProxy?: boolean;
    relationship?: string;
    onBehalfOf?: string;
    permissionLevel?: 'view_only' | 'manage' | 'full';
  };
}

export const DossierView: React.FC<DossierViewProps> = ({
  patientId,
  activeProfile
}) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'snapshot' | 'source_inspector' | 'doctor_access'>('timeline');
  const [dossier, setDossier] = useState<CompiledHealthRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDoctorAccessModalOpen, setIsDoctorAccessModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [activeCitationBox, setActiveCitationBox] = useState<BoundingBox | null>(null);
  const [activeDocId, setActiveDocId] = useState<string>('doc_discharge_cardiac_001');
  const [activeDocName, setActiveDocName] = useState<string>('discharge_summary_cardiac_ward.pdf');
  const [activeSnippet, setActiveSnippet] = useState<string | undefined>(undefined);
  const [activePage, setActivePage] = useState<number>(1);

  const loadCompiledDossier = async () => {
    setIsLoading(true);
    try {
      const res = await webMCPEngine.execute(
        'compile_health_record',
        {
          patientId,
          sections: ['all']
        }
      );

      if (res.success && res.data) {
        setDossier(res.data as CompiledHealthRecord);
      }
    } catch (err) {
      console.error('Failed to compile health record in DossierView:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // M2 Relevant-only: Dossier is central timeline — listens broadly to all relevant patient data events
  // Matrix: fact_confirmed (alias fact_status_changed/fact_added), lab_added (alias lab_extracted), medication_added/updated,
  // danger_report_added (alias danger_reported), calendar_event_added, doctor_grant_added/revoked, caregiver_linked, audit_logged, proposal_*, due_card_*, question_added (alias question_bank)
  // Does NOT listen to irrelevant like highlight_document/toast (handled globally)
  // Alias dispatch ensures legacy emits trigger canonical listeners without double subscription.
  useEffect(() => {
    loadCompiledDossier();

    const guard = (p: any) => {
      const pid = p?.patientId ?? p?.patient_id ?? p?.details?.patientId ?? p?.fact?.patientId;
      if (pid) return pid === patientId;
      return false;
    };
    const auditGuard = (p: any) => {
      const pid = p?.patientId ?? p?.patient_id ?? p?.details?.patientId ?? p?.fact?.patientId;
      if (pid) return pid === patientId;
      return true; // audit_logged without patientId is still relevant to Dossier timeline
    };
    const mk = (h: () => void) => (payload: any) => { if (guard(payload)) h(); };
    const mkAudit = (h: () => void) => (payload: any) => { if (auditGuard(payload)) h(); };

    const u1 = eventBus.on('fact_confirmed', mk(loadCompiledDossier));
    const u2 = eventBus.on('medication_updated', mk(loadCompiledDossier));
    const u3 = eventBus.on('medication_added', mk(loadCompiledDossier));
    const u4 = eventBus.on('lab_added', mk(loadCompiledDossier));
    const u5 = eventBus.on('proposal_status_changed', mk(loadCompiledDossier));
    const u6 = eventBus.on('proposal_created', mk(loadCompiledDossier));
    const u7 = eventBus.on('doctor_grant_added', mk(loadCompiledDossier));
    const u8 = eventBus.on('doctor_grant_revoked', mk(loadCompiledDossier));
    const u9 = eventBus.on('audit_logged', mkAudit(loadCompiledDossier));
    const u10 = eventBus.on('danger_report_added', mk(loadCompiledDossier));
    const u11 = eventBus.on('calendar_event_added', mk(loadCompiledDossier));
    const u12 = eventBus.on('caregiver_linked', mk(loadCompiledDossier));
    const u13 = eventBus.on('due_card_added', mk(loadCompiledDossier));
    const u14 = eventBus.on('due_card_updated', mk(loadCompiledDossier));
    const u15 = eventBus.on('question_added', mk(loadCompiledDossier));

    return () => {
      u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9(); u10();
      u11(); u12(); u13(); u14(); u15();
    };
  }, [patientId]);

  const handleOpenSourceViewer = async (item: DossierTimelineItem) => {
    try {
      const res = await webMCPEngine.execute(
        'view_timeline',
        {
          itemId: item.id.replace('tl_fact_', '').replace('tl_lab_', '').replace('tl_prop_', '')
        }
      );

      if (res.success && res.data) {
        setActiveDocId(res.data.documentId || item.sourceDocId || 'doc_discharge_cardiac_001');
        setActiveDocName(res.data.fileName || item.sourceFileName || 'discharge_summary_cardiac_ward.pdf');
        setActiveCitationBox(res.data.boundingBox || item.boundingBox || null);
        setActiveSnippet(res.data.snippetText || item.snippetText);
        setActivePage(res.data.boundingBox?.pageIndex || 1);
      } else {
        if (item.sourceDocId) setActiveDocId(item.sourceDocId);
        if (item.sourceFileName) setActiveDocName(item.sourceFileName);
        if (item.boundingBox) setActiveCitationBox(item.boundingBox);
        if (item.snippetText) setActiveSnippet(item.snippetText);
      }
    } catch (e) {
      if (item.sourceDocId) setActiveDocId(item.sourceDocId);
      if (item.sourceFileName) setActiveDocName(item.sourceFileName);
      if (item.boundingBox) setActiveCitationBox(item.boundingBox);
      if (item.snippetText) setActiveSnippet(item.snippetText);
    }

    setActiveTab('source_inspector');
  };

  const activeGrantsCount = (dossier?.doctorAccessGrants || []).filter(g => g.status === 'active').length;
  const activeMedsCount = dossier?.activeMedications?.length || 0;
  const citationsCount = dossier?.sourceDocumentCitations?.length || 0;
  const labsCount = dossier?.longitudinalLabs?.length || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner — tokenized */}
      <div className="bg-canvas-card border border-canvas-border rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary-light text-primary border border-primary-border flex items-center justify-center shadow-sm">
            <FolderLock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">For My Doctor</h2>
              <span className="text-caption px-2 py-0.5 rounded-full bg-primary-light text-primary-text font-bold border border-primary-border">
                Share all at once
              </span>
            </div>
            <p className="text-body-sm text-muted">
              Everything your doctor needs — medicines, lab results, and notes — ready to share.
            </p>
          </div>
        </div>

        {/* Action Buttons: Export Package, Handover Access, Refresh */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadCompiledDossier}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-canvas-muted hover:bg-canvas-border text-muted text-body-sm font-bold border border-canvas-border transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Refresh dossier"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsDoctorAccessModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-canvas-muted hover:bg-canvas-border text-slate-800 text-body-sm font-bold border border-canvas-border transition-colors shadow-sm min-h-[44px]"
          >
            <KeyRound className="w-4 h-4 text-primary" />
            <span>Share with doctor ({activeGrantsCount})</span>
          </button>

          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-body-sm font-bold transition-all shadow-sm min-h-[44px]"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Metric Quick Strip — tokenized */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-canvas-card border border-canvas-border rounded-xl p-4 flex items-center gap-3 shadow-sm">
          <div className="p-3 rounded-xl bg-sky-50 text-clinical-blue border border-sky-200">
            <Pill className="w-5 h-5" />
          </div>
          <div>
            <span className="text-caption text-muted uppercase font-bold tracking-wider">Medicines now</span>
            <p className="text-heading-md text-slate-900">{activeMedsCount} medicines</p>
          </div>
        </div>

        <div className="bg-canvas-card border border-canvas-border rounded-xl p-4 flex items-center gap-3 shadow-sm">
          <div className="p-3 rounded-xl bg-emerald-50 text-clinical-emerald border border-emerald-200">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="text-caption text-muted uppercase font-bold tracking-wider">Lab results</span>
            <p className="text-heading-md text-slate-900">{labsCount} results</p>
          </div>
        </div>

        <div className="bg-canvas-card border border-canvas-border rounded-xl p-4 flex items-center gap-3 shadow-sm">
          <div className="p-3 rounded-xl bg-amber-50 text-clinical-amber border border-amber-200">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <span className="text-caption text-muted uppercase font-bold tracking-wider">Proof</span>
            <p className="text-heading-md text-slate-900">{citationsCount} linked pages</p>
          </div>
        </div>

        <div className="bg-canvas-card border border-canvas-border rounded-xl p-4 flex items-center gap-3 shadow-sm">
          <div className="p-3 rounded-xl bg-primary-light text-primary border border-primary-border">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-caption text-muted uppercase font-bold tracking-wider">Safety stamp</span>
            <p className="text-heading-md text-slate-900">Verified</p>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs — pill, tokenized */}
      <div className="flex items-center gap-1 bg-canvas-muted p-1 rounded-xl border border-canvas-border text-body-sm max-w-full overflow-x-auto scrollbar-none shadow-xs">
        <button
          onClick={() => setActiveTab('timeline')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold transition-all whitespace-nowrap min-h-[36px] ${
            activeTab === 'timeline'
              ? 'bg-white text-primary font-bold shadow-xs border border-canvas-border'
              : 'text-muted hover:text-slate-900 border border-transparent'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Timeline</span>
        </button>

        <button
          onClick={() => setActiveTab('snapshot')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold transition-all whitespace-nowrap min-h-[36px] ${
            activeTab === 'snapshot'
              ? 'bg-white text-primary font-bold shadow-xs border border-canvas-border'
              : 'text-muted hover:text-slate-900 border border-transparent'
          }`}
        >
          <AlertOctagon className="w-4 h-4" />
          <span>Emergency Card</span>
        </button>

        <button
          onClick={() => setActiveTab('source_inspector')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold transition-all whitespace-nowrap min-h-[36px] ${
            activeTab === 'source_inspector'
              ? 'bg-white text-primary font-bold shadow-xs border border-canvas-border'
              : 'text-muted hover:text-slate-900 border border-transparent'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Source Pages</span>
        </button>

        <button
          onClick={() => {
            setIsDoctorAccessModalOpen(true);
          }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold transition-all text-muted hover:text-slate-900 whitespace-nowrap min-h-[36px] border border-transparent`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Share Settings</span>
        </button>
      </div>

      {/* Tab Views */}
      {activeTab === 'timeline' ? (
        <DossierTimeline
          items={dossier?.timelineItems || []}
          onOpenSourceViewer={handleOpenSourceViewer}
        />
      ) : activeTab === 'snapshot' ? (
        <EmergencySnapshotCard
          snapshot={dossier?.emergencySnapshot}
          onPrint={() => window.print()}
          onViewSource={(factId) => {
            const item = dossier?.timelineItems.find(t => t.id.includes(factId));
            if (item) handleOpenSourceViewer(item);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Source Link Viewer */}
          <div className="lg:col-span-8">
            <SourceLinkViewer
              documentId={activeDocId}
              fileName={activeDocName}
              boundingBox={activeCitationBox}
              pageIndex={activePage}
              snippetText={activeSnippet}
              onClose={() => setActiveTab('timeline')}
            />
          </div>

          {/* Right Column: Citation List Navigator */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-canvas-card border border-canvas-border rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-canvas-border pb-2.5">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-clinical-amber" />
                  <h3 className="text-caption font-bold uppercase tracking-wider text-slate-800">
                    Document citations ({citationsCount})
                  </h3>
                </div>
                <span className="text-caption text-muted font-mono">Grounded facts</span>
              </div>

              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {(dossier?.sourceDocumentCitations || []).map((cite) => (
                  <button
                    key={cite.citationId}
                    onClick={() => {
                      setActiveDocId(cite.documentId);
                      setActiveDocName(cite.fileName);
                      setActiveCitationBox(cite.boundingBox);
                      setActiveSnippet(cite.snippetText);
                      setActivePage(cite.boundingBox?.pageIndex || 1);
                    }}
                    className={`w-full text-left p-3 rounded-xl border text-body-sm transition-all space-y-1 min-h-[44px] ${
                      activeCitationBox === cite.boundingBox
                        ? 'bg-amber-50 border-amber-200 shadow-sm'
                        : 'bg-canvas-muted border-canvas-border hover:bg-canvas-border'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{cite.factName}</span>
                      <span className="text-[10px] text-slate-600 font-mono">P.{cite.boundingBox.pageIndex || 1}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 truncate">{cite.fileName}</p>
                    <p className="text-[10px] text-sky-700 font-mono line-clamp-1 italic">
                      "{cite.snippetText}"
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Doctor Access Modal */}
      <DoctorAccessModal
        isOpen={isDoctorAccessModalOpen}
        onClose={() => setIsDoctorAccessModalOpen(false)}
        patientId={patientId}
        grants={dossier?.doctorAccessGrants || []}
        onGrantsUpdated={loadCompiledDossier}
      />

      {/* Export Package Modal */}
      <DossierExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        dossier={dossier}
      />
    </div>
  );
};
