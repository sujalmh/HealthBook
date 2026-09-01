import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  UploadCloud,
  Plus,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Database,
  HelpCircle,
  ArrowRight,
  Pill
} from 'lucide-react';
import { BiomarkerChart, ZoomWindow } from './BiomarkerChart';
import { StorySentence } from './StorySentence';
import { LabDropzone } from './LabDropzone';
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
  onBusyChange?: (busy: boolean) => void;
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

function getComparison(lab: LabRecord): { label: string; color: string } {
  const val = lab.normalizedValue;
  const low = lab.referenceRange?.low ?? 0;
  const high = lab.referenceRange?.high ?? 100;
  const span = high - low;
  const buffer10 = span * 0.10;
  const isNearHigh = val >= high - buffer10 && val <= high + buffer10;
  const isNearLow = val >= low - buffer10 && val <= low + buffer10;

  if (lab.isCritical) {
    if (lab.flag === 'CRITICAL_HIGH' || val > high) return { label: 'High — ask doctor', color: 'bg-rose-50 text-rose-700 border-rose-200' };
    if (lab.flag === 'CRITICAL_LOW' || val < low) return { label: 'Low — ask doctor', color: 'bg-rose-50 text-rose-700 border-rose-200' };
    return { label: 'Ask doctor', color: 'bg-rose-50 text-rose-700 border-rose-200' };
  }
  if (val > high) {
    if (val <= high + buffer10) return { label: 'A little high', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { label: 'High', color: 'bg-rose-50 text-rose-700 border-rose-200' };
  }
  if (val < low) {
    if (val >= low - buffer10) return { label: 'A little low', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { label: 'Low', color: 'bg-amber-50 text-amber-700 border-amber-200' };
  }
  // within range
  if (isNearHigh) return { label: 'A little high', color: 'bg-amber-50 text-amber-700 border-amber-200' };
  if (isNearLow) return { label: 'A little low', color: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: 'Good', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
}

export const LabStoryView: React.FC<LabStoryViewProps> = ({
  patientId,
  activeProfile = { userId: patientId, name: 'Patient', role: 'patient' },
  className = '',
  onBusyChange
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
  const [isUploadBusy, setIsUploadBusy] = useState<boolean>(false);
  const [isSampleOpen, setIsSampleOpen] = useState<boolean>(false);
  const [causalWindow] = useState<{ start: string; end: string; label?: string } | null>(null);

  const handleUploadBusy = (busy: boolean) => {
    setIsUploadBusy(busy);
    onBusyChange?.(busy);
  };

  const [manualMarker, setManualMarker] = useState('Creatinine');
  const [manualValue, setManualValue] = useState('1.85');
  const [manualUnit, setManualUnit] = useState('mg/dL');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);

  const loadLabs = () => {
    const patientLabs = effectivePatientId ? localVault.getLabs(effectivePatientId) : [];
    setLabs(patientLabs);
  };

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
    const u4 = eventBus.on('lab_status_changed', onLabAdded);
    return () => { u1(); u2(); u3(); u4(); };
  }, [effectivePatientId]);

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

  const activeMarkerLabs = useMemo(() => {
    return labs.filter((l) => l.marker.toLowerCase() === selectedMarker.toLowerCase());
  }, [labs, selectedMarker]);

  const medLegend = useMemo(() => {
    try {
      const meds = localVault.getMedications(effectivePatientId, 'active');
      if (meds.length > 0) return meds.slice(0, 4).map(m => ({ name: m.genericName || m.brandName || m.name || 'Medicine', dosage: m.dosage }));
      // fallback sample for demo when vault empty — keep small
      return [];
    } catch { return []; }
  }, [labs, effectivePatientId]);

  const handleIngestDataset = async (type: 'shanti' | 'jenkins') => {
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

  const handleAskWhy = () => {
    const query = `Why did my ${selectedMarker} change?`;
    eventBus.emit('navigate_ask' as any, { marker: selectedMarker, query });
    // fallback direct navigation via custom event listener in App
    try {
      window.dispatchEvent(new CustomEvent('carecanvas_navigate_ask', { detail: { marker: selectedMarker, query } }));
    } catch {}
    eventBus.dispatchToast({
      type: 'info',
      title: 'Opening questions',
      message: `We'll check why ${selectedMarker} changed on the Ask page.`,
    });
  };

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
        title: 'Note pinned',
        message: 'Doctor note added to this result.'
      });
    }
  };

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
      title: 'Result added',
      message: `${manualMarker} (${val} ${manualUnit}) saved.`
    });
  };

  return (
    <div className={`space-y-6 max-w-7xl mx-auto animate-fade-in ${className}`}>
      {/* Top Header — simple English */}
      <div className="bg-canvas-card border border-canvas-border rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-primary-light text-primary border border-primary-border flex items-center justify-center shadow-sm shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Lab Results</h2>
              <span className="text-caption px-2 py-0.5 rounded-full bg-primary-light text-primary-text font-bold border border-primary-border">
                Your results over time
              </span>
            </div>
            <p className="text-body-sm text-muted leading-relaxed">
              See your test results over time — what's normal, what's changed, and how your medicines affect them.
            </p>
          </div>
        </div>
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
            <span>Add manually</span>
          </button>
          <button
            type="button"
            onClick={loadLabs}
            className="p-2.5 rounded-xl bg-canvas-muted hover:bg-muted-subtle text-muted hover:text-slate-900 border border-canvas-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
            title="Refresh"
            aria-label="Refresh timeline"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Biomarker Selector */}
      <div className="bg-canvas-card border border-canvas-border rounded-2xl p-2.5 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {availableMarkers.map((m) => {
            const isSelected = selectedMarker.toLowerCase() === m.marker.toLowerCase();
            return (
              <button
                key={m.marker}
                type="button"
                onClick={() => {
                  setSelectedMarker(m.marker);
                }}
                className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-body-sm font-bold transition-all whitespace-nowrap border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shrink-0 min-h-[44px] ${
                  isSelected
                    ? 'bg-primary-light text-primary-text border-primary-border shadow-sm'
                    : 'bg-canvas-card text-muted hover:text-slate-900 hover:bg-canvas-muted border-canvas-border'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    m.isCritical
                      ? 'bg-rose-500 shadow-sm shadow-rose-500'
                      : m.flag === 'BORDERLINE'
                      ? 'bg-amber-500'
                      : m.flag === 'HIGH' || m.flag === 'LOW'
                      ? 'bg-amber-400'
                      : 'bg-emerald-500'
                  }`}
                />
                <span>{m.marker}</span>
                {m.latestValue !== null && (
                  <span className="text-caption font-mono px-1.5 py-0.5 rounded-full bg-muted-subtle text-muted border border-canvas-border">
                    {m.latestValue} {m.unit}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty state */}
      {labs.length === 0 ? (
        <div className="bg-canvas-card border border-dashed border-canvas-border rounded-2xl p-6 sm:p-10 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-primary-light text-primary border border-primary-border flex items-center justify-center mx-auto">
            <Activity className="w-6 h-6" />
          </div>
          <h3 className="text-heading-md font-bold text-slate-900 tracking-tight">No lab results yet</h3>
          <p className="text-body-sm text-muted max-w-md mx-auto leading-relaxed">Upload past results or add one manually — your chart will appear here.</p>
          <div className="flex items-center justify-center gap-2.5 flex-wrap">
            <button type="button" onClick={() => setIsDropzoneOpen(true)} className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-body-sm font-bold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] flex items-center justify-center">Add Past Results</button>
            <button type="button" onClick={() => setIsManualAddOpen(true)} className="px-4 py-2.5 rounded-xl bg-canvas-muted hover:bg-muted-subtle text-slate-900 border border-canvas-border text-body-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] flex items-center justify-center">Add manually</button>
          </div>
        </div>
      ) : null}

      {/* Combined card: Story + Chart + med legend + ask button */}
      {labs.length > 0 && (
        <div className="bg-canvas-card border border-canvas-border rounded-2xl shadow-sm overflow-hidden max-w-full">
          {/* Story sentence as header — single line */}
          <div className="px-4 sm:px-5 py-3 border-b border-canvas-border bg-canvas-card">
            <StorySentence key={selectedMarker} marker={selectedMarker} labs={activeMarkerLabs} embedded />
          </div>

          {/* Chart with toggles inside */}
          <div className="p-0">
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
              embedded
              className="p-4 sm:p-5"
            />
          </div>

          {/* Med legend row — small, plain English */}
          <div className="px-4 sm:px-5 py-3 bg-canvas-muted/50 border-t border-canvas-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap text-caption">
              <span className="font-bold text-muted flex items-center gap-1.5">
                <Pill className="w-3.5 h-3.5 text-primary" />
                Medicines that may affect this:
              </span>
              {medLegend.length > 0 ? (
                medLegend.map((med, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full bg-white border border-canvas-border text-slate-700 font-semibold">
                    {med.name} {med.dosage ? `· ${med.dosage}` : ''}
                  </span>
                ))
              ) : (
                <span className="text-muted">No medicines linked yet</span>
              )}
            </div>
            <span className="text-[11px] text-muted hidden sm:block">Shown with your results for context</span>
          </div>

          {/* Ask why button — navigates to Ask */}
          <div className="px-4 sm:px-5 py-3 border-t border-canvas-border flex justify-end bg-white">
            <button
              type="button"
              onClick={handleAskWhy}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-body-sm font-bold transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Ask why this changed →</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Comparison table — plain English */}
      <div className="bg-canvas-card border border-canvas-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-canvas-border pb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary-light border border-primary-border text-primary">
              <Database className="w-4 h-4" />
            </div>
            <h3 className="text-heading-md font-bold text-slate-900 tracking-tight">
              Your past results: {selectedMarker} ({activeMarkerLabs.length} records)
            </h3>
          </div>
          <span className="text-caption text-muted bg-canvas-muted border border-canvas-border px-2 py-1 rounded-full font-medium self-start sm:self-auto">
            Stored on your device
          </span>
        </div>

        <div className="overflow-x-auto -mx-1 scrollbar-none">
          <table className="w-full text-left text-body-sm min-w-[540px]">
            <thead>
              <tr className="border-b border-canvas-border text-caption text-muted uppercase tracking-wider">
                <th className="py-2.5 px-3 font-semibold">Date</th>
                <th className="py-2.5 px-3 font-semibold">Test</th>
                <th className="py-2.5 px-3 font-semibold">Your value</th>
                <th className="py-2.5 px-3 font-semibold">Normal range</th>
                <th className="py-2.5 px-3 font-semibold">How you compare</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-canvas-border text-slate-700 font-medium">
              {[...activeMarkerLabs]
                .sort((a, b) => new Date(b.drawDate).getTime() - new Date(a.drawDate).getTime())
                .map((r) => {
                  const comp = getComparison(r);
                  return (
                    <tr key={r.id} className="hover:bg-canvas-muted/60 transition-colors">
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-900 font-medium">
                        {new Date(r.drawDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">{r.marker}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {r.normalizedValue} {r.normalizedUnit}
                        {r.doctorComments?.[0] || r.doctorComment ? (
                          <span className="ml-2 inline-flex items-center gap-1 text-[11px] bg-amber-50 border border-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full">
                            📌 note
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-3 text-muted text-body-sm">
                        {r.referenceRange.low} – {r.referenceRange.high} {r.normalizedUnit}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`text-caption px-2 py-0.5 rounded-full font-bold border ${comp.color}`}>
                          {comp.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        {activeMarkerLabs.length === 0 && (
          <div className="p-6 text-center bg-canvas-muted rounded-xl border border-dashed border-canvas-border">
            <p className="text-body-sm text-muted">No results for {selectedMarker}. Try another test or add results.</p>
          </div>
        )}
      </div>

      {/* Global uploading overlay */}
      {(isUploadBusy || isLoading) && isUploadBusy && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl flex flex-col items-center gap-3 max-w-sm w-full border border-slate-200">
            <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" aria-label="Loading" />
            <p className="text-sm font-bold text-slate-900 text-center">Reading your paper, please wait...</p>
            <p className="text-xs text-slate-500 text-center">We are adding your test results. Please don't close this page until we finish.</p>
          </div>
        </div>
      )}

      {/* Modal: Upload — real dropzone */}
      <ModalPortal isOpen={isDropzoneOpen} onClose={() => !isUploadBusy && setIsDropzoneOpen(false)} ariaLabel="Add past results">
        <div className="bg-canvas-card border border-canvas-border rounded-2xl p-4 sm:p-6 max-w-lg w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto mx-auto">
          <div className="flex items-center justify-between border-b border-canvas-border pb-3">
            <div className="flex items-center gap-2 text-primary font-bold text-heading-md">
              <UploadCloud className="w-5 h-5" />
              <span>Add your lab results</span>
            </div>
            <button
              type="button"
              onClick={() => !isUploadBusy && setIsDropzoneOpen(false)}
              className="text-muted hover:text-slate-900 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <p className="text-body-sm text-muted leading-relaxed">
            Drop a lab PDF or photo. We read it and add the results to your chart.
          </p>

          <LabDropzone
            patientId={effectivePatientId}
            activeProfile={activeProfile}
            onLabAdded={() => {
              loadLabs();
              setIsDropzoneOpen(false);
            }}
            onBusyChange={handleUploadBusy}
          />

          <button
            type="button"
            onClick={() => setIsManualAddOpen(true)}
            className="w-full text-left p-3 rounded-xl bg-canvas-muted hover:bg-muted-subtle border border-canvas-border flex items-center justify-between group min-h-[44px]"
          >
            <span className="text-body-sm font-semibold text-slate-900">Add manually instead</span>
            <ChevronRight className="w-4 h-4 text-muted group-hover:text-primary" />
          </button>

          {/* Collapsed demo data */}
          <div className="border border-canvas-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setIsSampleOpen(!isSampleOpen)}
              className="w-full flex items-center justify-between px-4 py-3 bg-canvas-muted hover:bg-muted-subtle text-left"
              aria-expanded={isSampleOpen}
            >
              <span className="text-xs font-bold text-slate-700">Add sample data (for demo)</span>
              {isSampleOpen ? <ChevronDown className="w-4 h-4 text-muted" /> : <ChevronRight className="w-4 h-4 text-muted" />}
            </button>
            {isSampleOpen && (
              <div className="p-3 space-y-2 bg-white">
                <button
                  type="button"
                  onClick={() => handleIngestDataset('shanti')}
                  disabled={isLoading}
                  className="w-full text-left p-3 rounded-xl bg-canvas-muted hover:bg-muted-subtle border border-canvas-border transition-all flex items-center justify-between group min-h-[44px] disabled:opacity-50"
                >
                  <div>
                    <div className="text-body-sm font-bold text-slate-900 group-hover:text-primary">Sample: Past 4 years of results</div>
                    <div className="text-caption text-muted">Example trends to explore the chart</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted" />
                </button>
                <button
                  type="button"
                  onClick={() => handleIngestDataset('jenkins')}
                  disabled={isLoading}
                  className="w-full text-left p-3 rounded-xl bg-canvas-muted hover:bg-muted-subtle border border-canvas-border transition-all flex items-center justify-between group min-h-[44px] disabled:opacity-50"
                >
                  <div>
                    <div className="text-body-sm font-bold text-slate-900 group-hover:text-primary">Sample: Kidney + diabetes panel</div>
                    <div className="text-caption text-muted">Example with recent changes</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted" />
                </button>
                {isLoading && (
                  <div className="flex items-center gap-2 text-body-sm text-primary font-medium py-1" role="status" aria-live="polite">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" /> Adding sample data...
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-canvas-border pt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => !isUploadBusy && setIsDropzoneOpen(false)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-canvas-muted hover:bg-muted-subtle text-slate-700 font-semibold border border-canvas-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] text-body-sm flex items-center justify-center"
            >
              Close
            </button>
          </div>
        </div>
      </ModalPortal>

      {/* Modal: Manual add — kept secondary */}
      <ModalPortal isOpen={isManualAddOpen} onClose={() => setIsManualAddOpen(false)} ariaLabel="Add lab result">
        <form
          onSubmit={handleManualAddSubmit}
          className="bg-canvas-card border border-canvas-border rounded-2xl p-4 sm:p-6 max-w-md w-full space-y-4 shadow-2xl text-body-sm max-h-[90vh] overflow-y-auto mx-auto"
        >
          <div className="flex items-center justify-between border-b border-canvas-border pb-3">
            <div className="flex items-center gap-2 text-primary font-bold text-heading-md">
              <Plus className="w-4 h-4" />
              <span>Add a result</span>
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
              <label className="block text-muted mb-1 font-semibold text-caption">Test name</label>
              <select
                value={manualMarker}
                onChange={(e) => setManualMarker(e.target.value)}
                className="w-full bg-canvas-muted border border-canvas-border rounded-xl p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary min-h-[44px]"
              >
                <option value="Creatinine">Creatinine (mg/dL)</option>
                <option value="eGFR">eGFR (mL/min)</option>
                <option value="HbA1c">HbA1c (%)</option>
                <option value="Glucose Fasting">Sugar — fasting (mg/dL)</option>
                <option value="Potassium">Potassium (mEq/L)</option>
                <option value="Cholesterol Total">Cholesterol (mg/dL)</option>
                <option value="LDL">LDL (mg/dL)</option>
                <option value="HDL">HDL (mg/dL)</option>
                <option value="Triglycerides">Triglycerides (mg/dL)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-muted mb-1 font-semibold text-caption">Value</label>
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
                <label className="block text-muted mb-1 font-semibold text-caption">Unit</label>
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
              <label className="block text-muted mb-1 font-semibold text-caption">Date</label>
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
              Add to chart
            </button>
          </div>
        </form>
      </ModalPortal>
    </div>
  );
};
