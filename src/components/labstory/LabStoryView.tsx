import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  UploadCloud,
  FileText,
  Calendar,
  Layers,
  Sparkles,
  HelpCircle,
  Plus,
  RefreshCw,
  Download,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Pin,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Sliders,
  Database
} from 'lucide-react';
import { BiomarkerChart, ZoomWindow } from './BiomarkerChart';
import { MedOverlayBands } from './MedOverlayBands';
import { CausalQueryPanel } from './CausalQueryPanel';
import { StorySentence } from './StorySentence';
import { localVault } from '@/core/vault/LocalVault';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { eventBus } from '@/core/events/eventBus';
import { ModalPortal } from '../common/ModalPortal';
import type { LabRecord } from '@/types/vault';

interface LabStoryViewProps {
  patientId: string;
  activeProfile?: {
    userId: string;
    name: string;
    role: string;
    isProxy?: boolean;
  };
  className?: string;
}

function deriveLabPatientId(passed: string, fallbackUserId?: string): string {
  if (passed && passed.trim() !== '' && passed !== 'patient-s-devi') return passed.trim();
  if (fallbackUserId && fallbackUserId.trim() !== '' && fallbackUserId !== 'patient-s-devi') return fallbackUserId.trim();
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
  return passed || fallbackUserId || '';
}

