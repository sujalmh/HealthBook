import React, { useState, useEffect, useMemo } from 'react';
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
  ShieldCheck,
  Search,
  Pin,
  Calendar,
  AlertTriangle,
  Eye,
  ChevronDown,
  ChevronUp,
  Layers,
  Heart,
  ClipboardList,
} from 'lucide-react';
import { EmergencySnapshotCard } from './EmergencySnapshotCard';
import { SourceLinkViewer } from './SourceLinkViewer';
import { DoctorAccessModal } from './DoctorAccessModal';
import { DossierExportModal } from './DossierExportModal';
import { localVault } from '@/core/vault/LocalVault';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { eventBus } from '@/core/events/eventBus';
import { resolvePatientId } from '@/components/common/resolvePatientId';
import type { CompiledHealthRecord, DossierTimelineItem } from '@/types/dossier';
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

export const DossierView: React.FC<DossierViewProps> = ({ patientId, activeProfile }) => {
  const effectivePatientId = resolvePatientId(patientId, activeProfile.userId);
  const [dossier, setDossier] = useState<CompiledHealthRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDoctorAccessModalOpen, setIsDoctorAccessModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [activeCitationBox, setActiveCitationBox] = useState<BoundingBox | null>(null);
  const [activeDocId, setActiveDocId] = useState<string>('doc_discharge_cardiac_001');
  const [activeDocName, setActiveDocName] = useState<string>('discharge_summary_cardiac_ward.pdf');
  const [activeSnippet, setActiveSnippet] = useState<string | undefined>(undefined);
  const [activePage, setActivePage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [snapshotExpanded, setSnapshotExpanded] = useState(false);

  const CAT_LIMIT = 4;
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const isCatExpanded = (key: string) => !!expandedCats[key];
  const toggleCat = (key: string) => setExpandedCats((s) => ({ ...s, [key]: !s[key] }));
  const renderCatToggle = (catKey: string, total: number) => {
    if (total <= CAT_LIMIT) return null;
    const open = isCatExpanded(catKey);
    return (
      <button
        type="button"
        onClick={() => toggleCat(catKey)}
        className="w-full py-2 rounded-lg bg-white border border-canvas-border text-xs font-bold text-slate-600 hover:bg-canvas-muted min-h-[40px]"
      >
        {open ? 'Show less' : `Show all ${total}`}
      </button>
    );
  };

  const loadCompiledDossier = async () => {
    setIsLoading(true);
    try {
      const res = await webMCPEngine.execute('compile_health_record', {
        patientId: effectivePatientId,
        sections: ['all'],
      });
      if (res.success && res.data) setDossier(res.data as CompiledHealthRecord);
    } catch {

    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCompiledDossier();
    const guard = (p: unknown) => {
      const rec = p as { patientId?: string; patient_id?: string; details?: { patientId?: string }; fact?: { patientId?: string } };
      const pid = rec?.patientId ?? rec?.patient_id ?? rec?.details?.patientId ?? rec?.fact?.patientId;
      if (pid) return pid === effectivePatientId;
      return false;
    };
    const auditGuard = (p: unknown) => {
      const rec = p as { patientId?: string; patient_id?: string; details?: { patientId?: string }; fact?: { patientId?: string } };
      const pid = rec?.patientId ?? rec?.patient_id ?? rec?.details?.patientId ?? rec?.fact?.patientId;
      if (pid) return pid === effectivePatientId;
      return true;
    };
    const mk = (h: () => void) => (payload: unknown) => { if (guard(payload)) h(); };
    const mkAudit = (h: () => void) => (payload: unknown) => { if (auditGuard(payload)) h(); };
    const u1 = eventBus.on('fact_confirmed', mk(loadCompiledDossier) as (p: unknown) => void);
    const u2 = eventBus.on('medication_updated', mk(loadCompiledDossier) as (p: unknown) => void);
    const u3 = eventBus.on('medication_added', mk(loadCompiledDossier) as (p: unknown) => void);
    const u4 = eventBus.on('lab_added', mk(loadCompiledDossier) as (p: unknown) => void);
    const u5 = eventBus.on('proposal_status_changed', mk(loadCompiledDossier) as (p: unknown) => void);
    const u6 = eventBus.on('proposal_created', mk(loadCompiledDossier) as (p: unknown) => void);
    const u7 = eventBus.on('doctor_grant_added', mk(loadCompiledDossier) as (p: unknown) => void);
    const u8 = eventBus.on('doctor_grant_revoked', mk(loadCompiledDossier) as (p: unknown) => void);
    const u9 = eventBus.on('audit_logged', mkAudit(loadCompiledDossier) as (p: unknown) => void);
    const u10 = eventBus.on('danger_report_added', mk(loadCompiledDossier) as (p: unknown) => void);
    const u11 = eventBus.on('calendar_event_added', mk(loadCompiledDossier) as (p: unknown) => void);
    const u12 = eventBus.on('caregiver_linked', mk(loadCompiledDossier) as (p: unknown) => void);
    const u13 = eventBus.on('due_card_added', mk(loadCompiledDossier) as (p: unknown) => void);
    const u14 = eventBus.on('due_card_updated', mk(loadCompiledDossier) as (p: unknown) => void);
    const u15 = eventBus.on('question_added', mk(loadCompiledDossier) as (p: unknown) => void);
    const u16 = eventBus.on('vault_synced', mk(loadCompiledDossier) as (p: unknown) => void);
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9(); u10(); u11(); u12(); u13(); u14(); u15(); u16(); };
  }, [effectivePatientId]);

  const handleOpenSourceViewer = async (item: DossierTimelineItem) => {
    try {
      const res = await webMCPEngine.execute('view_timeline', {
        itemId: item.id.replace('tl_fact_', '').replace('tl_lab_', '').replace('tl_prop_', ''),
      });
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
    } catch {
      if (item.sourceDocId) setActiveDocId(item.sourceDocId);
      if (item.sourceFileName) setActiveDocName(item.sourceFileName);
      if (item.boundingBox) setActiveCitationBox(item.boundingBox);
      if (item.snippetText) setActiveSnippet(item.snippetText);
    }
    setViewerOpen(true);
    setTimeout(() => {
      document.getElementById('dossier-source-viewer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const activeGrantsCount = (dossier?.doctorAccessGrants || []).filter(g => g.status === 'active').length;
  const activeMedsCount = dossier?.activeMedications?.length || 0;
  const citationsCount = dossier?.sourceDocumentCitations?.length || 0;
  const labsCount = dossier?.longitudinalLabs?.length || 0;

  const groupedReports = useMemo(() => {
    if (!dossier?.timelineItems?.length) return [];
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? dossier.timelineItems.filter(
          (it) =>
            it.title?.toLowerCase().includes(q) ||
            it.description?.toLowerCase().includes(q) ||
            it.doctorName?.toLowerCase().includes(q) ||
            it.doctorComment?.toLowerCase().includes(q) ||
            it.sourceFileName?.toLowerCase().includes(q) ||
            it.snippetText?.toLowerCase().includes(q)
        )
      : dossier.timelineItems;

    const map = new Map<string, { key: string; title: string; date: string; items: DossierTimelineItem[] }>();
    for (const it of filtered) {
      const key = it.sourceDocId || `__general__${it.category}`;
      const title =
        it.sourceFileName ||
        (it.sourceDocId ? `${it.sourceDocId}.pdf` : it.category === 'visits' ? 'Visits & Follow-ups' : it.category === 'danger_signs' ? 'Safety Alerts' : it.category === 'proposals' || it.category === 'doctor_notes' ? 'Clinical Notes & Proposals' : 'Clinical Activity');
      if (!map.has(key)) map.set(key, { key, title, date: it.date, items: [] });
      const g = map.get(key)!;
      g.items.push(it);
      if (new Date(it.date).getTime() > new Date(g.date).getTime()) g.date = it.date;
    }

    const groups = Array.from(map.values());
    groups.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    for (const g of groups) g.items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return groups;
  }, [dossier, searchQuery]);

  const totalReports = groupedReports.length;

  return (
    <div className="space-y-4 animate-fade-in">
      {}
      <div className="bg-canvas-card border border-canvas-border rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary-light text-primary border border-primary-border flex items-center justify-center shadow-sm">
            <FolderLock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">For My Doctor</h2>
              {totalReports > 0 && <span className="text-caption px-2 py-0.5 rounded-full bg-canvas-muted text-muted font-semibold border border-canvas-border">{totalReports} report{totalReports !== 1 ? 's' : ''}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button onClick={loadCompiledDossier} disabled={isLoading} className="p-2.5 rounded-xl bg-canvas-muted hover:bg-canvas-border text-muted border border-canvas-border transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0" title="Refresh" aria-label="Refresh">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setIsDoctorAccessModalOpen(true)} className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-canvas-muted hover:bg-canvas-border text-slate-800 text-body-sm font-bold border border-canvas-border shadow-sm min-h-[44px] shrink-0">
            <KeyRound className="w-4 h-4 text-primary" />
            <span>Share ({activeGrantsCount})</span>
          </button>
          <button onClick={() => setIsExportModalOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-body-sm font-bold shadow-sm min-h-[44px] shrink-0">
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-canvas-card border border-canvas-border rounded-xl p-3 flex items-center gap-2.5 shadow-sm">
          <div className="p-2.5 rounded-xl bg-sky-50 text-clinical-blue border border-sky-200"><Pill className="w-4 h-4" /></div>
          <div><span className="text-caption text-muted uppercase font-bold tracking-wider">Medicines</span><p className="text-heading-md text-slate-900">{activeMedsCount}</p></div>
        </div>
        <div className="bg-canvas-card border border-canvas-border rounded-xl p-3 flex items-center gap-2.5 shadow-sm">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-clinical-emerald border border-emerald-200"><Activity className="w-4 h-4" /></div>
          <div><span className="text-caption text-muted uppercase font-bold tracking-wider">Labs</span><p className="text-heading-md text-slate-900">{labsCount}</p></div>
        </div>
        <div className="bg-canvas-card border border-canvas-border rounded-xl p-3 flex items-center gap-2.5 shadow-sm">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200"><FileText className="w-4 h-4" /></div>
          <div><span className="text-caption text-muted uppercase font-bold tracking-wider">Citations</span><p className="text-heading-md text-slate-900">{citationsCount}</p></div>
        </div>
        <div className="bg-canvas-card border border-canvas-border rounded-xl p-3 flex items-center gap-2.5 shadow-sm">
          <div className="p-2.5 rounded-xl bg-primary-light text-primary border border-primary-border"><ShieldCheck className="w-4 h-4" /></div>
          <div><span className="text-caption text-muted uppercase font-bold tracking-wider">Reports</span><p className="text-heading-md text-slate-900">{totalReports || 0}</p></div>
        </div>
      </div>

      {}
      <div className="bg-canvas-card border border-canvas-border rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3 overflow-x-auto scrollbar-none">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reports — meds, labs, notes…"
            className="w-full bg-canvas-muted border border-canvas-border rounded-xl pl-10 pr-4 py-2.5 text-body-sm text-slate-900 placeholder:text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[44px]"
          />
        </div>
        {searchQuery && <button onClick={() => setSearchQuery('')} className="px-3 py-1.5 rounded-lg bg-white border border-canvas-border text-caption font-semibold hover:bg-canvas-muted min-h-[32px] self-end">Clear</button>}
      </div>

      {}
      <div className="bg-canvas-card border border-canvas-border rounded-2xl shadow-sm overflow-hidden">
        <button
          onClick={() => setSnapshotExpanded((v) => !v)}
          className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 hover:bg-canvas-muted/30 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-body-sm font-bold text-slate-900 flex items-center gap-2">Emergency Snapshot <span className="text-caption px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold uppercase">At a glance</span></h3>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline text-caption text-muted">{dossier?.emergencySnapshot?.activeMedications?.length || 0} meds • {dossier?.emergencySnapshot?.mostRecentCriticalLabs?.length || 0} labs</span>
            {snapshotExpanded ? <ChevronUp className="w-5 h-5 text-muted" /> : <ChevronDown className="w-5 h-5 text-muted" />}
          </div>
        </button>
        {snapshotExpanded && (
          <div className="border-t border-canvas-border p-4 sm:p-5 bg-canvas-muted/20">
            <EmergencySnapshotCard
              snapshot={dossier?.emergencySnapshot}
              onPrint={() => window.print()}
              onViewSource={(factId) => {
                const item = dossier?.timelineItems.find((t) => t.id.includes(factId));
                if (item) handleOpenSourceViewer(item);
              }}
            />
          </div>
        )}
      </div>

      {}
      {groupedReports.length === 0 ? (
        <div className="bg-canvas-card border border-dashed border-canvas-border rounded-2xl p-8 sm:p-12 text-center space-y-3 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-primary-light border border-primary-border text-primary flex items-center justify-center mx-auto">
            <ClipboardList className="w-7 h-7" />
          </div>
          <h3 className="text-heading-md font-bold text-slate-900">No reports yet</h3>
          <p className="text-body-sm text-muted max-w-md mx-auto leading-relaxed">
            {searchQuery ? `No events match “${searchQuery}” — try a different term or clear search.` : 'Upload a discharge summary, lab report, or clinic note. We’ll group related findings by report with clear category sections for your doctor.'}
          </p>
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="px-4 py-2 rounded-xl bg-primary text-white text-body-sm font-bold min-h-[44px]">Clear search</button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-2 px-1">
            <FileText className="w-4 h-4 text-muted" />
            <h3 className="text-caption font-bold uppercase tracking-wider text-muted">Reports</h3>
          </div>

          {groupedReports.map((report) => {
            const byCategory = {
              meds: report.items.filter((i) => i.category === 'meds'),
              labs: report.items.filter((i) => i.category === 'labs'),
              conditions: report.items.filter((i) => i.category === 'conditions'),
              allergies: report.items.filter((i) => i.category === 'allergies'),
              proposals: report.items.filter((i) => i.category === 'proposals' || i.category === 'doctor_notes'),
              visits: report.items.filter((i) => i.category === 'visits'),
              danger: report.items.filter((i) => i.category === 'danger_signs'),
              other: report.items.filter((i) => !['meds', 'labs', 'conditions', 'allergies', 'proposals', 'doctor_notes', 'visits', 'danger_signs'].includes(i.category)),
            };
            const hasDoc = !report.key.startsWith('__general__');
            const reportDate = new Date(report.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            const reportTime = new Date(report.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div key={report.key} className="bg-canvas-card border border-canvas-border rounded-2xl shadow-sm overflow-hidden">
                {}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 border-b border-canvas-border bg-canvas-muted/40">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${hasDoc ? 'bg-white border-canvas-border text-primary' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                      {hasDoc ? <FileText className="w-5 h-5" /> : <ClipboardList className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-body-sm font-bold text-slate-900 truncate max-w-[28rem]" title={report.title}>{report.title}</h4>
                      <p className="text-caption text-muted font-mono">
                        {reportDate} • {reportTime} • {report.items.length} item{report.items.length !== 1 ? 's' : ''} {hasDoc ? '• Source verified' : '• Clinical activity'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {byCategory.meds.length > 0 && <span className="text-caption px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 font-bold">{byCategory.meds.length} med{byCategory.meds.length === 1 ? '' : 's'}</span>}
                    {byCategory.labs.length > 0 && <span className="text-caption px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">{byCategory.labs.length} lab{byCategory.labs.length === 1 ? '' : 's'}</span>}
                    {byCategory.proposals.length > 0 && <span className="text-caption px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold">{byCategory.proposals.length} note{byCategory.proposals.length === 1 ? '' : 's'}</span>}
                    {byCategory.visits.length > 0 && <span className="text-caption px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 font-bold">{byCategory.visits.length} visit{byCategory.visits.length === 1 ? '' : 's'}</span>}
                    {byCategory.danger.length > 0 && <span className="text-caption px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold">{byCategory.danger.length} alert{byCategory.danger.length === 1 ? '' : 's'}</span>}
                  </div>
                </div>

                {}
                <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {}
                  {byCategory.meds.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 border-b border-sky-100 pb-2">
                        <Pill className="w-4 h-4 text-sky-600" />
                        <h5 className="text-caption font-bold uppercase tracking-wider text-sky-800">Medications</h5>
                        <span className="text-caption text-muted">• {byCategory.meds.length}</span>
                      </div>
                      <div className="space-y-2">
                        {byCategory.meds.slice(0, isCatExpanded(`${report.key}:meds`) ? byCategory.meds.length : CAT_LIMIT).map((it) => (
                          <div key={it.id} className="rounded-xl border border-sky-100 bg-sky-50/40 p-3 space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-body-sm font-bold text-slate-900 leading-snug">{it.title}</p>
                              {it.statusBadge && <span className="text-caption px-2 py-0.5 rounded-full bg-white border border-sky-200 font-bold uppercase shrink-0">{it.statusBadge}</span>}
                            </div>
                            <p className="text-body-sm text-slate-700 leading-relaxed">{it.description}</p>
                            {it.dosageTransition && (
                              <div className="flex items-center gap-1.5 text-caption bg-white rounded-lg p-2 border border-canvas-border">
                                <span className="line-through text-rose-700 font-mono">{it.dosageTransition.previousDose}</span>
                                <span className="text-muted">→</span>
                                <span className="font-bold text-emerald-700 font-mono">{it.dosageTransition.newDose}</span>
                              </div>
                            )}
                            {it.sourceDocId && (
                              <button onClick={() => handleOpenSourceViewer(it)} className="inline-flex items-center gap-1 text-caption font-semibold text-sky-700 hover:text-sky-800">
                                <Eye className="w-3 h-3" /> View source
                              </button>
                            )}
                          </div>
                        ))}
                        {renderCatToggle(`${report.key}:meds`, byCategory.meds.length)}
                      </div>
                    </div>
                  )}

                  {}
                  {byCategory.labs.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 border-b border-emerald-100 pb-2">
                        <Activity className="w-4 h-4 text-emerald-600" />
                        <h5 className="text-caption font-bold uppercase tracking-wider text-emerald-800">Labs & Biomarkers</h5>
                        <span className="text-caption text-muted">• {byCategory.labs.length}</span>
                      </div>
                      <div className="space-y-2">
                        {byCategory.labs.slice(0, isCatExpanded(`${report.key}:labs`) ? byCategory.labs.length : CAT_LIMIT).map((it) => (
                          <div key={it.id} className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-body-sm font-bold text-slate-900">{it.title}</p>
                              <span className={`text-caption px-2 py-0.5 rounded-full font-bold uppercase border ${it.statusBadge?.includes('CRITICAL') ? 'bg-rose-50 text-rose-700 border-rose-200' : it.statusBadge?.includes('HIGH') || it.statusBadge?.includes('LOW') ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{it.statusBadge || 'RECORDED'}</span>
                            </div>
                            <p className="text-caption text-slate-700">{it.description}</p>
                            {it.doctorComment && (
                              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                                <p className="text-caption font-bold text-amber-800 flex items-center gap-1"><Pin className="w-3 h-3" /> {it.doctorName || 'Clinician'}:</p>
                                <p className="text-body-sm italic text-amber-900">“{it.doctorComment}”</p>
                              </div>
                            )}
                            {it.sourceDocId && (
                              <button onClick={() => handleOpenSourceViewer(it)} className="inline-flex items-center gap-1 text-caption font-semibold text-emerald-700 hover:text-emerald-800">
                                <Eye className="w-3 h-3" /> View source
                              </button>
                            )}
                          </div>
                        ))}
                        {renderCatToggle(`${report.key}:labs`, byCategory.labs.length)}
                      </div>
                    </div>
                  )}

                  {}
                  {byCategory.conditions.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 border-b border-amber-100 pb-2">
                        <Heart className="w-4 h-4 text-amber-600" />
                        <h5 className="text-caption font-bold uppercase tracking-wider text-amber-800">Conditions</h5>
                        <span className="text-caption text-muted">• {byCategory.conditions.length}</span>
                      </div>
                      <div className="space-y-1.5">
                        {byCategory.conditions.slice(0, isCatExpanded(`${report.key}:conditions`) ? byCategory.conditions.length : CAT_LIMIT).map((it) => (
                          <div key={it.id} className="rounded-xl border border-amber-100 bg-amber-50/30 p-3">
                            <p className="text-body-sm font-semibold text-slate-900">{it.title}</p>
                            <p className="text-caption text-slate-600">{it.description}</p>
                          </div>
                        ))}
                        {renderCatToggle(`${report.key}:conditions`, byCategory.conditions.length)}
                      </div>
                    </div>
                  )}

                  {}
                  {byCategory.allergies.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 border-b border-rose-100 pb-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <h5 className="text-caption font-bold uppercase tracking-wider text-rose-800">Allergies</h5>
                        <span className="text-caption text-muted">• {byCategory.allergies.length}</span>
                      </div>
                      <div className="space-y-1.5">
                        {byCategory.allergies.slice(0, isCatExpanded(`${report.key}:allergies`) ? byCategory.allergies.length : CAT_LIMIT).map((it) => (
                          <div key={it.id} className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                            <p className="text-body-sm font-bold text-rose-900">{it.title}</p>
                            <p className="text-caption text-rose-700">{it.description}</p>
                          </div>
                        ))}
                        {renderCatToggle(`${report.key}:allergies`, byCategory.allergies.length)}
                      </div>
                    </div>
                  )}

                  {}
                  {byCategory.proposals.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 border-b border-amber-100 pb-2">
                        <Pin className="w-4 h-4 text-amber-600" />
                        <h5 className="text-caption font-bold uppercase tracking-wider text-amber-800">Doctor Notes & Proposals</h5>
                        <span className="text-caption text-muted">• {byCategory.proposals.length}</span>
                      </div>
                      <div className="space-y-2">
                        {byCategory.proposals.slice(0, isCatExpanded(`${report.key}:proposals`) ? byCategory.proposals.length : CAT_LIMIT).map((it) => (
                          <div key={it.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-1.5">
                            <p className="text-body-sm font-bold text-slate-900">{it.title}</p>
                            <p className="text-caption text-slate-700">{it.description}</p>
                            {it.dosageTransition && (
                              <div className="flex items-center gap-1.5 text-caption bg-white rounded-lg p-2 border border-canvas-border">
                                <span className="line-through text-rose-700 font-mono">{it.dosageTransition.previousDose}</span>
                                <span>→</span>
                                <span className="font-bold text-emerald-700 font-mono">{it.dosageTransition.newDose}</span>
                              </div>
                            )}
                            {it.doctorComment && (
                              <p className="text-body-sm italic text-amber-900 bg-white rounded-lg p-2 border border-amber-100">“{it.doctorComment}” — {it.doctorName}</p>
                            )}
                          </div>
                        ))}
                        {renderCatToggle(`${report.key}:proposals`, byCategory.proposals.length)}
                      </div>
                    </div>
                  )}

                  {}
                  {byCategory.visits.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 border-b border-teal-100 pb-2">
                        <Calendar className="w-4 h-4 text-teal-700" />
                        <h5 className="text-caption font-bold uppercase tracking-wider text-teal-900">Visits & Follow-ups</h5>
                        <span className="text-caption text-muted">• {byCategory.visits.length}</span>
                      </div>
                      <div className="space-y-2">
                        {byCategory.visits.slice(0, isCatExpanded(`${report.key}:visits`) ? byCategory.visits.length : CAT_LIMIT).map((it) => (
                          <div key={it.id} className="rounded-xl border border-teal-100 bg-teal-50/30 p-3 space-y-1">
                            <p className="text-body-sm font-bold text-slate-900">{it.title}</p>
                            <p className="text-caption text-slate-600">{it.description}</p>
                            <span className="inline-flex text-caption px-2 py-0.5 rounded-full bg-white border border-teal-200 font-bold uppercase">{it.statusBadge}</span>
                          </div>
                        ))}
                        {renderCatToggle(`${report.key}:visits`, byCategory.visits.length)}
                      </div>
                    </div>
                  )}

                  {}
                  {byCategory.danger.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 border-b border-rose-100 pb-2">
                        <AlertOctagon className="w-4 h-4 text-rose-600" />
                        <h5 className="text-caption font-bold uppercase tracking-wider text-rose-800">Safety Alerts</h5>
                        <span className="text-caption text-muted">• {byCategory.danger.length}</span>
                      </div>
                      <div className="space-y-2">
                        {byCategory.danger.slice(0, isCatExpanded(`${report.key}:danger`) ? byCategory.danger.length : CAT_LIMIT).map((it) => (
                          <div key={it.id} className="rounded-xl border border-rose-200 bg-rose-50 p-3 space-y-1">
                            <p className="text-body-sm font-bold text-rose-900">{it.title}</p>
                            <p className="text-caption text-rose-700">{it.description}</p>
                            <span className="inline-flex text-caption px-2 py-0.5 rounded-full bg-rose-600 text-white font-bold uppercase">{it.statusBadge}</span>
                          </div>
                        ))}
                        {renderCatToggle(`${report.key}:danger`, byCategory.danger.length)}
                      </div>
                    </div>
                  )}

                  {}
                  {byCategory.other.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 border-b border-canvas-border pb-2">
                        <Layers className="w-4 h-4 text-muted" />
                        <h5 className="text-caption font-bold uppercase tracking-wider text-slate-700">Other Events</h5>
                        <span className="text-caption text-muted">• {byCategory.other.length}</span>
                      </div>
                      <div className="space-y-1.5">
                        {byCategory.other.slice(0, isCatExpanded(`${report.key}:other`) ? byCategory.other.length : CAT_LIMIT).map((it) => (
                          <div key={it.id} className="rounded-xl border border-canvas-border bg-canvas-muted p-3">
                            <p className="text-body-sm font-semibold text-slate-900">{it.title}</p>
                            <p className="text-caption text-slate-600">{it.description}</p>
                          </div>
                        ))}
                        {renderCatToggle(`${report.key}:other`, byCategory.other.length)}
                      </div>
                    </div>
                  )}
                </div>

                {}
                {hasDoc && (
                  <div className="px-4 sm:px-5 py-3 bg-canvas-muted border-t border-canvas-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-caption text-muted flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5" /> Source: <strong className="text-slate-700 truncate max-w-[200px]">{report.title}</strong> • {report.items.filter((i) => i.sourceDocId).length} grounded
                    </span>
                    <button
                      onClick={() => {
                        const firstWithSource = report.items.find((i) => i.sourceDocId);
                        if (firstWithSource) handleOpenSourceViewer(firstWithSource);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-canvas-card border border-canvas-border text-caption font-bold text-slate-700 min-h-[36px]"
                    >
                      <Eye className="w-3.5 h-3.5" /> Open source pages
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {}
      {viewerOpen && (
        <div id="dossier-source-viewer" className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-body-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-600" /> Source pages
            </h3>
            <button onClick={() => setViewerOpen(false)} className="px-3 py-1.5 rounded-xl bg-white border border-canvas-border text-caption font-bold hover:bg-canvas-muted min-h-[36px]">Close viewer</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <SourceLinkViewer documentId={activeDocId} fileName={activeDocName} boundingBox={activeCitationBox} pageIndex={activePage} snippetText={activeSnippet} onClose={() => setViewerOpen(false)} />
            </div>
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-canvas-card border border-canvas-border rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-canvas-border pb-2.5">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-clinical-amber" />
                    <h3 className="text-caption font-bold uppercase tracking-wider text-slate-800">Citations ({citationsCount})</h3>
                  </div>
                  <span className="text-caption text-muted font-mono">Grounded</span>
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
                      className={`w-full text-left p-3 rounded-xl border text-body-sm transition-all space-y-1 min-h-[44px] ${activeCitationBox === cite.boundingBox ? 'bg-amber-50 border-amber-200 shadow-sm' : 'bg-canvas-muted border-canvas-border hover:bg-canvas-border'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{cite.factName}</span>
                        <span className="text-[10px] text-slate-600 font-mono">P.{cite.boundingBox.pageIndex || 1}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 truncate">{cite.fileName}</p>
                      <p className="text-[10px] text-sky-700 font-mono line-clamp-1 italic">"{cite.snippetText}"</p>
                    </button>
                  ))}
                  {citationsCount === 0 && <p className="text-caption text-muted text-center py-6">No citations yet — upload and approve facts to see grounded sources.</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <DoctorAccessModal isOpen={isDoctorAccessModalOpen} onClose={() => setIsDoctorAccessModalOpen(false)} patientId={effectivePatientId} grants={dossier?.doctorAccessGrants || []} onGrantsUpdated={loadCompiledDossier} />
      <DossierExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} dossier={dossier} />
    </div>
  );
};