export const LabStoryView: React.FC<LabStoryViewProps> = ({
  patientId,
  activeProfile = { userId: patientId, name: 'Patient', role: 'patient' },
  className = ''
}) => {
  const effectivePatientId = deriveLabPatientId(patientId, activeProfile?.userId);
  const [labs, setLabs] = useState<LabRecord[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<string>('eGFR');
  const [activeZoom, setActiveZoom] = useState<ZoomWindow>('5Y');
  const [showReferenceRange, setShowReferenceRange] = useState<boolean>(true);
  const [showOptimalRange, setShowOptimalRange] = useState<boolean>(true);
  const [isDropzoneOpen, setIsDropzoneOpen] = useState<boolean>(false);
  const [isManualAddOpen, setIsManualAddOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [causalWindow, setCausalWindow] = useState<{ start: string; end: string; label?: string } | null>(null);

  // Manual Lab Entry Form State
  const [manualMarker, setManualMarker] = useState('Creatinine');
  const [manualValue, setManualValue] = useState('1.85');
  const [manualUnit, setManualUnit] = useState('mg/dL');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);

  // Load labs from LocalVault for active patient — read-only, no per-view seeding (centralized seed.ts via main.tsx owns baseline).
  // Uses effectivePatientId derived via globalThis for patient isolation never '' leak; normalized via BIOMARKER_STANDARDS ±10% borderline + critical flags and AI correlate_meds trajectory
  const loadLabs = () => {
    const patientLabs = effectivePatientId ? localVault.getLabs(effectivePatientId) : [];
    setLabs(patientLabs);
  };

  // M2 Relevant-only: LabStory listens to lab_added (alias lab_extracted), fact_confirmed (alias fact_status_changed/fact_added), medication_updated (overlay)
  // Does NOT subscribe to danger_report, calendar, due_card, proposal_* — spurious guard.
  // Alias dispatch ensures legacy emits (lab_extracted, fact_status_changed) still trigger canonical listeners without double subscription.
  useEffect(() => {
    loadLabs();

    const guard = (p: any) => !p || !p.patientId || p.patientId === effectivePatientId;
    const onLabAdded = (payload: any) => { if (guard(payload)) loadLabs(); };
    const onFactConfirmed = (payload: any) => {
      const pid = payload?.patientId || payload?.fact?.patientId;
      if (!pid || pid === effectivePatientId) loadLabs();
    };
    const onMedOverlay = (payload: any) => { if (guard(payload)) loadLabs(); };

    const u1 = eventBus.on('lab_added', onLabAdded);
    const u2 = eventBus.on('fact_confirmed', onFactConfirmed);
    const u3 = eventBus.on('medication_updated', onMedOverlay);
    // alias for legacy lab_status_changed used by DoctorInbox — distinct, not in main alias group
    const u4 = eventBus.on('lab_status_changed', onLabAdded);

    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [effectivePatientId]);

  // Distinct markers available in patient labs
  const availableMarkers = useMemo(() => {
    const defaultOrder = ['eGFR', 'Creatinine', 'HbA1c', 'Glucose Fasting', 'Potassium', 'Cholesterol Total', 'LDL', 'HDL', 'Triglycerides'];
    const discovered = Array.from(new Set(labs.map((l) => l.marker)));
    const all = Array.from(new Set([...defaultOrder, ...discovered]));
    return all.map((marker) => {
      const markerLabs = labs.filter((l) => l.marker.toLowerCase() === marker.toLowerCase());
      const sorted = [...markerLabs].sort((a, b) => new Date(a.drawDate).getTime() - new Date(b.drawDate).getTime());
      const latest = sorted[sorted.length - 1];
      return {
        marker,
        count: markerLabs.length,
        latestValue: latest ? latest.normalizedValue : null,
        unit: latest ? latest.normalizedUnit : '',
        flag: latest?.flag || (latest?.isBorderline ? 'BORDERLINE' : 'NORMAL'),
        isCritical: latest?.isCritical || false
      };
    });
  }, [labs]);

  // Active Marker Labs series
  const activeMarkerLabs = useMemo(() => {
    return labs.filter((l) => l.marker.toLowerCase() === selectedMarker.toLowerCase());
  }, [labs, selectedMarker]);

  // Overall timeline min and max timestamp
  const { minEpoch, maxEpoch } = useMemo(() => {
    if (labs.length === 0) {
      const now = Date.now();
      return { minEpoch: now - 365 * 24 * 3600 * 1000, maxEpoch: now };
    }
    const times = labs.map((l) => new Date(l.drawDate).getTime());
    return { minEpoch: Math.min(...times), maxEpoch: Math.max(...times) };
  }, [labs]);

  // Ingest Multi-Doc Drop via WebMCP extract_labs tool — uses effectivePatientId for isolation
  const handleIngestDataset = async (type: 'shanti' | 'jenkins' | 'custom') => {
    setIsLoading(true);
    try {
      const docId = type === 'jenkins' ? 'doc_jenkins_5y_labs' : 'doc_historical_labs_2022_2026';
      const context = {
        patientId: effectivePatientId,
        activeProfile: {
          userId: activeProfile.userId,
          name: activeProfile.name,
          role: (activeProfile.role === 'caregiver' || activeProfile.role === 'doctor' ? activeProfile.role : 'patient') as 'patient' | 'caregiver' | 'doctor',
          isProxy: Boolean(activeProfile.isProxy)
        },
        vault: localVault,
        eventBus
      };

      await webMCPEngine.execute('extract_labs', { documentId: docId, patientId: effectivePatientId }, context);
      loadLabs();
      setIsDropzoneOpen(false);
    } catch (err: any) {
      console.error('[LabStoryView] Error in extract_labs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Add Doctor Comment to Lab
  const handleAddDoctorComment = (labId: string, commentText: string) => {
    const updated = localVault.addDoctorCommentToLab(labId, {
      doctorId: activeProfile.userId,
      doctorName: activeProfile.role === 'doctor' ? (activeProfile.name || '').trim() || 'Your doctor' : ((activeProfile.name || '').trim() && (activeProfile.name || '').trim() !== 'Patient' ? (activeProfile.name || '').trim() : 'Your doctor'),
      comment: commentText
    });

    if (updated) {
      loadLabs();
      eventBus.dispatchToast({
        type: 'success',
        title: 'Clinician Comment Pinned (📌)',
        message: 'Comment anchored to data point and updated on LabStory canvas.'
      });
    }
  };

  // Submit Manual Lab Entry — delegates normalization to LocalVault BIOMARKER_STANDARDS ±10% + AI trajectory will reflect via vault subscription
  const handleManualAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(manualValue);
    if (isNaN(val)) return;

    const newRecord: LabRecord = {
      id: `lab_${effectivePatientId}_${manualMarker.toLowerCase()}_${Date.now()}`,
      patientId: effectivePatientId,
      marker: manualMarker,
      value: val,
      unit: manualUnit,
      normalizedValue: val,
      normalizedUnit: manualUnit,
      drawDate: new Date(manualDate).toISOString(),
      referenceRange: { low: 0.6, high: 1.2 },
      optimalRange: { low: 0.7, high: 1.0 },
      isBorderline: false,
      isCritical: false,
      flag: 'NORMAL'
    };

    localVault.addLab(newRecord, {
      userId: activeProfile.userId,
      userName: activeProfile.name,
      role: activeProfile.role as any
    });

    loadLabs();
    setIsManualAddOpen(false);
    eventBus.dispatchToast({
      type: 'success',
      title: 'Lab Result Added',
      message: `${manualMarker} (${val} ${manualUnit}) recorded.`
    });
  };

  return (
    <div className={`space-y-6 max-w-7xl mx-auto animate-fade-in ${className}`}>
      {/* Top Header & Quick Actions */}
      <div className="bg-canvas-card border border-canvas-border rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-primary-light text-primary border border-primary-border flex items-center justify-center shadow-sm shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Lab Results</h2>
              <span className="text-caption px-2 py-0.5 rounded-full bg-primary-light text-primary-text font-bold border border-primary-border">
                Trends over time
              </span>
            </div>
            <p className="text-body-sm text-muted leading-relaxed">
              See your blood tests over time — what's normal, what's changed, and how your medicines affect them.
            </p>
          </div>
        </div>

        {/* Header Action Buttons with >=44px Touch Targets */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsDropzoneOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-body-sm font-bold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] flex-1 sm:flex-initial"
          >
            <UploadCloud className="w-4 h-4 shrink-0" />
            <span>Add Past Results</span>
          </button>

          <button
            type="button"
            onClick={() => setIsManualAddOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-canvas-muted hover:bg-muted-subtle text-slate-900 text-body-sm font-semibold border border-canvas-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] flex-1 sm:flex-initial"
          >
            <Plus className="w-4 h-4 text-primary shrink-0" />
            <span>Add Result Manually</span>
          </button>

          <button
            type="button"
            onClick={loadLabs}
            className="p-2.5 rounded-xl bg-canvas-muted hover:bg-muted-subtle text-muted hover:text-slate-900 border border-canvas-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
            title="Refresh Timeline"
            aria-label="Refresh timeline"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Biomarker graph is now controlled via unified table below — no separate pill selector */}

      {/* Friendly empty when no labs yet */}
      {labs.length === 0 ? (
        <div className="bg-canvas-card border border-dashed border-canvas-border rounded-2xl p-6 sm:p-10 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-primary-light text-primary border border-primary-border flex items-center justify-center mx-auto">
            <Activity className="w-6 h-6" />
          </div>
          <h3 className="text-heading-md font-bold text-slate-900 tracking-tight">No lab results yet</h3>
          <p className="text-body-sm text-muted max-w-md mx-auto leading-relaxed">Upload past results or add one manually — your chart will appear here and update your other sections automatically.</p>
          <div className="flex items-center justify-center gap-2.5 flex-wrap">
            <button type="button" onClick={() => setIsDropzoneOpen(true)} className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-body-sm font-bold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] flex items-center justify-center">Add Past Results</button>
            <button type="button" onClick={() => setIsManualAddOpen(true)} className="px-4 py-2.5 rounded-xl bg-canvas-muted hover:bg-muted-subtle text-slate-900 border border-canvas-border text-body-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] flex items-center justify-center">Add Manually</button>
          </div>
        </div>
      ) : null}

      {/* Story Sentence Longitudinal Trajectory Narrative (LS6) */}
      {labs.length > 0 && <StorySentence marker={selectedMarker} labs={activeMarkerLabs} />}

      {/* Main Interactive Visual Canvas: Biomarker Chart (LS2, LS5, LS8) */}
      {labs.length > 0 && (
        <BiomarkerChart
          markerName={selectedMarker}
          labs={activeMarkerLabs}
          activeZoom={activeZoom}
          onZoomChange={setActiveZoom}
          showReferenceRange={showReferenceRange}
          showOptimalRange={showOptimalRange}
          onToggleReferenceRange={setShowReferenceRange}
          onToggleOptimalRange={setShowOptimalRange}
          onAddDoctorComment={handleAddDoctorComment}
          causalHighlightWindow={causalWindow}
        />
      )}

      {/* Medication Timeline Overlay Bands (LS4) */}
      {labs.length > 0 && <MedOverlayBands minTime={minEpoch} maxTime={maxEpoch} />}

      {/* "Ask Why" Conversational Causal Engine Panel (LS3, LS7) */}
      {labs.length > 0 && (
        <CausalQueryPanel
          patientId={patientId}
          activeMarker={selectedMarker}
          onHighlightCausalWindow={setCausalWindow}
        />
      )}

      {/* Unified Longitudinal Results — table controls the graph (replaces separate pills) */}
      <div className="bg-canvas-card border border-canvas-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-canvas-border pb-4">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-primary-light border border-primary-border text-primary shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-heading-md font-bold text-slate-900 tracking-tight truncate">
                Your past results — {labs.length} records
              </h3>
              <p className="text-caption text-muted leading-snug">
                Tap any row to view its biomarker in the chart above. <span className="font-bold text-primary">{selectedMarker}</span> selected • <span className="hidden sm:inline">rows update the graph instantly</span>
              </p>
            </div>
          </div>
          <span className="text-caption text-muted bg-canvas-muted border border-canvas-border px-2.5 py-1 rounded-full font-medium self-start sm:self-auto whitespace-nowrap">
            Stored locally • click row → graph
          </span>
        </div>

        <div className="overflow-x-auto -mx-1 scrollbar-none">
          <table className="w-full text-left text-body-sm min-w-[680px]">
            <thead>
              <tr className="border-b border-canvas-border text-caption text-muted uppercase tracking-wider">
                <th className="py-2.5 px-3 font-semibold">Draw Date</th>
                <th className="py-2.5 px-3 font-semibold">Biomarker</th>
                <th className="py-2.5 px-3 font-semibold">Value</th>
                <th className="py-2.5 px-3 font-semibold">Reference</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th className="py-2.5 px-3 font-semibold">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-canvas-border text-slate-700 font-medium">
              {[...labs]
                .sort((a, b) => new Date(b.drawDate).getTime() - new Date(a.drawDate).getTime())
                .map((r) => {
                  const docComment = r.doctorComment || r.doctorComments?.[0];
                  const isSelectedRow = r.marker.toLowerCase() === selectedMarker.toLowerCase();
                  const dotColor = r.isCritical
                    ? 'bg-rose-500'
                    : r.isBorderline
                    ? 'bg-amber-500'
                    : r.flag === 'HIGH' || r.flag === 'LOW'
                    ? 'bg-amber-400'
                    : 'bg-emerald-500';
                  return (
                    <tr
                      key={r.id}
                      onClick={() => {
                        setSelectedMarker(r.marker);
                        setCausalWindow(null);
                        // smooth scroll to chart
                        try { document.querySelector('[class*="BiomarkerChart"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedMarker(r.marker);
                          setCausalWindow(null);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`View ${r.marker} trend, value ${r.normalizedValue} ${r.normalizedUnit}`}
                      className={`cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${isSelectedRow ? 'bg-primary-light/50 hover:bg-primary-light/60' : 'hover:bg-canvas-muted/60'}`}
                    >
                      <td className="py-3 px-3 whitespace-nowrap text-slate-900 font-medium">
                        {new Date(r.drawDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-2 font-semibold text-slate-900">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                          {r.marker}
                          {isSelectedRow && <span className="text-caption px-1.5 py-0.5 rounded-full bg-primary text-white font-bold leading-none">●</span>}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {r.normalizedValue} <span className="font-normal text-muted text-caption">{r.normalizedUnit}</span>
                      </td>
                      <td className="py-3 px-3 text-muted text-body-sm whitespace-nowrap">
                        {r.referenceRange.low}–{r.referenceRange.high} {r.normalizedUnit}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-caption px-2 py-0.5 rounded-full font-bold uppercase border whitespace-nowrap ${r.isCritical ? 'bg-rose-50 text-rose-700 border-rose-200' : r.isBorderline ? 'bg-amber-50 text-amber-700 border-amber-200' : r.flag === 'HIGH' || r.flag === 'LOW' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}
                        >
                          {r.flag || (r.isBorderline ? 'BORDERLINE' : 'NORMAL')}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {docComment ? (
                          <span className="flex items-center gap-1 text-amber-700 text-caption font-semibold">
                            <Pin className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[160px]">{docComment.doctorName}: {docComment.comment.substring(0, 32)}...</span>
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        {labs.length === 0 && (
          <div className="p-6 text-center bg-canvas-muted rounded-xl border border-dashed border-canvas-border">
            <p className="text-body-sm text-muted">No records yet. Add past results or enter manually — the table will control the graph.</p>
          </div>
        )}
        {labs.length > 0 && activeMarkerLabs.length === 0 && (
          <div className="p-4 text-center bg-canvas-muted rounded-xl border border-canvas-border">
            <p className="text-body-sm text-muted">No rows for <span className="font-bold">{selectedMarker}</span> — tap another biomarker row to switch.</p>
          </div>
        )}
      </div>

      {/* Modal: Multi-Doc Timeline Ingestion (LS1) */}
      <ModalPortal isOpen={isDropzoneOpen} onClose={() => setIsDropzoneOpen(false)} ariaLabel="Multi-Year Lab Ingestion">
        <div className="bg-canvas-card border border-canvas-border rounded-2xl p-4 sm:p-6 max-w-lg w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto mx-auto">
          <div className="flex items-center justify-between border-b border-canvas-border pb-3">
            <div className="flex items-center gap-2 text-primary font-bold text-heading-md">
              <UploadCloud className="w-5 h-5" />
              <span>Multi-Year Lab Ingestion</span>
            </div>
            <button
              type="button"
              onClick={() => setIsDropzoneOpen(false)}
              className="text-muted hover:text-slate-900 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <p className="text-body-sm text-muted leading-relaxed">
            Upload multi-year laboratory PDF packets, smartphone photo result slips, or select a pre-verified longitudinal cohort to auto-normalize units and place points on the timeline.
          </p>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => handleIngestDataset('shanti')}
              disabled={isLoading}
              className="w-full text-left p-3.5 rounded-xl bg-canvas-muted hover:bg-muted-subtle border border-canvas-border hover:border-primary-border/50 transition-all flex items-center justify-between group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 min-h-[44px]"
            >
              <div>
                <div className="text-body-sm font-bold text-slate-900 group-hover:text-primary">
                  Longitudinal History (2022–2026)
                </div>
                <div className="text-caption text-muted leading-relaxed">
                  Includes CKD 3b, Metformin initiation, Prednisone burst spike, and Atorvastatin titration.
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted group-hover:text-primary shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => handleIngestDataset('jenkins')}
              disabled={isLoading}
              className="w-full text-left p-3.5 rounded-xl bg-canvas-muted hover:bg-muted-subtle border border-canvas-border hover:border-primary-border/50 transition-all flex items-center justify-between group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 min-h-[44px]"
            >
              <div>
                <div className="text-body-sm font-bold text-slate-900 group-hover:text-primary">
                  Patient Renal AKI & Diabetes Panel
                </div>
                <div className="text-caption text-muted leading-relaxed">
                  Features acute eGFR decline to 28 mL/min post-discharge and Ketorolac gout course.
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted group-hover:text-primary shrink-0" />
            </button>
          </div>
          {isLoading && (
            <div className="flex items-center gap-2 text-body-sm text-primary font-medium py-1">
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" /> Ingesting & normalizing…
            </div>
          )}

          <div className="border-t border-canvas-border pt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsDropzoneOpen(false)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-canvas-muted hover:bg-muted-subtle text-slate-700 font-semibold border border-canvas-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] text-body-sm flex items-center justify-center"
            >
              Cancel
            </button>
          </div>
        </div>
      </ModalPortal>

      {/* Modal: Manual Lab Data Entry */}
      <ModalPortal isOpen={isManualAddOpen} onClose={() => setIsManualAddOpen(false)} ariaLabel="Add Lab Result Point">
        <form
          onSubmit={handleManualAddSubmit}
          className="bg-canvas-card border border-canvas-border rounded-2xl p-4 sm:p-6 max-w-md w-full space-y-4 shadow-2xl text-body-sm max-h-[90vh] overflow-y-auto mx-auto"
        >
          <div className="flex items-center justify-between border-b border-canvas-border pb-3">
            <div className="flex items-center gap-2 text-primary font-bold text-heading-md">
              <Plus className="w-4 h-4" />
              <span>Add Lab Result Point</span>
            </div>
            <button
              type="button"
              onClick={() => setIsManualAddOpen(false)}
              className="text-muted hover:text-slate-900 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-muted mb-1 font-semibold text-caption">Biomarker Name</label>
              <select
                value={manualMarker}
                onChange={(e) => setManualMarker(e.target.value)}
                className="w-full bg-canvas-muted border border-canvas-border rounded-xl p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary min-h-[44px]"
              >
                <option value="Creatinine">Creatinine (mg/dL)</option>
                <option value="eGFR">eGFR (mL/min/1.73m2)</option>
                <option value="HbA1c">HbA1c (%)</option>
                <option value="Glucose Fasting">Glucose Fasting (mg/dL)</option>
                <option value="Potassium">Potassium (mEq/L)</option>
                <option value="Cholesterol Total">Cholesterol Total (mg/dL)</option>
                <option value="LDL">LDL (mg/dL)</option>
                <option value="HDL">HDL (mg/dL)</option>
                <option value="Triglycerides">Triglycerides (mg/dL)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-muted mb-1 font-semibold text-caption">Numeric Value</label>
                <input
                  type="number"
                  step="any"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  required
                  className="w-full bg-canvas-muted border border-canvas-border rounded-xl p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-muted mb-1 font-semibold text-caption">Units</label>
                <input
                  type="text"
                  value={manualUnit}
                  onChange={(e) => setManualUnit(e.target.value)}
                  required
                  className="w-full bg-canvas-muted border border-canvas-border rounded-xl p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-muted mb-1 font-semibold text-caption">Draw Date</label>
              <input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                required
                className="w-full bg-canvas-muted border border-canvas-border rounded-xl p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
              />
            </div>
          </div>

          <div className="border-t border-canvas-border pt-3 flex flex-col-reverse sm:flex-row justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsManualAddOpen(false)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-canvas-muted hover:bg-muted-subtle text-slate-700 font-semibold border border-canvas-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] flex items-center justify-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] flex items-center justify-center"
            >
              Add to Timeline
            </button>
          </div>
        </form>
      </ModalPortal>
    </div>
  );
};
